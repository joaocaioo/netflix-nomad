import { expect, test } from './fixtures';
import { apiCalls, videoState } from './helpers';

test('reproduz e pausa o vídeo', async ({ openNetflix, openPopup }) => {
  const { page, tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);
  const button = popup.getByTestId('toggle-play');

  await expect(button).toHaveAccessibleName('Reproduzir');
  await button.click();
  await expect(button).toHaveAccessibleName('Pausar');
  expect((await videoState(page)).paused).toBe(false);

  await button.click();
  await expect(button).toHaveAccessibleName('Reproduzir');
  expect((await videoState(page)).paused).toBe(true);
});

test('o estado do mudo vem da página e sobrevive a reabrir o popup', async ({
  openNetflix,
  openPopup,
}) => {
  const { page, tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);

  await popup.getByTestId('toggle-mute').click();
  await expect(popup.getByTestId('toggle-mute')).toHaveAttribute('aria-pressed', 'true');
  expect((await videoState(page)).muted).toBe(true);

  // O estado vem do vídeo, então reabrir o popup não perde o mudo.
  await popup.close();
  const reopened = await openPopup(tabId);
  await expect(reopened.getByTestId('toggle-mute')).toHaveAttribute('aria-pressed', 'true');

  await reopened.getByTestId('toggle-mute').click();
  expect((await videoState(page)).muted).toBe(false);
});

test('ajusta o volume pelo controle deslizante', async ({ openNetflix, openPopup }) => {
  const { page, tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);

  await expect(popup.getByTestId('volume-value')).toHaveText('100%');
  await popup.getByTestId('volume').fill('0.4');
  await expect(popup.getByTestId('volume-value')).toHaveText('40%');
  expect((await videoState(page)).volume).toBeCloseTo(0.4);

  // Zero é mudo.
  await popup.getByTestId('volume').fill('0');
  await expect(popup.getByTestId('volume-value')).toHaveText('Mudo');
  await expect(popup.getByTestId('toggle-mute')).toHaveAttribute('aria-pressed', 'true');
});

test('avisa quando a aba não é da Netflix', async ({ context, findTabId, openPopup }) => {
  await context.route('https://example.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<video></video>' }),
  );
  const other = await context.newPage();
  await other.goto('https://example.com/');
  await other.bringToFront();
  // Sem permissão de host para example.com, a URL da aba não é visível;
  // por isso a busca é pela aba ativa.
  const tabId = await findTabId({ active: true, lastFocusedWindow: true });
  const popup = await openPopup(tabId);

  await expect(popup.getByRole('alert')).toContainText('Abra uma aba da Netflix');
  await expect(popup.getByTestId('empty-action')).toHaveText('Abrir a Netflix');
  await expect(popup.getByTestId('toggle-play')).toHaveCount(0);
});

test('fora do player não mostra os controles, nem com trailer tocando', async ({
  openNetflix,
  openPopup,
}) => {
  const { tabId } = await openNetflix('/browse');
  const popup = await openPopup(tabId);

  await expect(popup.getByRole('alert')).toContainText('Abra um filme ou episódio');
  await expect(popup.getByTestId('toggle-play')).toHaveCount(0);
  await expect(popup.getByTestId('nomad-mode')).toBeEnabled();
});

test('avança, volta e pula a abertura pela API do player', async ({ openNetflix, openPopup }) => {
  const { page, tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);

  // A API falsa começa em 30s e o <video> nos primeiros segundos: os dois
  // estão na recapitulação (0–60s), então o botão de pular aparece.
  await popup.getByTestId('forward10').click();
  await expect.poll(() => apiCalls(page)).toEqual(['seek:40000']);
  await popup.getByTestId('back10').click();
  await expect.poll(() => apiCalls(page)).toEqual(['seek:40000', 'seek:30000']);
  await expect(popup.getByTestId('skip')).toHaveText('Pular recapitulação');
  await popup.getByTestId('skip').click();
  // A recapitulação (0–60 s) e o início do episódio (65 s) vão juntos num clique.
  await expect.poll(() => apiCalls(page)).toEqual(['seek:40000', 'seek:30000', 'seek:65000']);
  await expect(popup.getByRole('alert')).toHaveCount(0);
});

