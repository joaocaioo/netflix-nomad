import { render } from 'preact';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { injectScript } from 'wxt/utils/inject-script';
import { createBridge } from '@/lib/bridge';
import { setFullscreen } from '@/lib/controller';
import { enterNomadMode } from '@/lib/nomad';
import {
  isNomadCommand,
  isPlayerCommand,
  isTitleCommand,
  type NomadResult,
  type TitleResult,
} from '@/lib/messages';
import { NETFLIX_MATCHES, isWatchPath } from '@/lib/netflix';
import { runCommand, type PageActions } from '@/lib/player';
import { findVideo } from '@/lib/selectors';
import { installSubtitleLift } from '@/lib/subtitles';
import '@/ui/shared.css';
import { Hud } from './Hud';
import './hud.css';

/** Espera antes de navegar, para a resposta ao popup sair antes da página trocar. */
const NAVIGATE_DELAY_MS = 50;

/**
 * O elemento que hospeda o HUD cobre a janela por cima de tudo, mas deixa o
 * mouse passar; só os controles dentro dele capturam cliques. Inline, para
 * o CSS da Netflix não alcançar.
 */
const HUD_HOST_STYLE = 'position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;';

/** De quanto em quanto tempo conferir se a página é o player (a Netflix é uma SPA). */
const WATCH_CHECK_MS = 1000;

export default defineContentScript({
  matches: NETFLIX_MATCHES,
  // O CSS importado aqui vai para dentro do Shadow DOM do HUD, não para a página.
  cssInjectionMode: 'ui',
  async main(ctx) {
    // A API do player só existe no mundo da página: o script injetado a atende.
    const bridge = injectScript('/netflix-api.js').then(({ script }) => createBridge(script));

    const page: PageActions = {
      callApi: async (command) => (await (await bridge)(command)).ok,
      getTitle: async () => {
        const response = await (await bridge)({ type: 'getTitle' });
        return response.ok ? (response.title ?? null) : null;
      },
      navigate: (path) => {
        setTimeout(() => {
          location.assign(path);
        }, NAVIGATE_DELAY_MS);
      },
    };

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.id !== browser.runtime.id) return false;

      // O Nomad Mode não depende do vídeo: vale em qualquer página da Netflix.
      if (isNomadCommand(message)) {
        const result: NomadResult = enterNomadMode()
          ? { ok: true }
          : { ok: false, error: 'NOMAD_NOT_FOUND' };
        sendResponse(result);
        return false;
      }

      if (isTitleCommand(message)) {
        void page.getTitle().then((title) => {
          const result: TitleResult = title
            ? { ok: true, title }
            : { ok: false, error: 'NO_VIDEO' };
          sendResponse(result);
        });
        return true;
      }

      if (!isPlayerCommand(message)) return false;

      // O vídeo é buscado a cada comando: a Netflix é uma SPA e troca o
      // elemento ao navegar entre títulos.
      const video = isWatchPath(location.pathname) ? findVideo() : null;
      void runCommand(video, message, page).then(sendResponse);
      // `true` mantém o canal aberto até a resposta assíncrona.
      return true;
    });

    // A tela cheia é da janela, e essa não sai com Esc sozinha. Na fase de
    // captura, para a Netflix não engolir a tecla antes.
    ctx.addEventListener(
      window,
      'keydown',
      (event) => {
        if (event.key !== 'Escape' || document.fullscreenElement) return;
        void setFullscreen(false);
      },
      { capture: true },
    );

    installSubtitleLift();
    const hud = await createShadowRootUi(ctx, {
      name: 'netflix-nomad-hud',
      position: 'inline',
      anchor: 'body',
      // Espaço num botão do HUD não chega aos atalhos de teclado da Netflix.
      isolateEvents: true,
      onMount(container, _shadow, host) {
        host.style.cssText = HUD_HOST_STYLE;
        render(<Hud page={page} />, container);
        return container;
      },
      onRemove(container) {
        if (container) render(null, container);
      },
    });

    // O HUD só existe no player; some no catálogo e volta ao abrir um título.
    let mounted = false;
    const syncHud = () => {
      const watching = isWatchPath(location.pathname);
      if (watching === mounted) return;
      mounted = watching;
      if (watching) hud.mount();
      else hud.remove();
    };
    syncHud();
    ctx.setInterval(syncHud, WATCH_CHECK_MS);
  },
});
