import type { Page } from '@playwright/test';

/** Estado do `<video>` da página falsa da Netflix. */
export function videoState(page: Page) {
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

/** O que a extensão pediu à API falsa do player (seek, faixas). */
export function apiCalls(page: Page) {
  return page.evaluate(() => (window as unknown as { apiCalls: string[] }).apiCalls);
}
