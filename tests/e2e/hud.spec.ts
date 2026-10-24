import { expect, test } from './fixtures';
import { apiCalls, videoState } from './helpers';

// Controles sobre o vídeo, desenhados pelo content script na página.

test('aparece com o mouse e some parado, com o vídeo tocando', async ({ openNetflix }) => {
  const { page } = await openNetflix('/watch/1');
  const hud = page.getByTestId('hud');

  await page.mouse.move(200, 200);
  await expect(hud).toHaveClass(/hud--visible/);
  // Pausado, o HUD fica na tela; tocando, some depois de 3 s sem mexer o mouse.
  await page.getByTestId('toggle-play').click();
  // Com o mouse em cima dos controles o HUD fica; tira o mouse de cima.
  await page.mouse.move(640, 360);
  await expect(hud).not.toHaveClass(/hud--visible/, { timeout: 6000 });

  await page.mouse.move(220, 220);
  await expect(hud).toHaveClass(/hud--visible/);
});

test('os controles do HUD usam a API do player', async ({ openNetflix }) => {
  const { page } = await openNetflix('/watch/1');
  await page.mouse.move(200, 200);

  await page.getByTestId('forward10').click();
  await expect.poll(() => apiCalls(page)).toEqual(['seek:40000']);

  await page.getByTestId('hud-settings').click();
  await page.getByTestId('audio-track').selectOption('A:pt');
  await expect.poll(() => apiCalls(page)).toEqual(['seek:40000', 'audio:A:pt', 'seek:40000']);

  await page.getByTestId('volume').fill('0.5');
  await expect.poll(() => videoState(page)).toMatchObject({ volume: 0.5 });
});

test('mostra título, episódio e o botão de pular', async ({ openNetflix }) => {
  const { page } = await openNetflix('/watch/1');
  await page.mouse.move(200, 200);

  await expect(page.getByTestId('hud')).toContainText('Série');
  await expect(page.getByTestId('hud')).toContainText('Temporada 1 · 1. Piloto');
  await expect(page.getByTestId('skip')).toHaveText('Pular recapitulação');
});

test('atalhos de teclado controlam o vídeo', async ({ openNetflix }) => {
  const { page } = await openNetflix('/watch/1');
  await page.mouse.move(200, 200);

  await page.keyboard.press('Space');
  await expect.poll(async () => (await videoState(page)).paused).toBe(false);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => apiCalls(page)).toEqual(['seek:40000']);
  await page.keyboard.press('m');
  await expect.poll(async () => (await videoState(page)).muted).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await videoState(page)).paused).toBe(true);
});

test('escondido, nenhum botão fica com o foco', async ({ openNetflix }) => {
  const { page } = await openNetflix('/watch/1');
  await page.mouse.move(200, 200);
  await page.getByTestId('toggle-play').click();
  await page.getByTestId('back10').click();
  await page.mouse.move(640, 360);
  await expect(page.getByTestId('hud')).not.toHaveClass(/hud--visible/, { timeout: 6000 });

  // Sem o foco preso no "−10s" escondido, o espaço pausa em vez de voltar.
  await page.keyboard.press('Space');
  await expect.poll(async () => (await videoState(page)).paused).toBe(true);
  expect(await apiCalls(page)).toEqual(['seek:20000']);
});

test('tela cheia pelo HUD entra e sai', async ({ openNetflix, windowState }) => {
  const { page, tabId } = await openNetflix('/watch/1');
  await page.mouse.move(200, 200);

  await page.getByTestId('fullscreen').click();
  await expect.poll(() => windowState(tabId)).toBe('fullscreen');
  await expect(page.getByTestId('fullscreen')).toHaveAttribute('aria-label', 'Sair da tela cheia');
  await page.getByTestId('fullscreen').click();
  await expect.poll(() => windowState(tabId)).not.toBe('fullscreen');
});

test('clicar no vídeo pausa e continua; duplo clique é tela cheia', async ({
  openNetflix,
  windowState,
}) => {
  const { page, tabId } = await openNetflix('/watch/1');
  const surface = page.getByTestId('hud-surface');

  await surface.click({ position: { x: 640, y: 300 } });
  await expect.poll(async () => (await videoState(page)).paused).toBe(false);
  await surface.click({ position: { x: 640, y: 300 } });
  await expect.poll(async () => (await videoState(page)).paused).toBe(true);

  // Os dois cliques do duplo clique se anulam: o vídeo continua pausado.
  await surface.dblclick({ position: { x: 640, y: 300 } });
  await expect.poll(() => windowState(tabId)).toBe('fullscreen');
  expect((await videoState(page)).paused).toBe(true);
});

