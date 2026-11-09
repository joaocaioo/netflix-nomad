import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS, getSettings, updateSettings, watchSettings } from '@/lib/settings';

describe('settings', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('sem nada salvo, usa os padrões', async () => {
    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('salva só o que mudou e mantém o resto', async () => {
    await updateSettings({ autoSkip: true });
    await updateSettings({ enabled: false });
    await expect(getSettings()).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      autoSkip: true,
      enabled: false,
    });
  });

  it('completa preferências antigas com as chaves novas', async () => {
    await fakeBrowser.storage.local.set({ settings: { enabled: false } });
    await expect(getSettings()).resolves.toEqual({ ...DEFAULT_SETTINGS, enabled: false });
  });

  it('avisa quem está ouvindo', async () => {
    const onChange = vi.fn();
    const stop = watchSettings(onChange);
    await updateSettings({ autoNext: false });
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, autoNext: false });
    stop();
  });
});
