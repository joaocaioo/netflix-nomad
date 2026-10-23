import { describe, expect, it, vi } from 'vitest';
import { handleRequest, readTitle, type NetflixPage, type NetflixPlayer } from '@/lib/netflix-api';

/** Marcas como as que a Netflix devolve num episódio com recapitulação. */
const TIME_CODES = [
  { type: 'start', startOffsetMs: 66316, endOffsetMs: 66316 },
  { type: 'ending', startOffsetMs: 2494116, endOffsetMs: 2494116 },
  { type: 'recap', startOffsetMs: 0, endOffsetMs: 64147 },
];

const AUDIO = [
  { trackId: 'A:en', displayName: 'Inglês [original]' },
  { trackId: 'A:pt', displayName: 'Português' },
];
const TEXT = [
  { trackId: 'T:off', displayName: 'Desligadas' },
  { trackId: 'T:pt', displayName: 'Português' },
];

function fakePlayer(overrides: Partial<NetflixPlayer> = {}): NetflixPlayer {
  return {
    getMovieId: () => 11,
    getCurrentTime: () => 220000,
    getDuration: () => 2618240,
    seek: vi.fn(),
    setMuted: vi.fn(),
    setVolume: vi.fn(),
    setPlaybackRate: vi.fn(),
    getTimeCodes: () => TIME_CODES,
    getAudioTrackList: () => AUDIO,
    getAudioTrack: () => AUDIO[0],
    setAudioTrack: vi.fn(() => Promise.resolve()),
    getTimedTextTrackList: () => TEXT,
    getTimedTextTrack: () => TEXT[1],
    setTimedTextTrack: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

const SHOW = {
  title: 'O Conto da Aia',
  currentEpisode: 11,
  seasons: [
    {
      title: 'Temporada 1',
      episodes: [
        { id: 10, seq: 1, title: 'Episódio 1' },
        { id: 11, seq: 2, title: 'Episódio 2' },
      ],
    },
    { title: 'Temporada 2', episodes: [{ id: 20, seq: 1, title: 'Episódio 1' }] },
  ],
};

describe('readTitle', () => {
  it('monta episódios, próximo episódio e faixas', () => {
    const title = readTitle({ player: fakePlayer(), video: SHOW });
    expect(title).toMatchObject({
      title: 'O Conto da Aia',
      currentEpisode: 11,
      // O próximo do último episódio da temporada é o primeiro da seguinte.
      nextEpisode: 20,
      audioTracks: [
        { id: 'A:en', name: 'Inglês [original]' },
        { id: 'A:pt', name: 'Português' },
      ],
      audioTrack: 'A:en',
      textTrack: 'T:pt',
      timeCodes: TIME_CODES,
    });
    expect(title.seasons.map((season) => season.episodes.length)).toEqual([2, 1]);
  });

  it('no último episódio não há próximo', () => {
    const title = readTitle({ player: fakePlayer(), video: { ...SHOW, currentEpisode: 20 } });
    expect(title.nextEpisode).toBeNull();
  });

  it('em filmes não há episódios', () => {
    const title = readTitle({ player: fakePlayer(), video: { title: 'Filme' } });
    expect(title).toMatchObject({ seasons: [], currentEpisode: null, nextEpisode: null });
  });
});

describe('handleRequest', () => {
  function page(player = fakePlayer()): NetflixPage {
    return { player, video: SHOW };
  }

  it('seekBy anda em milissegundos a partir do tempo atual', async () => {
    const seek = vi.fn();
    await expect(
      handleRequest(page(fakePlayer({ seek })), { type: 'seekBy', seconds: -10 }),
    ).resolves.toEqual({ ok: true });
    expect(seek).toHaveBeenCalledWith(210000);
  });

  it('seekBy não passa do início nem do fim', async () => {
    const seek = vi.fn();
    await handleRequest(page(fakePlayer({ seek, getCurrentTime: () => 3000 })), {
      type: 'seekBy',
      seconds: -10,
    });
    await handleRequest(page(fakePlayer({ seek, getCurrentTime: () => 2615000 })), {
      type: 'seekBy',
      seconds: 10,
    });
    expect(seek).toHaveBeenNthCalledWith(1, 0);
    expect(seek).toHaveBeenNthCalledWith(2, 2618240);
  });

  it('skip falha quando não há o que pular', async () => {
    const seek = vi.fn();
    await expect(handleRequest(page(fakePlayer({ seek })), { type: 'skip' })).resolves.toEqual({
      ok: false,
    });
    expect(seek).not.toHaveBeenCalled();
  });

  it('troca áudio e legenda pelo id da faixa', async () => {
    const setAudioTrack = vi.fn(() => Promise.resolve());
    const setTimedTextTrack = vi.fn(() => Promise.resolve());
    const player = fakePlayer({ setAudioTrack, setTimedTextTrack });
    await handleRequest(page(player), { type: 'setAudioTrack', trackId: 'A:pt' });
    await handleRequest(page(player), { type: 'setTextTrack', trackId: 'T:off' });
    expect(setAudioTrack).toHaveBeenCalledWith(AUDIO[1]);
    expect(setTimedTextTrack).toHaveBeenCalledWith(TEXT[0]);
  });

  it('mudo, volume e velocidade vão para o player', async () => {
    const setMuted = vi.fn();
    const setVolume = vi.fn();
    const setPlaybackRate = vi.fn();
    const player = fakePlayer({ setMuted, setVolume, setPlaybackRate });
    await handleRequest(page(player), { type: 'setMuted', muted: true });
    await handleRequest(page(player), { type: 'setVolume', volume: 0.4 });
    await handleRequest(page(player), { type: 'setSpeed', rate: 1.25 });
    expect(setMuted).toHaveBeenCalledWith(true);
    expect(setVolume).toHaveBeenCalledWith(0.4);
    expect(setPlaybackRate).toHaveBeenCalledWith(1.25);
  });

  it('recusa faixa que não existe', async () => {
    await expect(
      handleRequest(page(), { type: 'setAudioTrack', trackId: 'A:xx' }),
    ).resolves.toEqual({ ok: false });
  });

  it('getTitle devolve o título', async () => {
    const response = await handleRequest(page(), { type: 'getTitle' });
    expect(response).toMatchObject({ ok: true, title: { title: 'O Conto da Aia' } });
  });
});
