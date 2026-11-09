import type { TimeCode } from './messages';

/** Quanto dura a contagem até o próximo episódio, como na Netflix. */
export const AUTO_NEXT_MS = 5000;

/**
 * Sem a marca de créditos da Netflix, a chamada para o próximo episódio
 * aparece quando falta isso para o fim: dá para a contagem terminar antes
 * de o vídeo acabar.
 */
const FALLBACK_BEFORE_END_S = 10;

/**
 * A partir de quando (em segundos) oferecer o próximo episódio: no começo
 * dos créditos, se a Netflix os marca, ou perto do fim. `null` enquanto a
 * duração é desconhecida.
 */
export function creditsStart(timeCodes: TimeCode[], durationSeconds: number): number | null {
  if (durationSeconds <= 0) return null;
  const ending = timeCodes.find((code) => code.type === 'ending');
  const fallback = Math.max(0, durationSeconds - FALLBACK_BEFORE_END_S);
  // Uma marca fora do vídeo (dado estranho) não pode esconder a chamada.
  if (!ending || ending.startOffsetMs <= 0) return fallback;
  return Math.min(ending.startOffsetMs / 1000, fallback);
}
