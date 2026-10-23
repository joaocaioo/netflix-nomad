import type { CommandResult, PlayerCommand, PlayerControl, PlayerState } from './messages';

/** Parte do `HTMLMediaElement` que a extensão usa. Permite testar sem DOM. */
export type MediaLike = Pick<
  HTMLMediaElement,
  'paused' | 'muted' | 'volume' | 'playbackRate' | 'currentTime' | 'duration' | 'play' | 'pause'
>;

/** Aciona um botão do player; devolve `false` se ele não existir. */
export type ControlPresser = (control: PlayerControl) => Promise<boolean>;

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
  press: ControlPresser,
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
    case 'toggleMute':
      media.muted = !media.muted;
      break;
    case 'changeVolume': {
      const volume = clampVolume(media.volume + command.delta);
      media.volume = volume;
      media.muted = volume === 0;
      break;
    }
    case 'setSpeed':
      media.playbackRate = command.rate;
      break;
    case 'pressControl':
      if (!(await press(command.control))) return { ok: false, error: 'CONTROL_NOT_FOUND' };
      break;
    default: {
      const unknown: never = command;
      throw new Error(`Comando desconhecido: ${JSON.stringify(unknown)}`);
    }
  }

  return { ok: true, state: readState(media) };
}
