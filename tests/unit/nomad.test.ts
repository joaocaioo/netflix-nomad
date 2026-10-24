// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { enterNomadMode } from '@/lib/nomad';

afterEach(() => {
  document.body.replaceChildren();
});

describe('enterNomadMode', () => {
  it('remove o elemento do Nomad Mode da página', () => {
    const target = document.createElement('div');
    target.className = 'netflix-sans-font-loaded';
    document.body.append(target);

    expect(enterNomadMode()).toBe(true);
    expect(target.isConnected).toBe(false);
  });

  it('devolve false quando o elemento não existe', () => {
    expect(enterNomadMode()).toBe(false);
  });
});
