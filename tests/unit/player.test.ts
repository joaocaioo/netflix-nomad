import { describe, expect, it, vi } from 'vitest';
import type { ApiAction } from '@/lib/bridge';
import type { TitleInfo } from '@/lib/messages';
import { clampVolume, readState, runCommand, type MediaLike, type PageActions } from '@/lib/player';

function fakeMedia(overrides: Partial<MediaLike> = {}): MediaLike {
  // Objeto literal (não MediaLike) para poder alterar `paused`, que é readonly no DOM.
  const media = {
    paused: true,
    muted: false,
    volume: 0.5,
    playbackRate: 1,
    currentTime: 30,
    duration: 1200,
    play: vi.fn(() => {
      media.paused = false;
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      media.paused = true;
    }),
    ...overrides,
  };
  return media;
}

const TITLE: TitleInfo = {
  title: 'Série',
  seasons: [],
  currentEpisode: 1,
  nextEpisode: 2,
  audioTracks: [],
  audioTrack: null,
  textTracks: [],
  textTrack: null,
  timeCodes: [],
};

/** Página em que a API do player não atende nada. */
function fakePage(overrides: Partial<PageActions> = {}): PageActions {
  return {
    callApi: vi.fn(() => Promise.resolve(false)),
    getTitle: vi.fn(() => Promise.resolve(null)),
    navigate: vi.fn(),
    ...overrides,
  };
}

const noControls = fakePage();

/** API do player que, como a da Netflix, aplica a mudança no `<video>`. */
function apiOn(media: MediaLike): PageActions {
  return fakePage({
    callApi: vi.fn((action: ApiAction) => {
      if (action.type === 'setMuted') media.muted = action.muted;
      if (action.type === 'setVolume') media.volume = action.volume;
      if (action.type === 'setSpeed') media.playbackRate = action.rate;
      return Promise.resolve(true);
    }),
  });
}

