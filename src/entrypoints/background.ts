import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { sendCommand, toTargetTab } from '@/lib/controller';
import { createFullscreen } from '@/lib/fullscreen';
import { SEEK_SECONDS, isWindowCommand, type PlayerCommand } from '@/lib/messages';

/** Atalhos de teclado declarados em `manifest.commands` (wxt.config.ts). */
const SHORTCUTS: Record<string, PlayerCommand> = {
  'toggle-play': { type: 'togglePlay' },
  'toggle-mute': { type: 'toggleMute' },
  skip: { type: 'skip' },
  'next-episode': { type: 'nextEpisode' },
  'seek-back': { type: 'seekBy', seconds: -SEEK_SECONDS },
  'seek-forward': { type: 'seekBy', seconds: SEEK_SECONDS },
};

export default defineBackground(() => {
  browser.commands.onCommand.addListener((name, tab) => {
    const command = SHORTCUTS[name];
    const target = toTargetTab(tab);
    if (!command || !target.ok) return;
    void sendCommand(target.tab.id, command);
  });

  const fullscreen = createFullscreen(browser.windows);
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id || !isWindowCommand(message)) return false;
    // O popup informa a janela; o content script vem de uma aba dela.
    const windowId = message.windowId ?? sender.tab?.windowId;
    if (windowId === undefined) return false;
    const action = message.fullscreen ? fullscreen.enter : fullscreen.exit;
    void action(windowId)
      .catch(() => undefined)
      .then(() => {
        sendResponse(true);
      });
    return true;
  });
});
