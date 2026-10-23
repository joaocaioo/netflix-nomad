import { describe, expect, it } from 'vitest';
import { findSkip } from '@/lib/skip';

/** Marcas como as que a Netflix devolve num episódio com recapitulação. */
const TIME_CODES = [
  { type: 'start', startOffsetMs: 66316, endOffsetMs: 66316 },
  { type: 'ending', startOffsetMs: 2494116, endOffsetMs: 2494116 },
  { type: 'recap', startOffsetMs: 0, endOffsetMs: 64147 },
];

describe('findSkip', () => {
  it('dentro da recapitulação, pula para o fim dela', () => {
    expect(findSkip(TIME_CODES, 30000)).toEqual({ kind: 'recap', targetMs: 64147 });
  });

  it('entre a recapitulação e o início, pula a abertura', () => {
    expect(findSkip(TIME_CODES, 65000)).toEqual({ kind: 'intro', targetMs: 66316 });
  });

  it('abertura marcada como intervalo', () => {
    const intro = [{ type: 'intro', startOffsetMs: 120000, endOffsetMs: 180000 }];
    expect(findSkip(intro, 150000)).toEqual({ kind: 'intro', targetMs: 180000 });
    expect(findSkip(intro, 100000)).toBeNull();
  });

  it('depois do início, nos créditos ou sem marcas não há o que pular', () => {
    expect(findSkip(TIME_CODES, 220000)).toBeNull();
    expect(findSkip(TIME_CODES, 2500000)).toBeNull();
    expect(findSkip([], 0)).toBeNull();
  });
});
