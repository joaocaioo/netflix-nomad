import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { enterNomadMode, pressControl } from '@/lib/controls';
import { isPlayerCommand } from '@/lib/messages';
import { NETFLIX_MATCHES } from '@/lib/netflix';
import { runCommand } from '@/lib/player';
import { findVideo } from '@/lib/selectors';

export default defineContentScript({
  matches: NETFLIX_MATCHES,
  main() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.id !== browser.runtime.id || !isPlayerCommand(message)) return false;

      // O vídeo é buscado a cada comando: a Netflix é uma SPA e troca o
      // elemento ao navegar entre títulos.
      const video = findVideo();
      void runCommand(video, message, {
        pressControl: (control) => (video ? pressControl(control, video) : Promise.resolve(false)),
        enterNomadMode: () => enterNomadMode(),
      }).then(sendResponse);
      // `true` mantém o canal aberto até a resposta assíncrona.
      return true;
    });
  },
});
