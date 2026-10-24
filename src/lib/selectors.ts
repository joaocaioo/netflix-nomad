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
  /** Camada das legendas, que sobe quando o HUD aparece (ver `subtitles.ts`). */
  subtitles: '.player-timedtext',
  /** O que conta como controle da própria Netflix sob o HUD. */
  pageControl: 'button, a[href], input, select, textarea, [role="button"], [role="link"]',
} as const;

export function findVideo(root: ParentNode = document): HTMLVideoElement | null {
  return root.querySelector<HTMLVideoElement>(SELECTORS.video);
}

export function findNomadTarget(root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(SELECTORS.nomad);
}

/**
 * Controle da Netflix (botão, link...) sob o ponto, ignorando `exclude` (o
 * HUD, que fica por cima de tudo). Serve para o clique no vídeo não engolir
 * o clique numa janela da Netflix, como "Você ainda está assistindo?".
 */
export function findPageControlAt(x: number, y: number, exclude: Element): HTMLElement | null {
  for (const element of document.elementsFromPoint(x, y)) {
    if (element === exclude || exclude.contains(element)) continue;
    const control = element.closest<HTMLElement>(SELECTORS.pageControl);
    if (control) return control;
  }
  return null;
}
