import { describe, expect, it, vi } from 'vitest';
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

/** Página sem nenhum botão do player e sem o elemento do Nomad Mode. */
function fakePage(overrides: Partial<PageActions> = {}): PageActions {
  return {
    pressControl: vi.fn(() => Promise.resolve(false)),
    enterNomadMode: vi.fn(() => false),
    ...overrides,
  };
}

const noControls = fakePage();

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
    const result = await runCommand(media, { type: 'toggleMute' }, noControls);
    expect(result).toMatchObject({ ok: true, state: { muted: false } });
  });

  it('changeVolume soma o delta, arredonda e desmuta', async () => {
    const media = fakeMedia({ muted: true, volume: 0.2 });
    const result = await runCommand(media, { type: 'changeVolume', delta: 0.1 }, noControls);
    expect(result).toMatchObject({ ok: true, state: { muted: false, volume: 0.3 } });
  });

  it('changeVolume para 0 deixa o vídeo mudo', async () => {
    const media = fakeMedia({ volume: 0.1 });
    const result = await runCommand(media, { type: 'changeVolume', delta: -0.1 }, noControls);
    expect(result).toMatchObject({ ok: true, state: { muted: true, volume: 0 } });
  });

  it('setSpeed altera a velocidade do vídeo', async () => {
    const media = fakeMedia();
    const result = await runCommand(media, { type: 'setSpeed', rate: 1.5 }, noControls);
    expect(media.playbackRate).toBe(1.5);
    expect(result).toMatchObject({ ok: true, state: { playbackRate: 1.5 } });
  });

  it('pressControl aciona o botão do player e devolve o estado', async () => {
    const page = fakePage({ pressControl: vi.fn(() => Promise.resolve(true)) });
    const result = await runCommand(
      fakeMedia(),
      { type: 'pressControl', control: 'forward10' },
      page,
    );
    expect(page.pressControl).toHaveBeenCalledWith('forward10');
    expect(result).toMatchObject({ ok: true });
  });

  it('pressControl devolve CONTROL_NOT_FOUND quando o botão não existe', async () => {
    const result = await runCommand(
      fakeMedia(),
      { type: 'pressControl', control: 'next' },
      noControls,
    );
    expect(result).toEqual({ ok: false, error: 'CONTROL_NOT_FOUND' });
  });

  it('nomadMode ativa o modo na página e devolve o estado', async () => {
    const page = fakePage({ enterNomadMode: vi.fn(() => true) });
    const result = await runCommand(fakeMedia(), { type: 'nomadMode' }, page);
    expect(page.enterNomadMode).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ ok: true });
  });

  it('nomadMode devolve CONTROL_NOT_FOUND quando não há o que remover', async () => {
    const result = await runCommand(fakeMedia(), { type: 'nomadMode' }, noControls);
    expect(result).toEqual({ ok: false, error: 'CONTROL_NOT_FOUND' });
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
