import type { PlayerControl } from './messages';
import { findControl } from './selectors';

/**
 * A Netflix esconde a barra de controles quando o mouse fica parado. Um
 * `mousemove` sobre o vídeo faz a barra voltar.
 */
export function wakeControls(target: Element): void {
  const { left, top, width, height } = target.getBoundingClientRect();
  const init: MouseEventInit = {
    bubbles: true,
    clientX: left + width / 2,
    clientY: top + height / 2,
  };
  target.dispatchEvent(new PointerEvent('pointermove', init));
  target.dispatchEvent(new MouseEvent('mousemove', init));
}

/** Espera o elemento aparecer no DOM, até `timeoutMs`. */
export function waitForElement<T extends Element>(
  find: () => T | null,
  timeoutMs: number,
  root: Node = document,
): Promise<T | null> {
  const found = find();
  if (found) return Promise.resolve(found);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const element = find();
      if (element) finish(element);
    });
    const timer = setTimeout(() => {
      finish(null);
    }, timeoutMs);

    function finish(element: T | null) {
      observer.disconnect();
      clearTimeout(timer);
      resolve(element);
    }

    observer.observe(root, { childList: true, subtree: true, attributes: true });
  });
}

/**
 * Aciona um botão do player da Netflix. Usar os botões do próprio player,
 * em vez de mexer no `<video>`, evita erros como o M7375, que a Netflix
 * mostra quando `currentTime` é alterado por fora.
 */
export async function pressControl(
  control: PlayerControl,
  video: HTMLVideoElement,
  timeoutMs = 1500,
): Promise<boolean> {
  let button = findControl(control);
  if (!button) {
    wakeControls(video);
    button = await waitForElement(() => findControl(control), timeoutMs);
  }
  if (!button) return false;
  button.click();
  return true;
}