test('troca áudio e legendas', async ({ openNetflix, openPopup }) => {
  const { page, tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);

  await expect(popup.getByTestId('audio-track')).toHaveValue('A:en');
  await expect(popup.getByTestId('text-track')).toHaveValue('T:pt');

  await popup.getByTestId('audio-track').selectOption('A:pt');
  await popup.getByTestId('text-track').selectOption('T:off');

  // Depois de trocar o áudio, um seek no ponto atual (30 s) ressincroniza.
  await expect.poll(() => apiCalls(page)).toEqual(['audio:A:pt', 'seek:30000', 'text:T:off']);
  await expect(popup.getByTestId('audio-track')).toHaveValue('A:pt');
  await expect(popup.getByTestId('text-track')).toHaveValue('T:off');
});

test('vai para o próximo episódio e o popup reconecta', async ({ openNetflix, openPopup }) => {
  const { page, tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);

  await expect(popup.getByTestId('episode')).toHaveValue('1');
  await popup.getByTestId('next').click();

  await expect(page).toHaveURL(/\/watch\/2$/);
  await expect(popup.getByTestId('episode')).toHaveValue('2', { timeout: 10_000 });
  // O episódio 2 é o último da temporada.
  await expect(popup.getByTestId('next')).toBeDisabled();
});

test('escolhe um episódio na lista', async ({ openNetflix, openPopup }) => {
  const { page, tabId } = await openNetflix('/watch/2');
  const popup = await openPopup(tabId);

  await popup.getByTestId('episode').selectOption('1');

  await expect(page).toHaveURL(/\/watch\/1$/);
  await expect(popup.getByTestId('episode')).toHaveValue('1', { timeout: 10_000 });
});

test('sair do título volta para o catálogo', async ({ openNetflix, openPopup }) => {
  const { page, tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);

  await popup.getByTestId('exit').click();

  await expect(page).toHaveURL(/\/browse$/);
});

test('filme não tem episódios nem botão de pular', async ({ openNetflix, openPopup }) => {
  const { page, tabId } = await openNetflix('/watch/filme');
  const popup = await openPopup(tabId);

  // Filme: sem episódios e sem abertura marcada, então nem aparece "Pular".
  await expect(popup.getByTestId('toggle-play')).toBeVisible();
  await expect(popup.getByTestId('next')).toBeDisabled();
  await expect(popup.getByTestId('episode')).toHaveCount(0);
  await expect(popup.getByTestId('skip')).toHaveCount(0);
  expect(await apiCalls(page)).toEqual([]);
});

test('muda a velocidade', async ({ openNetflix, openPopup }) => {
  const { page, tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);

  await expect(popup.getByTestId('speed')).toHaveValue('1');
  await popup.getByTestId('speed').selectOption('1.5');
  await expect(popup.getByTestId('speed')).toHaveValue('1.5');
  expect((await videoState(page)).playbackRate).toBe(1.5);
});

test('episódio anterior: desabilitado no primeiro, navega a partir do segundo', async ({
  openNetflix,
  openPopup,
}) => {
  const first = await openNetflix('/watch/1');
  const popup = await openPopup(first.tabId);
  await expect(popup.getByTestId('episode')).toHaveValue('1');
  await expect(popup.getByTestId('previous')).toBeDisabled();

  const second = await openNetflix('/watch/2');
  const popup2 = await openPopup(second.tabId);
  await expect(popup2.getByTestId('previous')).toBeEnabled();
  await popup2.getByTestId('previous').click();
  await expect(second.page).toHaveURL(/\/watch\/1$/);
});

test('o tempo avança sozinho enquanto o vídeo toca', async ({ openNetflix, openPopup }) => {
  const { tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);

  await popup.getByTestId('toggle-play').click();
  const times = popup.getByTestId('timeline').locator('.timeline__times span').first();
  // O áudio gerado demora a começar quando vários testes rodam juntos.
  await expect(times).not.toHaveText('0:00', { timeout: 10_000 });
});

