import { describe, expect, it } from 'vitest';
import { formatTime, pointerRatio } from '@/lib/time';

describe('formatTime', () => {
  it.each([
    [0, '0:00'],
    [9.9, '0:09'],
    [65, '1:05'],
    [3599, '59:59'],
    [3600, '1:00:00'],
    [5025, '1:23:45'],
    [-3, '0:00'],
  ])('formatTime(%d) = %s', (seconds, expected) => {
    expect(formatTime(seconds)).toBe(expected);
  });
});

describe('pointerRatio', () => {
  it.each([
    [100, 0],
    [150, 0.25],
    [200, 0.5],
    [300, 1],
    [50, 0],
    [400, 1],
  ])('clientX %d numa barra de 100 a 300 = %d', (clientX, expected) => {
    expect(pointerRatio(clientX, 100, 200)).toBe(expected);
  });

  it('barra sem largura vale 0', () => {
    expect(pointerRatio(10, 0, 0)).toBe(0);
  });
});
