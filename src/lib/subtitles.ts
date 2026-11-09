import { addPageStyle, setPageFlag } from './page-style';
import { SELECTORS } from './selectors';

/** Atributo no `<html>` que liga o deslocamento da legenda. */
const ATTRIBUTE = 'data-netflix-nomad-hud';

/** Quanto a legenda sobe, para não ficar sob a linha do tempo do HUD. */
const LIFT_PX = 80;

/**
 * Regra de CSS na página, e não estilo direto no elemento: a Netflix recria
 * e reescreve a camada da legenda a cada fala, o que apagaria o estilo e
 * faria a legenda pular. A regra vale para toda legenda nova, já na posição
 * certa, e só anima quando o HUD aparece ou some.
 */
const CSS = `
html[${ATTRIBUTE}] ${SELECTORS.subtitles} {
  transform: translateY(-${String(LIFT_PX)}px) !important;
}
${SELECTORS.subtitles} {
  transition: transform 0.3s ease;
}`;

export function installSubtitleLift(): void {
  addPageStyle(CSS);
}

export function setSubtitleLift(lifted: boolean): void {
  setPageFlag(ATTRIBUTE, lifted);
}
