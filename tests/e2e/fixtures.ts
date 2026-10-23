import path from 'node:path';
import { chromium, test as base, type BrowserContext, type Page } from '@playwright/test';
import type { Browser, browser } from 'wxt/browser';

/** `chrome` dentro do service worker da extensão (onde roda `worker.evaluate`). */
type ExtensionGlobal = typeof globalThis & { chrome: typeof browser };

const EXTENSION_PATH = path.resolve('.output/chrome-mv3');

/**
 * Página que imita o essencial de /watch: um <video> tocável e a API interna
 * do player em `window.netflix`, como na Netflix. Avanço, abertura e faixas
 * pedidos à API ficam em `window.apiCalls`. O vídeo vem de um canvas, então o teste não
 * depende de rede nem de conta.
 *
 * /watch/1 e /watch/2 são os dois episódios de uma série; /watch/filme é um
 * filme, sem episódios nem marcas de abertura. O `#nomad` é o elemento que o
 * Nomad Mode remove.
 */
const WATCH_PAGE = `<!doctype html>
<html><body>
<video width="320" height="180"></video>
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
  const videoEl = document.querySelector('video');
  videoEl.srcObject = canvas.captureStream(30);

  const isMovie = location.pathname.includes('filme');
  const movieId = isMovie ? 99 : Number(location.pathname.split('/').pop());
  window.apiCalls = [];
  let time = 30000;
  const audio = [
    { trackId: 'A:en', displayName: 'Inglês [original]' },
    { trackId: 'A:pt', displayName: 'Português' },
  ];
  const text = [
    { trackId: 'T:off', displayName: 'Desligadas' },
    { trackId: 'T:pt', displayName: 'Português' },
  ];
  let audioTrack = audio[0];
  let textTrack = text[1];
  const player = {
    getMovieId: () => movieId,
    getCurrentTime: () => time,
    getDuration: () => 1200000,
    seek: (ms) => { time = ms; apiCalls.push('seek:' + ms); },
    // Como na Netflix, mudo, volume e velocidade passam pelo player.
    setMuted: (muted) => { videoEl.muted = muted; },
    setVolume: (volume) => { videoEl.volume = volume; },
    setPlaybackRate: (rate) => { videoEl.playbackRate = rate; },
    getTimeCodes: () => isMovie ? [] : [
      { type: 'recap', startOffsetMs: 0, endOffsetMs: 60000 },
      { type: 'start', startOffsetMs: 65000, endOffsetMs: 65000 },
    ],
    getAudioTrackList: () => audio,
    getAudioTrack: () => audioTrack,
    setAudioTrack: (t) => { audioTrack = t; apiCalls.push('audio:' + t.trackId); },
    getTimedTextTrackList: () => text,
    getTimedTextTrack: () => textTrack,
    setTimedTextTrack: (t) => { textTrack = t; apiCalls.push('text:' + t.trackId); },
  };
  const video = isMovie
    ? { title: 'Filme' }
    : {
        title: 'Série',
        currentEpisode: movieId,
        seasons: [{ title: 'Temporada 1', episodes: [
          { id: 1, seq: 1, title: 'Piloto' },
          { id: 2, seq: 2, title: 'Episódio 2' },
        ] }],
      };
  window.netflix = { appContext: { state: { playerApp: {
    getAPI: () => ({ videoPlayer: {
      getAllPlayerSessionIds: () => ['watch-1'],
      getVideoPlayerBySessionId: () => player,
    } }),
    getState: () => ({ videoPlayer: { videoMetadata: {
      [movieId]: { _metadataObject: { video } },
    } } }),
  } } } };
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
