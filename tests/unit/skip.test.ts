import { describe, expect, it } from 'vitest';
import { findSkip } from '@/lib/skip';

/** Marcas como as que a Netflix devolve num episódio com recapitulação. */
const TIME_CODES = [
  { type: 'start', startOffsetMs: 66316, endOffsetMs: 66316 },
  { type: 'ending', startOffsetMs: 2494116, endOffsetMs: 2494116 },
  { type: 'recap', startOffsetMs: 0, endOffsetMs: 64147 },
];

describe('findSkip', () => {
  it('dentro da recapitulação, pula ela e a abertura que vem logo depois', () => {
    // O início (66,3 s) está a 2 s do fim da recapitulação (64,1 s).
    expect(findSkip(TIME_CODES, 30000)).toEqual({ kind: 'recap', targetMs: 66316 });
  });

  it('com o início longe do fim da recapitulação, pula só a recapitulação', () => {
    const codes = [
      { type: 'recap', startOffsetMs: 0, endOffsetMs: 60000 },
      { type: 'start', startOffsetMs: 120000, endOffsetMs: 120000 },
    ];
    expect(findSkip(codes, 30000)).toEqual({ kind: 'recap', targetMs: 60000 });
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
