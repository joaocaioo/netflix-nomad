import { describe, expect, it, vi } from 'vitest';
import { browser, type Browser } from 'wxt/browser';
import { getTargetTab, parseTabIdOverride, sendCommand, toTargetTab } from '@/lib/controller';

const netflixTab = {
  id: 7,
  windowId: 2,
  url: 'https://www.netflix.com/watch/1',
} as Browser.tabs.Tab;

// `vi.spyOn` pega a última sobrecarga das APIs (a com callback, que devolve void),
// por isso os `mockResolvedValue(... as never)` abaixo.

describe('parseTabIdOverride', () => {
  it.each([
    ['?tabId=12', 12],
    ['', undefined],
    ['?tabId=', undefined],
    ['?tabId=abc', undefined],
    ['?tabId=-1', undefined],
  ])('%s → %s', (search, expected) => {
    expect(parseTabIdOverride(search)).toBe(expected);
  });
});

describe('toTargetTab', () => {
  it('aceita aba da Netflix', () => {
    expect(toTargetTab(netflixTab)).toEqual({ ok: true, tab: { id: 7, windowId: 2 } });
  });

  it('rejeita aba sem URL visível (outro site, sem permissão de host)', () => {
    expect(toTargetTab({ id: 3, windowId: 1 } as Browser.tabs.Tab)).toEqual({
      ok: false,
      error: 'NOT_NETFLIX',
    });
  });
});

describe('getTargetTab', () => {
  it('usa a aba ativa quando não há ?tabId=', async () => {
    const query = vi.spyOn(browser.tabs, 'query').mockResolvedValue([netflixTab] as never);
    await expect(getTargetTab('')).resolves.toMatchObject({ ok: true, tab: { id: 7 } });
    expect(query).toHaveBeenCalledWith({ active: true, currentWindow: true });
  });

  it('usa ?tabId= quando presente', async () => {
    const get = vi.spyOn(browser.tabs, 'get').mockResolvedValue(netflixTab as never);
    await expect(getTargetTab('?tabId=7')).resolves.toMatchObject({ ok: true });
    expect(get).toHaveBeenCalledWith(7);
  });

  it('trata aba inexistente como NOT_NETFLIX', async () => {
    vi.spyOn(browser.tabs, 'get').mockRejectedValue(new Error('No tab with id: 99'));
    await expect(getTargetTab('?tabId=99')).resolves.toEqual({ ok: false, error: 'NOT_NETFLIX' });
  });
});

describe('sendCommand', () => {
  it('repassa a resposta do content script', async () => {
    const response = { ok: true, state: { paused: false, muted: false, volume: 1 } };
    vi.spyOn(browser.tabs, 'sendMessage').mockResolvedValue(response as never);
    await expect(sendCommand(7, { type: 'getState' })).resolves.toEqual(response);
  });

  it('devolve NOT_CONNECTED quando não há content script na aba', async () => {
    vi.spyOn(browser.tabs, 'sendMessage').mockRejectedValue(
      new Error('Could not establish connection. Receiving end does not exist.'),
    );
    await expect(sendCommand(7, { type: 'getState' })).resolves.toEqual({
      ok: false,
      error: 'NOT_CONNECTED',
    });
  });

  it('devolve NOT_CONNECTED quando a resposta vem vazia', async () => {
    vi.spyOn(browser.tabs, 'sendMessage').mockResolvedValue(undefined);
    await expect(sendCommand(7, { type: 'getState' })).resolves.toEqual({
      ok: false,
      error: 'NOT_CONNECTED',
    });
  });
});
