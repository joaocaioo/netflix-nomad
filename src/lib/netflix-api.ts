import type { BridgeRequest, BridgeResponse } from './bridge';
import type { TimeCode, TitleInfo } from './messages';
import { findSkip } from './skip';

/**
 * Parte da API interna do player da Netflix que a extensão usa, como ela
 * aparece em `netflix.appContext.state.playerApp`. Tempos em milissegundos.
 * Separada do acesso a `window.netflix` para ser testável.
 */
export interface NetflixTrack {
  trackId: string;
  displayName: string;
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
  getTimeCodes(): TimeCode[] | undefined;
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
      const skip = findSkip(player.getTimeCodes() ?? [], player.getCurrentTime());
      if (!skip) return { ok: false };
      player.seek(skip.targetMs);
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
    timeCodes: (player.getTimeCodes() ?? []).map(({ type, startOffsetMs, endOffsetMs }) => ({
      type,
      startOffsetMs,
      endOffsetMs,
    })),
  };
}

function toTrack(track: NetflixTrack) {
  return { id: track.trackId, name: track.displayName };
}
