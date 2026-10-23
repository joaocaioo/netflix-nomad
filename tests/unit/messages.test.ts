import { describe, expect, it } from 'vitest';
import { isPlayerCommand } from '@/lib/messages';

describe('isPlayerCommand', () => {
  it.each([
    { type: 'getState' },
    { type: 'togglePlay' },
    { type: 'toggleMute' },
    { type: 'changeVolume', delta: -0.1 },
    { type: 'setSpeed', rate: 1.25 },
    { type: 'pressControl', control: 'skip' },
    { type: 'pressControl', control: 'audioSubtitles' },
  ])('aceita %j', (message) => {
    expect(isPlayerCommand(message)).toBe(true);
  });

  it.each([
    null,
    'togglePlay',
    {},
    { type: 'remove' },
    { type: 'changeVolume' },
    { type: 'changeVolume', delta: '0.1' },
    { type: 'changeVolume', delta: Number.NaN },
    { type: 'setSpeed', rate: 16 },
    { type: 'setSpeed', rate: '1' },
    { type: 'pressControl' },
    { type: 'pressControl', control: 'qualquer-coisa' },
  ])('rejeita %j', (message) => {
    expect(isPlayerCommand(message)).toBe(false);
  });
});
