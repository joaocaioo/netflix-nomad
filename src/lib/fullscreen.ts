import type { Browser } from 'wxt/browser';

type WindowState = `${Browser.windows.WindowState}`;

/** Parte de `browser.windows` usada aqui. Permite testar sem navegador. */
export interface WindowsApi {
  get(windowId: number): Promise<{ state?: WindowState }>;
  update(windowId: number, info: { state: WindowState }): Promise<unknown>;
}

/**
 * Tela cheia da janela do navegador. `video.requestFullscreen()` não serve:
 * exige um gesto do usuário na página, e o clique no popup não conta. Na
 * página /watch o player já ocupa a janela inteira.
 *
 * A tela cheia da janela não sai com Esc sozinha, por isso o content script
 * avisa quando a tecla é apertada. Ao sair, a janela volta ao estado de
 * antes; se o service worker reiniciou e esqueceu, volta maximizada.
 */
export function createFullscreen(windows: WindowsApi) {
  const previous = new Map<number, WindowState>();

  async function exit(windowId: number): Promise<void> {
    const { state } = await windows.get(windowId);
    if (state !== 'fullscreen') return;
    await windows.update(windowId, { state: previous.get(windowId) ?? 'maximized' });
    previous.delete(windowId);
  }

  async function enter(windowId: number): Promise<void> {
    const { state } = await windows.get(windowId);
    if (state === 'fullscreen') {
      // Quem pediu vê a janela fora da tela cheia, mas o Chrome diz que ela
      // está: o estado ficou desatualizado. Sai e entra de novo.
      await windows.update(windowId, { state: 'maximized' });
    } else {
      previous.set(windowId, state ?? 'normal');
    }
    await windows.update(windowId, { state: 'fullscreen' });
  }

  return { enter, exit };
}
