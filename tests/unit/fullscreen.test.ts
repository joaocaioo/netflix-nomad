import { describe, expect, it, vi } from 'vitest';
import { createFullscreen, type WindowsApi } from '@/lib/fullscreen';

/** Janela falsa: guarda o estado e registra as mudanças. */
function fakeWindows(initial: 'normal' | 'maximized' | 'fullscreen') {
  let state = initial;
  const update = vi.fn((_id: number, info: { state: typeof state }) => {
    state = info.state;
    return Promise.resolve();
  });
  const windows: WindowsApi = {
    get: () => Promise.resolve({ state }),
    update,
  };
  return { windows, update, current: () => state };
}

describe('createFullscreen', () => {
  it('entra em tela cheia e volta ao estado de antes', async () => {
    const fake = fakeWindows('normal');
    const fullscreen = createFullscreen(fake.windows);

    await fullscreen.enter(1);
    expect(fake.current()).toBe('fullscreen');
    await fullscreen.exit(1);
    expect(fake.current()).toBe('normal');
  });

  it('volta maximizada quando estava maximizada', async () => {
    const fake = fakeWindows('maximized');
    const fullscreen = createFullscreen(fake.windows);

    await fullscreen.enter(1);
    await fullscreen.exit(1);
    expect(fake.current()).toBe('maximized');
  });

  it('entra mesmo quando o Chrome já diz que está em tela cheia', async () => {
    // Estado desatualizado: quem pediu vê a janela fora da tela cheia.
    const fake = fakeWindows('fullscreen');
    await createFullscreen(fake.windows).enter(1);
    expect(fake.update.mock.calls.map(([, info]) => info.state)).toEqual([
      'maximized',
      'fullscreen',
    ]);
  });

  it('exit fora da tela cheia não mexe na janela', async () => {
    const fake = fakeWindows('normal');
    await createFullscreen(fake.windows).exit(1);
    expect(fake.update).not.toHaveBeenCalled();
  });

  it('sem lembrar o estado anterior, volta maximizada', async () => {
    // Tela cheia de antes do service worker reiniciar.
    const fake = fakeWindows('fullscreen');
    await createFullscreen(fake.windows).exit(1);
    expect(fake.current()).toBe('maximized');
  });
});
