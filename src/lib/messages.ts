/**
 * Contrato das mensagens trocadas entre quem comanda (popup e service worker)
 * e quem executa (content script na aba da Netflix).
 */

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
/** Quanto os botões de voltar e avançar andam. */
export const SEEK_SECONDS = 10;
export type Speed = (typeof SPEEDS)[number];

/**
 * Comandos atendidos pela API interna do player da Netflix. A barra de
 * controles da Netflix nem sempre existe no DOM, então a extensão não clica
 * nela: fala direto com o player (ver `entrypoints/netflix-api.ts`).
 */
export type PlayerApiCommand =
  | { type: 'seekBy'; seconds: number }
  | { type: 'seekTo'; seconds: number }
  | { type: 'skip' }
  | { type: 'setSpeed'; rate: Speed }
  | { type: 'setAudioTrack'; trackId: string }
  | { type: 'setTextTrack'; trackId: string };

export type PlayerCommand =
  | { type: 'getState' }
  | { type: 'togglePlay' }
  | { type: 'toggleMute' }
  | { type: 'changeVolume'; delta: number }
  /** De 0 a 1. */
  | { type: 'setVolume'; volume: number }
  | { type: 'nextEpisode' }
  | { type: 'playEpisode'; episodeId: number }
  | { type: 'exit' }
  | PlayerApiCommand;

/**
 * O Nomad Mode fica fora de `PlayerCommand` porque não depende de vídeo:
 * funciona em qualquer página da Netflix e não devolve estado do player.
 */
export interface NomadCommand {
  type: 'nomadMode';
}

/**
 * Tela cheia é da janela do navegador, então quem atende é o service worker.
 * O popup informa a janela; o content script não precisa, o service worker
 * a descobre pela aba que mandou.
 */
export interface WindowCommand {
  type: 'setFullscreen';
  /**
   * Entrar ou sair, nunca "alternar": quem pede sabe o que vê. O estado que
   * o Chrome informa pode estar errado (ex.: depois de sair pelo F11).
   */
  fullscreen: boolean;
  windowId?: number;
}

/**
 * Título, episódios e faixas mudam pouco, então ficam fora do `getState`
 * que o popup repete a cada segundo.
 */
export interface TitleCommand {
  type: 'getTitle';
}

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

export interface Track {
  id: string;
  name: string;
}

export interface Episode {
  id: number;
  /** Número do episódio na temporada. */
  seq: number;
  title: string;
}

export interface Season {
  title: string;
  episodes: Episode[];
}

/** Marca de recapitulação, abertura ou créditos, como a Netflix informa. */
export interface TimeCode {
  type: string;
  startOffsetMs: number;
  endOffsetMs: number;
}

export interface TitleInfo {
  title: string;
  /** Vazio em filmes. */
  seasons: Season[];
  currentEpisode: number | null;
  previousEpisode: number | null;
  nextEpisode: number | null;
  audioTracks: Track[];
  audioTrack: string | null;
  textTracks: Track[];
  textTrack: string | null;
  /** Não mudam durante o episódio; o popup as usa para mostrar "Pular". */
  timeCodes: TimeCode[];
}

/** Erros que o content script pode devolver. */
export type PlayerErrorCode =
  'NO_VIDEO' | 'PLAY_REJECTED' | 'CONTROL_NOT_FOUND' | 'NOMAD_NOT_FOUND';

export type CommandResult =
  { ok: true; state: PlayerState } | { ok: false; error: PlayerErrorCode };

export type NomadResult = { ok: true } | { ok: false; error: 'NOMAD_NOT_FOUND' };

export type TitleResult = { ok: true; title: TitleInfo } | { ok: false; error: 'NO_VIDEO' };

const SIMPLE_COMMANDS = new Set([
  'getState',
  'togglePlay',
  'toggleMute',
  'skip',
  'nextEpisode',
  'exit',
]);

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
    case 'seekBy':
      return typeof message.seconds === 'number' && Number.isFinite(message.seconds);
    case 'seekTo':
      return (
        typeof message.seconds === 'number' && message.seconds >= 0 && message.seconds < Infinity
      );
    case 'setVolume':
      return typeof message.volume === 'number' && message.volume >= 0 && message.volume <= 1;
    case 'setSpeed':
      return SPEEDS.some((speed) => speed === message.rate);
    case 'setAudioTrack':
    case 'setTextTrack':
      return typeof message.trackId === 'string' && message.trackId !== '';
    case 'playEpisode':
      return Number.isSafeInteger(message.episodeId) && (message.episodeId as number) > 0;
    default:
      return false;
  }
}

export function isNomadCommand(value: unknown): value is NomadCommand {
  return hasType(value, 'nomadMode');
}

export function isWindowCommand(value: unknown): value is WindowCommand {
  if (!hasType(value, 'setFullscreen')) return false;
  const { fullscreen, windowId } = value as Record<string, unknown>;
  return (
    typeof fullscreen === 'boolean' && (windowId === undefined || Number.isSafeInteger(windowId))
  );
}

export function isTitleCommand(value: unknown): value is TitleCommand {
  return hasType(value, 'getTitle');
}

function hasType(value: unknown, type: string): boolean {
  return (
    typeof value === 'object' && value !== null && (value as Record<string, unknown>).type === type
  );
}
