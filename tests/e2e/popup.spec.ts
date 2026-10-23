import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

function videoState(page: Page) {
  return page.evaluate(() => {
    const video = document.querySelector('video');
    if (!video) throw new Error('sem <video>');
    return {
      paused: video.paused,
      muted: video.muted,
      volume: video.volume,
      playbackRate: video.playbackRate,
    };
  });
}

test('reproduz e pausa o vídeo', async ({ openNetflix, openPopup }) => {
  const { page, tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);
  const button = popup.getByTestId('toggle-play');

  await expect(button).toHaveText('Reproduzir');
  await button.click();
  await expect(button).toHaveText('Pausar');
  expect((await videoState(page)).paused).toBe(false);

  await button.click();
  await expect(button).toHaveText('Reproduzir');
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

test('ajusta o volume e desabilita o botão no limite', async ({ openNetflix, openPopup }) => {
  const { page, tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);

  await expect(popup.getByTestId('volume')).toHaveText('100%');
  await expect(popup.getByTestId('volume-up')).toBeDisabled();

  await popup.getByTestId('volume-down').click();
  await expect(popup.getByTestId('volume')).toHaveText('90%');
  expect((await videoState(page)).volume).toBeCloseTo(0.9);
  await expect(popup.getByTestId('volume-up')).toBeEnabled();
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

function apiCalls(page: Page) {
  return page.evaluate(() => (window as unknown as { apiCalls: string[] }).apiCalls);
}

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
  await expect.poll(() => apiCalls(page)).toEqual(['seek:40000', 'seek:30000', 'seek:60000']);
  await expect(popup.getByRole('alert')).toHaveCount(0);
});

test('troca áudio e legendas', async ({ openNetflix, openPopup }) => {
  const { page, tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);

  await expect(popup.getByTestId('audio-track')).toHaveValue('A:en');
  await expect(popup.getByTestId('text-track')).toHaveValue('T:pt');

  await popup.getByTestId('audio-track').selectOption('A:pt');
  await popup.getByTestId('text-track').selectOption('T:off');

  await expect.poll(() => apiCalls(page)).toEqual(['audio:A:pt', 'text:T:off']);
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
  // O Chrome ignora playbackRate em vídeos com MediaStream (o canvas da
  // página de teste). A Netflix usa MSE, onde funciona; aqui o stream sai.
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) video.srcObject = null;
  });
  const popup = await openPopup(tabId);

  await expect(popup.getByTestId('speed-1')).toHaveAttribute('aria-pressed', 'true');
  await popup.getByTestId('speed-1.5').click();
  await expect(popup.getByTestId('speed-1.5')).toHaveAttribute('aria-pressed', 'true');
  expect((await videoState(page)).playbackRate).toBe(1.5);
});

test('o tempo avança sozinho enquanto o vídeo toca', async ({ openNetflix, openPopup }) => {
  const { tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);

  await popup.getByTestId('toggle-play').click();
  const times = popup.getByTestId('progress').locator('span').first();
  await expect(times).not.toHaveText('0:00', { timeout: 5000 });
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
