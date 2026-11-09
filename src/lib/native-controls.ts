import { addPageStyle, setPageFlag } from './page-style';
import { SELECTORS } from './selectors';

/** Atributo no `<html>` presente enquanto o HUD da extensão está no player. */
const ATTRIBUTE = 'data-netflix-nomad-active';

/**
 * Esconde a barra, o "Pular abertura", o "Próximo episódio" e a tela de
 * pausa da própria Netflix, que o HUD substitui. Só CSS: a Netflix continua
 * funcionando por baixo e tudo volta ao desligar a extensão. Avisos que
 * pedem resposta ("Você ainda está assistindo?", erros) não entram aqui.
 * `:is()` ignora um seletor inválido sem derrubar os outros.
 */
const CSS = `
html[${ATTRIBUTE}] :is(${SELECTORS.nativeControls.join(', ')}) {
  display: none !important;
}`;

export function installNativeControlsHiding(): void {
  addPageStyle(CSS);
}

export function setNativeControlsHidden(hidden: boolean): void {
  setPageFlag(ATTRIBUTE, hidden);
}
