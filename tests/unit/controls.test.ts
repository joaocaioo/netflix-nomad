// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pressControl } from '@/lib/controls';
import { findControl } from '@/lib/selectors';

function addButton(uia: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.dataset.uia = uia;
  document.body.append(button);
  return button;
}

function addVideo(): HTMLVideoElement {
  const video = document.createElement('video');
  document.body.append(video);
  return video;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('findControl', () => {
  it('acha o botão pelo data-uia', () => {
    const button = addButton('control-forward10');
    expect(findControl('forward10')).toBe(button);
  });

  it('"skip" serve tanto para abertura quanto para recapitulação', () => {
    const recap = addButton('player-skip-recap');
    expect(findControl('skip')).toBe(recap);
  });
});

describe('pressControl', () => {
  it('clica no botão quando ele já está visível', async () => {
    const button = addButton('control-back10');
    const onClick = vi.fn();
    button.addEventListener('click', onClick);

    await expect(pressControl('back10', addVideo())).resolves.toBe(true);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('acorda a barra de controles com mousemove e espera o botão aparecer', async () => {
    const video = addVideo();
    const onClick = vi.fn();
    // Simula a Netflix: os controles só entram no DOM depois de mexer o mouse.
    document.addEventListener(
      'mousemove',
      () => {
        setTimeout(() => {
          addButton('control-next').addEventListener('click', onClick);
        }, 20);
      },
      { once: true },
    );

    await expect(pressControl('next', video)).resolves.toBe(true);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('desiste depois do timeout quando o botão não existe', async () => {
    await expect(pressControl('episodes', addVideo(), 50)).resolves.toBe(false);
  });
});
