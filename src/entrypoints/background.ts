import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { sendCommand, toTargetTab } from '@/lib/controller';
import type { PlayerCommand } from '@/lib/messages';

/** Atalhos de teclado declarados em `manifest.commands` (wxt.config.ts). */
const SHORTCUTS: Record<string, PlayerCommand> = {
  'toggle-play': { type: 'togglePlay' },
  'toggle-mute': { type: 'toggleMute' },
  skip: { type: 'pressControl', control: 'skip' },
  'next-episode': { type: 'pressControl', control: 'next' },
  'seek-back': { type: 'pressControl', control: 'back10' },
  'seek-forward': { type: 'pressControl', control: 'forward10' },
};

export default defineBackground(() => {
  browser.commands.onCommand.addListener((name, tab) => {
    const command = SHORTCUTS[name];
    const target = toTargetTab(tab);
    if (!command || !target.ok) return;
    void sendCommand(target.tab.id, command);
  });
});
