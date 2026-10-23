import { describe, expect, it } from 'vitest';
import { isNetflixUrl, isWatchPath } from '@/lib/netflix';

describe('isNetflixUrl', () => {
  it.each([
    'https://www.netflix.com/',
    'https://www.netflix.com/watch/80100172?trackId=1',
    'https://www.netflix.com/browse',
  ])('aceita %s', (url) => {
    expect(isNetflixUrl(url)).toBe(true);
  });

  it.each([
    undefined,
    '',
    'not a url',
    'http://www.netflix.com/watch/1',
    'https://outro.site/?netflix.com',
    'https://netflix.com.golpe.site/',
    'chrome-extension://abc/popup.html',
  ])('rejeita %s', (url) => {
    expect(isNetflixUrl(url)).toBe(false);
  });
});

describe('isWatchPath', () => {
  it('aceita o player', () => {
    expect(isWatchPath('/watch/82158510')).toBe(true);
  });

  it.each(['/browse', '/title/80190982', '/br/title/80190982', '/', '/watchlist'])(
    'rejeita %s',
    (pathname) => {
      expect(isWatchPath(pathname)).toBe(false);
    },
  );
});