test('um botão da Netflix sob o HUD recebe o clique, sem pausar o vídeo', async ({
  openNetflix,
}) => {
  const { page } = await openNetflix('/watch/1');
  const dialog = await page.locator('#netflix-dialog').boundingBox();
  if (!dialog) throw new Error('sem #netflix-dialog');

  await page.mouse.click(dialog.x + 10, dialog.y + 10);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { dialogClicks?: number }).dialogClicks))
    .toBe(1);
  expect((await videoState(page)).paused).toBe(true);
});

test('com o painel aberto, clicar no vídeo só fecha o painel', async ({ openNetflix }) => {
  const { page } = await openNetflix('/watch/1');
  await page.mouse.move(200, 200);
  await page.getByTestId('hud-settings').click();
  await expect(page.getByTestId('hud-panel')).toBeVisible();

  await page.getByTestId('hud-surface').click({ position: { x: 300, y: 300 } });
  await expect(page.getByTestId('hud-panel')).toHaveCount(0);
  expect((await videoState(page)).paused).toBe(true);
});

test('a legenda sobe enquanto o HUD está na tela', async ({ openNetflix }) => {
  const { page } = await openNetflix('/watch/1');
  const subtitles = page.locator('.player-timedtext');
  await page.mouse.move(200, 200);
  await expect(subtitles).toHaveCSS('transform', /matrix\(1, 0, 0, 1, 0, -80\)/);

  // Tocando e com o mouse parado, o HUD some e a legenda volta.
  await page.getByTestId('toggle-play').click();
  await page.mouse.move(640, 360);
  await expect(subtitles).toHaveCSS('transform', 'none', { timeout: 6000 });
});

test('a legenda não pula quando a Netflix recria ou reescreve a camada', async ({
  openNetflix,
}) => {
  const { page } = await openNetflix('/watch/1');
  await page.mouse.move(200, 200);
  const lifted = /matrix\(1, 0, 0, 1, 0, -80\)/;
  await expect(page.locator('.player-timedtext')).toHaveCSS('transform', lifted);

  // Como a Netflix faz a cada fala: troca o elemento e mexe no estilo dele.
  const transform = await page.evaluate(() => {
    const old = document.querySelector('.player-timedtext');
    const fresh = document.createElement('div');
    fresh.className = 'player-timedtext';
    fresh.style.transform = 'none';
    old?.replaceWith(fresh);
    return getComputedStyle(fresh).transform;
  });
  // Já nasce no lugar, sem descer e subir de novo.
  expect(transform).toMatch(lifted);
});

test('sem a API da Netflix, play continua funcionando e o resto avisa', async ({ openNetflix }) => {
  const { page } = await openNetflix('/watch/sem-api');
  await page.mouse.move(200, 200);

  await page.getByTestId('toggle-play').click();
  await expect.poll(async () => (await videoState(page)).paused).toBe(false);
  await page.getByTestId('forward10').click();
  await expect(page.getByTestId('hud').getByRole('alert')).toContainText('não está disponível');
  // Sem metadados, não há próximo episódio nem botão de pular.
  await expect(page.getByTestId('next')).toHaveCount(0);
  await expect(page.getByTestId('skip')).toHaveCount(0);
});

test('o painel tem velocidade em lista e fecha pelo mesmo botão', async ({ openNetflix }) => {
  const { page } = await openNetflix('/watch/1');
  await page.mouse.move(200, 200);
  await page.getByTestId('hud-settings').click();

  await page.getByTestId('speed').selectOption('1.25');
  await expect.poll(async () => (await videoState(page)).playbackRate).toBe(1.25);

  await page.getByTestId('hud-settings').click();
  await expect(page.getByTestId('hud-panel')).toHaveCount(0);
});

test('episódio anterior só aparece quando existe', async ({ openNetflix }) => {
  const first = await openNetflix('/watch/1');
  await first.page.mouse.move(200, 200);
  await expect(first.page.getByTestId('next')).toBeVisible();
  await expect(first.page.getByTestId('previous')).toHaveCount(0);

  const second = await openNetflix('/watch/2');
  await second.page.mouse.move(200, 200);
  await second.page.getByTestId('previous').click();
  await expect(second.page).toHaveURL(/\/watch\/1$/);
});

test('não aparece fora do player', async ({ openNetflix }) => {
  const { page } = await openNetflix('/browse');
  await page.mouse.move(200, 200);
  await expect(page.getByTestId('hud')).toHaveCount(0);
});
