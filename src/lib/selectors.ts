/**
 * Todos os seletores do DOM da Netflix ficam aqui. Quando a Netflix mudar o
 * HTML, este é o único arquivo a ajustar. Os controles do player não usam
 * o DOM: a barra de controles nem sempre existe, então a extensão fala com a
 * API interna do player (ver `netflix-api.ts`).
 */
export const SELECTORS = {
  video: 'video',
  /** Elemento que o Nomad Mode remove da página. */
  nomad: '.netflix-sans-font-loaded',
} as const;

export function findVideo(root: ParentNode = document): HTMLVideoElement | null {
  return root.querySelector<HTMLVideoElement>(SELECTORS.video);
}

export function findNomadTarget(root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(SELECTORS.nomad);
}
