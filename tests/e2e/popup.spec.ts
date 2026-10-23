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

test('avisa quando a página da Netflix não tem vídeo', async ({ openNetflix, openPopup }) => {
  const { tabId } = await openNetflix('/browse');
  const popup = await openPopup(tabId);

  await expect(popup.getByRole('alert')).toContainText('Nenhum vídeo encontrado');
});

function clicks(page: Page) {
  return page.evaluate(() => (window as unknown as { clicks: string[] }).clicks);
}

test('aciona botões do player mesmo com a barra de controles escondida', async ({
  openNetflix,
  openPopup,
}) => {
  const { page, tabId } = await openNetflix('/watch/1');
  const popup = await openPopup(tabId);

  await popup.getByTestId('forward10').click();
  await popup.getByTestId('back10').click();
  await popup.getByTestId('next').click();
  await popup.getByTestId('episodes').click();
  await popup.getByTestId('audio-subtitles').click();
  await popup.getByTestId('skip').click();
  await popup.getByTestId('exit').click();

  await expect
    .poll(() => clicks(page))
    .toEqual([
      'control-forward10',
      'control-back10',
      'control-next',
      'control-episodes',
      'control-audio-subtitle',
      'player-skip-intro',
      'control-nav-back',
    ]);
  await expect(popup.getByRole('alert')).toHaveCount(0);
});

test('avisa quando o controle não existe no título', async ({ openNetflix, openPopup }) => {
  const { page, tabId } = await openNetflix('/watch/filme');
  const popup = await openPopup(tabId);

  await popup.getByTestId('next').click();

  await expect(popup.getByRole('alert')).toContainText('não está disponível');
  // O aviso não derruba os outros controles.
  await expect(popup.getByTestId('toggle-play')).toBeVisible();
  expect(await clicks(page)).toEqual([]);
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
