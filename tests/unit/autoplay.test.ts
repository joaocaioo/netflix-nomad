import { describe, expect, it } from 'vitest';
import { creditsStart } from '@/lib/autoplay';

describe('creditsStart', () => {
  const ending = { type: 'ending', startOffsetMs: 2494116, endOffsetMs: 2494116 };

  it('começa na marca de créditos da Netflix', () => {
    expect(creditsStart([ending], 2618)).toBeCloseTo(2494.116);
  });

  it('sem marca, perto do fim do vídeo', () => {
    expect(creditsStart([], 1200)).toBe(1190);
  });

  it('marca nos últimos segundos ainda deixa tempo para a contagem', () => {
    expect(creditsStart([{ ...ending, startOffsetMs: 1198000 }], 1200)).toBe(1190);
  });

  it('ignora marca inválida e espera a duração', () => {
    expect(creditsStart([{ ...ending, startOffsetMs: 0 }], 1200)).toBe(1190);
    expect(creditsStart([ending], 0)).toBeNull();
  });
});
