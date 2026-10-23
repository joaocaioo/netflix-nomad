import type { TimeCode } from './messages';

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
  if (range) {
    return { kind: range.type === 'recap' ? 'recap' : 'intro', targetMs: range.endOffsetMs };
  }
  const start = timeCodes.find((code) => code.type === 'start');
  if (start && nowMs < start.startOffsetMs) return { kind: 'intro', targetMs: start.startOffsetMs };
  return null;
}
