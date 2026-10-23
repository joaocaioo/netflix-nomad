import type { BridgeRequest, BridgeResponse } from './bridge';
import type { TitleInfo } from './messages';

/**
 * Parte da API interna do player da Netflix que a extensão usa, como ela
 * aparece em `netflix.appContext.state.playerApp`. Tempos em milissegundos.
 * Separada do acesso a `window.netflix` para ser testável.
 */
export interface NetflixTrack {
  trackId: string;
  displayName: string;
}

export interface NetflixTimeCode {
  type: string;
  startOffsetMs: number;
  endOffsetMs: number;
}

export interface NetflixPlayer {
  getMovieId(): number;
  getCurrentTime(): number;
  getDuration(): number;
  seek(timeMs: number): unknown;
  setMuted(muted: boolean): unknown;
  /** De 0 a 1. */
  setVolume(volume: number): unknown;
  setPlaybackRate(rate: number): unknown;
  getTimeCodes(): NetflixTimeCode[] | undefined;
  getAudioTrackList(): NetflixTrack[];
  getAudioTrack(): NetflixTrack | undefined;
  setAudioTrack(track: NetflixTrack): unknown;
  getTimedTextTrackList(): NetflixTrack[];
  getTimedTextTrack(): NetflixTrack | undefined;
  setTimedTextTrack(track: NetflixTrack): unknown;
}

export interface NetflixVideo {
  title: string;
  /** Em séries, o id do episódio que está tocando. */
  currentEpisode?: number;
  seasons?: {
    title: string;
    episodes: { id: number; seq: number; title: string }[];
  }[];
}

export interface NetflixPage {
  player: NetflixPlayer;
  /** Metadados do título; podem faltar enquanto a página carrega. */
  video: NetflixVideo | undefined;
}

export async function handleRequest(
  page: NetflixPage,
  request: BridgeRequest,
): Promise<BridgeResponse> {
  const { player } = page;
  switch (request.type) {
    case 'getTitle':
      return { ok: true, title: readTitle(page) };
    case 'seekBy': {
      const target = player.getCurrentTime() + request.seconds * 1000;
      player.seek(Math.min(Math.max(0, target), player.getDuration()));
      return { ok: true };
    }
    case 'setMuted':
      player.setMuted(request.muted);
      return { ok: true };
    case 'setVolume':
      player.setVolume(request.volume);
      return { ok: true };
    case 'setSpeed':
      player.setPlaybackRate(request.rate);
      return { ok: true };
    case 'skip': {
      const target = skipTarget(player.getTimeCodes() ?? [], player.getCurrentTime());
      if (target === null) return { ok: false };
      player.seek(target);
      return { ok: true };
    }
    case 'setAudioTrack': {
      const track = player.getAudioTrackList().find((t) => t.trackId === request.trackId);
      if (!track) return { ok: false };
      await player.setAudioTrack(track);
      return { ok: true };
    }
    case 'setTextTrack': {
      const track = player.getTimedTextTrackList().find((t) => t.trackId === request.trackId);
      if (!track) return { ok: false };
      await player.setTimedTextTrack(track);
      return { ok: true };
    }
    default: {
      const unknown: never = request;
      throw new Error(`Pedido desconhecido: ${JSON.stringify(unknown)}`);
    }
  }
}

/**
 * Para onde "Pular abertura" leva. Recapitulação e abertura vêm como
 * intervalos: dentro de um deles, pula para o fim. Antes da marca "start",
 * onde o episódio de fato começa, pula para ela. `null` se não há o que pular.
 */
export function skipTarget(timeCodes: NetflixTimeCode[], nowMs: number): number | null {
  const range = timeCodes.find(
    (code) => code.type !== 'ending' && code.startOffsetMs <= nowMs && nowMs < code.endOffsetMs,
  );
  if (range) return range.endOffsetMs;
  const start = timeCodes.find((code) => code.type === 'start');
  if (start && nowMs < start.startOffsetMs) return start.startOffsetMs;
  return null;
}

export function readTitle({ player, video }: NetflixPage): TitleInfo {
  const seasons = (video?.seasons ?? []).map((season) => ({
    title: season.title,
    episodes: season.episodes.map(({ id, seq, title }) => ({ id, seq, title })),
  }));
  const episodes = seasons.flatMap((season) => season.episodes);
  const currentEpisode = seasons.length > 0 ? (video?.currentEpisode ?? player.getMovieId()) : null;
  const index = episodes.findIndex((episode) => episode.id === currentEpisode);

  return {
    title: video?.title ?? '',
    seasons,
    currentEpisode,
    nextEpisode: index === -1 ? null : (episodes[index + 1]?.id ?? null),
    audioTracks: player.getAudioTrackList().map(toTrack),
    audioTrack: player.getAudioTrack()?.trackId ?? null,
    textTracks: player.getTimedTextTrackList().map(toTrack),
    textTrack: player.getTimedTextTrack()?.trackId ?? null,
  };
}

function toTrack(track: NetflixTrack) {
  return { id: track.trackId, name: track.displayName };
}
