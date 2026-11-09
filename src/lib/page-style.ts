/**
 * Põe uma regra de CSS na própria página da Netflix (fora do Shadow DOM do
 * HUD). As regras ficam presas a um atributo no `<html>`: ligar e desligar
 * é só trocar o atributo, e vale também para elementos que a Netflix recria.
 */
export function addPageStyle(css: string): void {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  } catch {
    // Firefox não aceita, na página, folhas criadas pelo content script.
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
  }
}

export function setPageFlag(attribute: string, on: boolean): void {
  document.documentElement.toggleAttribute(attribute, on);
}
