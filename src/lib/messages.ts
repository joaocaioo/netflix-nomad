/**
 * Contrato das mensagens trocadas entre quem comanda (popup e service worker)
 * e quem executa (content script na aba da Netflix).
 */

/** Botões do próprio player da Netflix que a extensão aciona. */
export type PlayerControl =
  'back10' | 'forward10' | 'next' | 'episodes' | 'audioSubtitles' | 'exit' | 'skip';

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export type Speed = (typeof SPEEDS)[number];

export type PlayerCommand =
  | { type: 'getState' }
  | { type: 'togglePlay' }
  | { type: 'toggleMute' }
  | { type: 'changeVolume'; delta: number }
  | { type: 'setSpeed'; rate: Speed }
  | { type: 'pressControl'; control: PlayerControl };

export interface PlayerState {
  paused: boolean;
  muted: boolean;
  /** De 0 a 1. */
  volume: number;
  playbackRate: number;
  /** Em segundos. */
  currentTime: number;
  /** Em segundos; 0 enquanto desconhecida. */
  duration: number;
}

/** Erros que o content script pode devolver. */
export type PlayerErrorCode = 'NO_VIDEO' | 'PLAY_REJECTED' | 'CONTROL_NOT_FOUND';

export type CommandResult =
  { ok: true; state: PlayerState } | { ok: false; error: PlayerErrorCode };

const SIMPLE_COMMANDS = new Set(['getState', 'togglePlay', 'toggleMute']);
const CONTROLS = new Set<string>([
  'back10',
  'forward10',
  'next',
  'episodes',
  'audioSubtitles',
  'exit',
  'skip',
] satisfies PlayerControl[]);

/** Valida em tempo de execução o que chega por `runtime.onMessage`. */
export function isPlayerCommand(value: unknown): value is PlayerCommand {
  if (typeof value !== 'object' || value === null) return false;
  const message = value as Record<string, unknown>;
  const { type } = message;
  if (typeof type !== 'string') return false;
  if (SIMPLE_COMMANDS.has(type)) return true;

  switch (type) {
    case 'changeVolume':
      return typeof message.delta === 'number' && Number.isFinite(message.delta);
    case 'setSpeed':
      return SPEEDS.some((speed) => speed === message.rate);
    case 'pressControl':
      return typeof message.control === 'string' && CONTROLS.has(message.control);
    default:
      return false;
  }
}
