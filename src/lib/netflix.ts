/** Padrões de URL onde a extensão atua (manifest e content script usam os mesmos). */
export const NETFLIX_MATCHES = ['https://www.netflix.com/*'];

const NETFLIX_HOST = 'www.netflix.com';

/**
 * Confere protocolo e hostname em vez de procurar "netflix.com" na string,
 * que aceitaria algo como `https://outro.site/?netflix.com`.
 */
export function isNetflixUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && hostname === NETFLIX_HOST;
  } catch {
    return false;
  }
}

/**
 * Só `/watch/...` é o player. Catálogo e páginas de título também têm
 * `<video>` (os trailers em destaque), mas ali não há o que controlar.
 */
export function isWatchPath(pathname: string): boolean {
  return pathname.startsWith('/watch/');
}
