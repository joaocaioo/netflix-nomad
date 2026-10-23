import type { ApiAction } from './bridge';
import type { CommandResult, PlayerCommand, PlayerState, TitleInfo } from './messages';

/** Parte do `HTMLMediaElement` que a extensão usa. Permite testar sem DOM. */
export type MediaLike = Pick<
  HTMLMediaElement,
  'paused' | 'muted' | 'volume' | 'playbackRate' | 'currentTime' | 'duration' | 'play' | 'pause'
>;

/** O que os comandos fazem na página, fora do `<video>`. Permite testar sem DOM. */
export interface PageActions {
  /** Repassa o comando à API do player da Netflix; `false` se ela não o atender. */
  callApi: (action: ApiAction) => Promise<boolean>;
  getTitle: () => Promise<TitleInfo | null>;
  /** Navega a aba para um caminho da Netflix, depois de responder ao popup. */
  navigate: (path: string) => void;
}

export const VOLUME_STEP = 0.1;

/** O estado sempre vem do elemento de vídeo, que é a fonte da verdade. */
export function readState(media: MediaLike): PlayerState {
  return {
    paused: media.paused,
    muted: media.muted,
    volume: media.volume,
    playbackRate: media.playbackRate,
    currentTime: Number.isFinite(media.currentTime) ? media.currentTime : 0,
    duration: Number.isFinite(media.duration) ? media.duration : 0,
  };
}

/** Limita a [0, 1] e arredonda para evitar resíduos como 0.30000000000000004. */
export function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, Math.round(volume * 100) / 100));
}

export async function runCommand(
  media: MediaLike | null,
  command: PlayerCommand,
  page: PageActions,
): Promise<CommandResult> {
  if (!media) return { ok: false, error: 'NO_VIDEO' };

  switch (command.type) {
    case 'getState':
      break;
    case 'togglePlay':
      if (media.paused) {
        try {
          await media.play();
        } catch {
          return { ok: false, error: 'PLAY_REJECTED' };
        }
      } else {
        media.pause();
      }
      break;
    // O estado é lido do `<video>`, mas a mudança passa pela API do player:
    // a Netflix desfaz o que for alterado direto no elemento.
    case 'toggleMute':
      if (!(await page.callApi({ type: 'setMuted', muted: !media.muted }))) {
        return { ok: false, error: 'CONTROL_NOT_FOUND' };
      }
      break;
    case 'changeVolume': {
      const volume = clampVolume(media.volume + command.delta);
      const ok =
        (await page.callApi({ type: 'setVolume', volume })) &&
        (await page.callApi({ type: 'setMuted', muted: volume === 0 }));
      if (!ok) return { ok: false, error: 'CONTROL_NOT_FOUND' };
      break;
    }
    case 'setSpeed':
    case 'seekBy':
    case 'skip':
    case 'setAudioTrack':
    case 'setTextTrack':
      if (!(await page.callApi(command))) return { ok: false, error: 'CONTROL_NOT_FOUND' };
      break;
    case 'nextEpisode': {
      const next = (await page.getTitle())?.nextEpisode;
      if (!next) return { ok: false, error: 'CONTROL_NOT_FOUND' };
      page.navigate(`/watch/${String(next)}`);
      break;
    }
    case 'playEpisode':
      page.navigate(`/watch/${String(command.episodeId)}`);
      break;
    case 'exit':
      page.navigate('/browse');
      break;
    default: {
      const unknown: never = command;
      throw new Error(`Comando desconhecido: ${JSON.stringify(unknown)}`);
    }
  }

  return { ok: true, state: readState(media) };
}
