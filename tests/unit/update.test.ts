import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  CHECK_INTERVAL_MS,
  compareVersions,
  findUpdate,
  latestDownloadUrl,
  parseVersion,
} from '@/lib/update';

describe('parseVersion', () => {
  it('aceita tags com e sem "v"', () => {
    expect(parseVersion('v1.2.0')).toBe('1.2.0');
    expect(parseVersion('1.10.3')).toBe('1.10.3');
  });

  it('rejeita o que não é x.y.z', () => {
    expect(parseVersion('v1.2')).toBeNull();
    expect(parseVersion('v1.2.0-beta')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });
});

describe('compareVersions', () => {
  it('compara número a número, não como texto', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.1.0', '1.1.0')).toBe(0);
    expect(compareVersions('1.0.9', '1.1.0')).toBeLessThan(0);
  });
});

describe('findUpdate', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('avisa quando a última Release é mais nova', async () => {
    const fetchJson = vi.fn(() => Promise.resolve({ tag_name: 'v1.2.0' }));
    await expect(findUpdate('1.1.0', { fetchJson })).resolves.toBe('1.2.0');
  });

  it('não avisa na versão mais recente', async () => {
    const fetchJson = vi.fn(() => Promise.resolve({ tag_name: 'v1.1.0' }));
    await expect(findUpdate('1.1.0', { fetchJson })).resolves.toBeNull();
  });

  it('consulta no máximo uma vez a cada intervalo', async () => {
    const fetchJson = vi.fn(() => Promise.resolve({ tag_name: 'v1.2.0' }));
    await findUpdate('1.1.0', { fetchJson, now: 1000 });
    await findUpdate('1.1.0', { fetchJson, now: 2000 });
    expect(fetchJson).toHaveBeenCalledTimes(1);
    await findUpdate('1.1.0', { fetchJson, now: 1000 + CHECK_INTERVAL_MS });
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it('sem rede, usa o que já sabia e não lança erro', async () => {
    await findUpdate('1.1.0', {
      fetchJson: () => Promise.resolve({ tag_name: 'v1.2.0' }),
      now: 0,
    });
    const offline = () => Promise.reject(new Error('offline'));
    await expect(findUpdate('1.1.0', { fetchJson: offline, now: CHECK_INTERVAL_MS })).resolves.toBe(
      '1.2.0',
    );
    fakeBrowser.reset();
    await expect(findUpdate('1.1.0', { fetchJson: offline })).resolves.toBeNull();
  });
});

describe('latestDownloadUrl', () => {
  it('aponta para o .zip do navegador', () => {
    expect(latestDownloadUrl('firefox')).toMatch(/netflix-nomad-firefox\.zip$/);
    expect(latestDownloadUrl('chrome')).toMatch(/netflix-nomad-chrome\.zip$/);
    expect(latestDownloadUrl('edge')).toMatch(/netflix-nomad-chrome\.zip$/);
  });
});
