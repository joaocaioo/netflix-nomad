import { describe, expect, it } from 'vitest';
import { formatTime } from '@/lib/time';

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
