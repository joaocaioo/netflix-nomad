import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { injectScript } from 'wxt/utils/inject-script';
import { createBridge } from '@/lib/bridge';
import { enterNomadMode } from '@/lib/controls';
import {
  isNomadCommand,
  isPlayerCommand,
  isTitleCommand,
  type NomadResult,
  type TitleResult,
} from '@/lib/messages';
import { NETFLIX_MATCHES } from '@/lib/netflix';
import { runCommand, type PageActions } from '@/lib/player';
import { findVideo } from '@/lib/selectors';

/** Espera antes de navegar, para a resposta ao popup sair antes da página trocar. */
const NAVIGATE_DELAY_MS = 50;

export default defineContentScript({
  matches: NETFLIX_MATCHES,
  main() {
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
      void runCommand(findVideo(), message, page).then(sendResponse);
      // `true` mantém o canal aberto até a resposta assíncrona.
      return true;
    });
  },
});
