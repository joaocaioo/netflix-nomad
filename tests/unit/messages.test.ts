import { describe, expect, it } from 'vitest';
import { isNomadCommand, isPlayerCommand, isTitleCommand } from '@/lib/messages';

describe('isPlayerCommand', () => {
  it.each([
    { type: 'getState' },
    { type: 'togglePlay' },
    { type: 'toggleMute' },
    { type: 'changeVolume', delta: -0.1 },
    { type: 'setSpeed', rate: 1.25 },
    { type: 'seekBy', seconds: -10 },
    { type: 'skip' },
    { type: 'nextEpisode' },
    { type: 'playEpisode', episodeId: 82158511 },
    { type: 'setAudioTrack', trackId: 'A:2:1;2;pt-BR;0;0;0;' },
    { type: 'setTextTrack', trackId: 'T:2:1;1;NONE;0;1;0;0;' },
    { type: 'exit' },
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
    { type: 'seekBy', seconds: Infinity },
    { type: 'playEpisode', episodeId: 0 },
    { type: 'playEpisode', episodeId: 1.5 },
    { type: 'playEpisode', episodeId: '82158511' },
    { type: 'setAudioTrack' },
    { type: 'setTextTrack', trackId: '' },
    { type: 'pressControl', control: 'skip' },
    // Nomad Mode tem mensagem própria, fora dos comandos do player.
    { type: 'nomadMode' },
  ])('rejeita %j', (message) => {
    expect(isPlayerCommand(message)).toBe(false);
  });
});

describe('isNomadCommand', () => {
  it('aceita o comando do Nomad Mode', () => {
    expect(isNomadCommand({ type: 'nomadMode' })).toBe(true);
  });

  it.each([null, 'nomadMode', {}, { type: 'togglePlay' }])('rejeita %j', (message) => {
    expect(isNomadCommand(message)).toBe(false);
  });
});

describe('isTitleCommand', () => {
  it('aceita o pedido de título', () => {
    expect(isTitleCommand({ type: 'getTitle' })).toBe(true);
  });

  it.each([null, 'getTitle', { type: 'getState' }])('rejeita %j', (message) => {
    expect(isTitleCommand(message)).toBe(false);
  });
});