test('Nomad Mode remove o elemento da página', async ({ openNetflix, openPopup }) => {
  const { page, tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);

  await expect(page.locator('#nomad')).toHaveCount(1);
  await popup.getByTestId('nomad-mode').click();
  await expect(page.locator('#nomad')).toHaveCount(0);
  await expect(popup.getByRole('alert')).toHaveCount(0);

  // Sem o elemento, um segundo clique só avisa.
  await popup.getByTestId('nomad-mode').click();
  await expect(popup.getByTestId('nomad-error')).toContainText('Nada para o Nomad Mode remover');
});

test('Nomad Mode funciona em páginas da Netflix sem vídeo', async ({ openNetflix, openPopup }) => {
  const { page, tabId } = await openNetflix('/browse');
  const popup = await openPopup(tabId);

  // O popup avisa que não há vídeo, mas o Nomad Mode continua ativo.
  await expect(popup.getByRole('alert')).toContainText('Abra um filme ou episódio');
  await expect(popup.getByTestId('nomad-mode')).toBeEnabled();

  await popup.getByTestId('nomad-mode').click();
  await expect(page.locator('#nomad')).toHaveCount(0);
  await expect(popup.getByTestId('nomad-error')).toHaveCount(0);
});

test('Nomad Mode fora da Netflix avisa em vez de agir', async ({
  context,
  findTabId,
  openPopup,
}) => {
  await context.route('https://example.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>outro site</p>' }),
  );
  const other = await context.newPage();
  await other.goto('https://example.com/');
  await other.bringToFront();
  const tabId = await findTabId({ active: true, lastFocusedWindow: true });
  const popup = await openPopup(tabId);

  await expect(popup.getByTestId('nomad-mode')).toBeEnabled();
  await popup.getByTestId('nomad-mode').click();
  await expect(popup.getByTestId('nomad-error')).toContainText('Abra uma aba da Netflix');
});

test('clicar na linha do tempo do popup leva o vídeo para lá', async ({
  openNetflix,
  openPopup,
}) => {
  const { page, tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);
  const timeline = popup.getByRole('slider', { name: 'Linha do tempo' });

  // Duração de 20 min: o meio da linha é 10 min.
  await timeline.hover();
  await expect(popup.getByTestId('timeline-tooltip')).toHaveText('10:00');
  await timeline.click();

  await expect.poll(() => apiCalls(page)).toEqual(['seek:600000']);
});

test('tela cheia pelo popup sai com Esc na página', async ({
  openNetflix,
  openPopup,
  windowState,
}) => {
  const { page, tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);

  await popup.getByTestId('fullscreen').click();
  await expect.poll(() => windowState(tabId)).toBe('fullscreen');

  await page.keyboard.press('Escape');
  await expect.poll(() => windowState(tabId)).not.toBe('fullscreen');
});

test('popup sem a API da Netflix avisa sem quebrar', async ({ openNetflix, openPopup }) => {
  const { page, tabId } = await openNetflix('/watch/sem-api');
  const popup = await openPopup(tabId);

  // Sem metadados: nada de título, episódios ou faixas, mas os controles ficam.
  await expect(popup.getByTestId('toggle-play')).toBeVisible();
  await expect(popup.getByTestId('audio-track')).toHaveCount(0);
  await popup.getByTestId('back10').click();
  await expect(popup.getByRole('alert')).toContainText('não está disponível');

  await popup.getByTestId('toggle-play').click();
  await expect.poll(async () => (await videoState(page)).paused).toBe(false);
});

test('"Abrir a Netflix" leva para uma aba da Netflix já aberta', async ({
  context,
  findTabId,
  openNetflix,
  openPopup,
}) => {
  const { page: netflix } = await openNetflix('/browse');
  await context.route('https://example.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>outro site</p>' }),
  );
  const other = await context.newPage();
  await other.goto('https://example.com/');
  await other.bringToFront();
  const popup = await openPopup(await findTabId({ active: true, lastFocusedWindow: true }));

  await popup.getByTestId('empty-action').click();
  await expect.poll(() => netflix.evaluate(() => document.visibilityState)).toBe('visible');
  expect(context.pages().filter((p) => p.url().includes('netflix.com'))).toHaveLength(1);
});