describe('runCommand', () => {
  it('devolve NO_VIDEO quando não há vídeo na página', async () => {
    await expect(runCommand(null, { type: 'togglePlay' }, noControls)).resolves.toEqual({
      ok: false,
      error: 'NO_VIDEO',
    });
  });

  it('getState só lê o estado', async () => {
    const media = fakeMedia({ muted: true, volume: 0.3 });
    await expect(runCommand(media, { type: 'getState' }, noControls)).resolves.toEqual({
      ok: true,
      state: {
        paused: true,
        muted: true,
        volume: 0.3,
        playbackRate: 1,
        currentTime: 30,
        duration: 1200,
      },
    });
  });

  it('togglePlay reproduz quando está pausado e pausa quando está tocando', async () => {
    const media = fakeMedia();

    const first = await runCommand(media, { type: 'togglePlay' }, noControls);
    expect(media.play).toHaveBeenCalledOnce();
    expect(first).toMatchObject({ ok: true, state: { paused: false } });

    const second = await runCommand(media, { type: 'togglePlay' }, noControls);
    expect(media.pause).toHaveBeenCalledOnce();
    expect(second).toMatchObject({ ok: true, state: { paused: true } });
  });

  it('togglePlay devolve PLAY_REJECTED quando o navegador bloqueia play()', async () => {
    const media = fakeMedia({
      play: vi.fn(() => Promise.reject(new DOMException('blocked', 'NotAllowedError'))),
    });
    await expect(runCommand(media, { type: 'togglePlay' }, noControls)).resolves.toEqual({
      ok: false,
      error: 'PLAY_REJECTED',
    });
  });

  it('toggleMute parte do estado atual do vídeo, não de uma variável do popup', async () => {
    // Vídeo já mudo antes do popup abrir: o primeiro clique precisa ativar o som.
    const media = fakeMedia({ muted: true });
    const result = await runCommand(media, { type: 'toggleMute' }, apiOn(media));
    expect(result).toMatchObject({ ok: true, state: { muted: false } });
  });

  it('changeVolume soma o delta, arredonda e desmuta', async () => {
    const media = fakeMedia({ muted: true, volume: 0.2 });
    const result = await runCommand(media, { type: 'changeVolume', delta: 0.1 }, apiOn(media));
    expect(result).toMatchObject({ ok: true, state: { muted: false, volume: 0.3 } });
  });

  it('changeVolume para 0 deixa o vídeo mudo', async () => {
    const media = fakeMedia({ volume: 0.1 });
    const result = await runCommand(media, { type: 'changeVolume', delta: -0.1 }, apiOn(media));
    expect(result).toMatchObject({ ok: true, state: { muted: true, volume: 0 } });
  });

  it('setSpeed altera a velocidade do vídeo', async () => {
    const media = fakeMedia();
    const result = await runCommand(media, { type: 'setSpeed', rate: 1.5 }, apiOn(media));
    expect(media.playbackRate).toBe(1.5);
    expect(result).toMatchObject({ ok: true, state: { playbackRate: 1.5 } });
  });

  it.each([
    { type: 'seekBy', seconds: 10 },
    { type: 'skip' },
    { type: 'setSpeed', rate: 1.5 },
    { type: 'setAudioTrack', trackId: 'A:pt' },
    { type: 'setTextTrack', trackId: 'T:off' },
  ] as const)('$type é repassado à API do player', async (command) => {
    const page = fakePage({ callApi: vi.fn(() => Promise.resolve(true)) });
    const result = await runCommand(fakeMedia(), command, page);
    expect(page.callApi).toHaveBeenCalledWith(command);
    expect(result).toMatchObject({ ok: true });
  });

  it.each([
    { type: 'skip' },
    { type: 'toggleMute' },
    { type: 'changeVolume', delta: 0.1 },
  ] as const)(
    '$type devolve CONTROL_NOT_FOUND quando a API do player não atende',
    async (command) => {
      const result = await runCommand(fakeMedia(), command, noControls);
      expect(result).toEqual({ ok: false, error: 'CONTROL_NOT_FOUND' });
    },
  );

  it('nextEpisode navega para o próximo episódio', async () => {
    const page = fakePage({ getTitle: vi.fn(() => Promise.resolve(TITLE)) });
    const result = await runCommand(fakeMedia(), { type: 'nextEpisode' }, page);
    expect(page.navigate).toHaveBeenCalledWith('/watch/2');
    expect(result).toMatchObject({ ok: true });
  });

  it('nextEpisode devolve CONTROL_NOT_FOUND no último episódio', async () => {
    const page = fakePage({
      getTitle: vi.fn(() => Promise.resolve({ ...TITLE, nextEpisode: null })),
    });
    const result = await runCommand(fakeMedia(), { type: 'nextEpisode' }, page);
    expect(page.navigate).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: 'CONTROL_NOT_FOUND' });
  });

  it('playEpisode e exit navegam a aba', async () => {
    const page = fakePage();
    await runCommand(fakeMedia(), { type: 'playEpisode', episodeId: 7 }, page);
    await runCommand(fakeMedia(), { type: 'exit' }, page);
    expect(page.navigate).toHaveBeenNthCalledWith(1, '/watch/7');
    expect(page.navigate).toHaveBeenNthCalledWith(2, '/browse');
  });
});

describe('readState', () => {
  it('troca tempo e duração não finitos por 0', () => {
    const state = readState(fakeMedia({ currentTime: Number.NaN, duration: Infinity }));
    expect(state).toMatchObject({ currentTime: 0, duration: 0 });
  });
});

describe('clampVolume', () => {
  it.each([
    [-0.5, 0],
    [0, 0],
    [0.30000000000000004, 0.3],
    [1, 1],
    [1.4, 1],
  ])('clampVolume(%d) = %d', (input, expected) => {
    expect(clampVolume(input)).toBe(expected);
  });
});
