import path from 'node:path';
import { chromium, test as base, type BrowserContext, type Page } from '@playwright/test';
import type { Browser, browser } from 'wxt/browser';

/** `chrome` dentro do service worker da extensão (onde roda `worker.evaluate`). */
type ExtensionGlobal = typeof globalThis & { chrome: typeof browser };

const EXTENSION_PATH = path.resolve('.output/chrome-mv3');

/**
 * Página que imita o essencial de /watch: um <video> tocável, o botão
 * "Pular abertura" e uma barra de controles que só aparece depois de um
 * mousemove, como na Netflix. Cliques nos botões ficam em `window.clicks`.
 * O vídeo vem de um canvas, então o teste não depende de rede nem de conta.
 * Em /watch/filme não há "Próximo episódio". O `#nomad` é o elemento que o
 * Nomad Mode remove.
 */
const WATCH_PAGE = `<!doctype html>
<html><body>
<video width="320" height="180"></video>
<div id="overlay"></div>
<div id="nomad" class="netflix-sans-font-loaded"></div>
<script>
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  setInterval(() => {
    ctx.fillStyle = 'hsl(' + (Date.now() / 10) % 360 + ' 80% 50%)';
    ctx.fillRect(0, 0, 320, 180);
  }, 50);
  document.querySelector('video').srcObject = canvas.captureStream(30);

  window.clicks = [];
  function button(uia) {
    const el = document.createElement('button');
    el.dataset.uia = uia;
    el.textContent = uia;
    el.addEventListener('click', () => window.clicks.push(uia));
    return el;
  }

  document.getElementById('overlay').append(button('player-skip-intro'));

  const isMovie = location.pathname.includes('filme');
  const controls = ['control-back10', 'control-forward10', 'control-episodes',
    'control-audio-subtitle', 'control-nav-back'];
  if (!isMovie) controls.push('control-next');

  let bar = null;
  let hideTimer;
  document.addEventListener('mousemove', () => {
    if (!bar) {
      bar = document.createElement('div');
      bar.append(...controls.map(button));
      document.body.append(bar);
    }
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { bar.remove(); bar = null; }, 3000);
  });
</script>
</body></html>`;

const BROWSE_PAGE = `<!doctype html>
<html><body>
<h1>Catálogo</h1>
<div id="nomad" class="netflix-sans-font-loaded"></div>
</body></html>`;

interface Fixtures {
  context: BrowserContext;
  extensionId: string;
  /** Consulta `tabs.query` pelo service worker e devolve o id da primeira aba. */
  findTabId: (query: Browser.tabs.QueryInfo) => Promise<number>;
  /** Abre uma página "da Netflix" servida localmente e devolve o id da aba. */
  openNetflix: (pathname: string) => Promise<{ page: Page; tabId: number }>;
  /** Abre o popup apontando para uma aba específica. */
  openPopup: (tabId: number) => Promise<Page>;
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright exige desestruturação
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--autoplay-policy=no-user-gesture-required',
      ],
    });
    await context.route('https://www.netflix.com/**', (route) => {
      const { pathname } = new URL(route.request().url());
      return route.fulfill({
        contentType: 'text/html',
        body: pathname.startsWith('/watch') ? WATCH_PAGE : BROWSE_PAGE,
      });
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(new URL(worker.url()).host);
  },

  findTabId: async ({ context, extensionId }, use) => {
    await use(async (query) => {
      const worker = context
        .serviceWorkers()
        .find((sw) => sw.url().startsWith(`chrome-extension://${extensionId}/`));
      if (!worker) throw new Error('Service worker da extensão não encontrado');
      const tabId = await worker.evaluate(async (q) => {
        const { chrome } = globalThis as ExtensionGlobal;
        return (await chrome.tabs.query(q))[0]?.id;
      }, query);
      if (tabId === undefined) throw new Error(`Nenhuma aba para ${JSON.stringify(query)}`);
      return tabId;
    });
  },

  openNetflix: async ({ context, findTabId }, use) => {
    await use(async (pathname) => {
      const page = await context.newPage();
      const url = `https://www.netflix.com${pathname}`;
      await page.goto(url);
      return { page, tabId: await findTabId({ url }) };
    });
  },

  openPopup: async ({ context, extensionId }, use) => {
    await use(async (tabId) => {
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${String(tabId)}`);
      return popup;
    });
  },
});

export const expect = test.expect;
