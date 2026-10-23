import type { PlayerControl } from './messages';

/**
 * Todos os seletores do DOM da Netflix ficam aqui. Quando a Netflix mudar o
 * HTML, este é o único arquivo a ajustar.
 *
 * Os botões do player são achados pelo atributo `data-uia`, que é mais
 * estável que as classes CSS geradas pelo site.
 */
export const SELECTORS = {
  video: 'video',
  /** Elemento que o Nomad Mode remove da página. */
  nomad: '.netflix-sans-font-loaded',
} as const;

/** `data-uia` de cada controle. Quando há mais de um, vale o primeiro presente. */
export const CONTROL_UIA = {
  back10: ['control-back10'],
  forward10: ['control-forward10'],
  next: ['control-next'],
  episodes: ['control-episodes'],
  audioSubtitles: ['control-audio-subtitle'],
  exit: ['control-nav-back'],
  skip: ['player-skip-intro', 'player-skip-recap'],
} as const satisfies Record<PlayerControl, readonly string[]>;

export function findVideo(root: ParentNode = document): HTMLVideoElement | null {
  return root.querySelector<HTMLVideoElement>(SELECTORS.video);
}

export function findNomadTarget(root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(SELECTORS.nomad);
}

export function findControl(
  control: PlayerControl,
  root: ParentNode = document,
): HTMLElement | null {
  for (const uia of CONTROL_UIA[control]) {
    const element = root.querySelector<HTMLElement>(`[data-uia="${uia}"]`);
    if (element) return element;
  }
  return null;
}
