import type { TimeCode } from './messages';

/**
 * Recapitulação seguida do início do episódio com até esse intervalo entre
 * eles: um clique pula os dois, em vez de mostrar "Pular abertura" por 2s.
 */
const CHAIN_GAP_MS = 5000;

export interface Skip {
  kind: 'recap' | 'intro';
  /** Para onde pular, em milissegundos. */
  targetMs: number;
}

/**
 * O que dá para pular agora. Recapitulação e abertura vêm como intervalos:
 * dentro de um deles, pula para o fim. Antes da marca "start", onde o
 * episódio de fato começa, pula para ela. `null` se não há o que pular.
 *
 * Usada pelo script da página, para pular, e pelo popup, para decidir se
 * mostra o botão.
 */
export function findSkip(timeCodes: TimeCode[], nowMs: number): Skip | null {
  const range = timeCodes.find(
    (code) => code.type !== 'ending' && code.startOffsetMs <= nowMs && nowMs < code.endOffsetMs,
  );
  const start = timeCodes.find((code) => code.type === 'start');
  if (range) {
    const gap = start ? start.startOffsetMs - range.endOffsetMs : -1;
    const targetMs =
      start && gap >= 0 && gap <= CHAIN_GAP_MS ? start.startOffsetMs : range.endOffsetMs;
    return { kind: range.type === 'recap' ? 'recap' : 'intro', targetMs };
  }
  if (start && nowMs < start.startOffsetMs) return { kind: 'intro', targetMs: start.startOffsetMs };
  return null;
}
