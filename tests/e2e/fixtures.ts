import path from 'node:path';
import { chromium, test as base, type BrowserContext, type Page } from '@playwright/test';
import type { Browser, browser } from 'wxt/browser';

/** `chrome` dentro do service worker da extensão (onde roda `worker.evaluate`). */
type ExtensionGlobal = typeof globalThis & { chrome: typeof browser };

const EXTENSION_PATH = path.resolve('.output/chrome-mv3');

/**
 * Página que imita o essencial de /watch: um <video> tocável e a API interna
 * do player em `window.netflix`, como na Netflix. Avanço, abertura e faixas
 * pedidos à API ficam em `window.apiCalls`. O áudio do vídeo é gerado na
 * página, então o teste não depende de rede nem de conta.
 *
 * /watch/1 e /watch/2 são os dois episódios de uma série; /watch/filme é um
 * filme, sem episódios nem marcas de abertura. Em /watch/sem-api não há
 * `window.netflix`, como se a Netflix mudasse a API. O `#nomad` é o elemento
 * que o Nomad Mode remove, `.player-timedtext` é a camada de legendas e
 * `#netflix-dialog` imita um botão da Netflix sob o HUD.
 */
const WATCH_PAGE = `<!doctype html>
<html><body>
<video width="320" height="180"></video>
<div class="player-timedtext"><span>Legenda de teste</span></div>
<button id="netflix-dialog" style="position: fixed; left: 40px; top: 300px"
  onclick="window.dialogClicks = (window.dialogClicks || 0) + 1">Continuar assistindo</button>
<div id="nomad" class="netflix-sans-font-loaded"></div>
<script>
  // Áudio WAV de 20 min em silêncio, gerado aqui: tem duração de verdade,
  // que a linha do tempo precisa, e aceita mudar a velocidade.
  const sampleRate = 4000;
  const size = sampleRate * 1200;
  const wav = new DataView(new ArrayBuffer(44 + size));
  const ascii = (offset, text) => {
    for (let i = 0; i < text.length; i++) wav.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  wav.setUint32(4, 36 + size, true);
  ascii(8, 'WAVEfmt ');
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true);
  wav.setUint16(22, 1, true);
  wav.setUint32(24, sampleRate, true);
  wav.setUint32(28, sampleRate, true);
  wav.setUint16(32, 1, true);
  wav.setUint16(34, 8, true);
  ascii(36, 'data');
  wav.setUint32(40, size, true);
  // Em 8 bits sem sinal, 128 é silêncio.
  new Uint8Array(wav.buffer, 44).fill(128);
  const videoEl = document.querySelector('video');
  videoEl.src = URL.createObjectURL(new Blob([wav.buffer], { type: 'audio/wav' }));

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
    getBufferedTime: () => time + 60000,
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
  if (!location.pathname.includes('sem-api')) window.netflix = { appContext: { state: { playerApp: {
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

/** Catálogo com um trailer em destaque: tem `<video>`, mas não é o player. */
const BROWSE_PAGE = `<!doctype html>
<html><body>
<h1>Catálogo</h1>
<video id="trailer" width="320" height="180"></video>
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
  /** Estado da janela da aba (`normal`, `fullscreen`...), lido pelo service worker. */
  windowState: (tabId: number) => Promise<string | undefined>;
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
        contentType: 'text/html; charset=utf-8',
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

  windowState: async ({ context, extensionId }, use) => {
    await use(async (tabId) => {
      const worker = context
        .serviceWorkers()
        .find((sw) => sw.url().startsWith(`chrome-extension://${extensionId}/`));
      if (!worker) throw new Error('Service worker da extensão não encontrado');
      return worker.evaluate(async (id) => {
        const { chrome } = globalThis as ExtensionGlobal;
        const tab = await chrome.tabs.get(id);
        return (await chrome.windows.get(tab.windowId)).state;
      }, tabId);
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
