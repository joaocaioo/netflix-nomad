import { storage } from 'wxt/utils/storage';

/**
 * A extensão é instalada pelo .zip das Releases do GitHub, então o navegador
 * não a atualiza sozinho. O popup consulta a última Release e avisa, com
 * discrição, quando há versão nova. A consulta não leva nada de quem usa:
 * é o mesmo pedido público que qualquer visitante da página faz.
 */
const LATEST_RELEASE_API = 'https://api.github.com/repos/joaocaioo/netflix-nomad/releases/latest';
export const LATEST_RELEASE_PAGE = 'https://github.com/joaocaioo/netflix-nomad/releases/latest';

/**
 * O .zip da última versão para o navegador do build: o link baixa direto,
 * sem passar pela página da Release. Os nomes são fixos (ver release.yml).
 */
export function latestDownloadUrl(browserName: string): string {
  const target = browserName === 'firefox' ? 'firefox' : 'chrome';
  return `${LATEST_RELEASE_PAGE}/download/netflix-nomad-${target}.zip`;
}

/** No máximo uma consulta a cada 12 h: o limite da API sem login é baixo. */
export const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

interface UpdateCache {
  checkedAt: number;
  /** Versão da última Release, sem o "v". */
  latest: string;
}

const cache = storage.defineItem<UpdateCache | null>('local:updateCheck', { fallback: null });

/** `1.2.0` de `v1.2.0`; `null` se não for uma versão `x.y.z`. */
export function parseVersion(tag: string): string | null {
  const match = /^v?(\d+\.\d+\.\d+)$/.exec(tag.trim());
  return match?.[1] ?? null;
}

/** Negativo se `a` é anterior a `b`, positivo se é posterior, 0 se iguais. */
export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * A versão nova disponível, ou `null` se a instalada é a mais recente ou se
 * não deu para saber. Sem rede ou com a API fora, usa o que já sabia: o
 * popup nunca mostra erro por causa disso.
 */
export async function findUpdate(
  current: string,
  { fetchJson = defaultFetchJson, now = Date.now() } = {},
): Promise<string | null> {
  let known = await cache.getValue();
  if (!known || now - known.checkedAt >= CHECK_INTERVAL_MS) {
    try {
      const release = await fetchJson(LATEST_RELEASE_API);
      const latest = parseVersion(readTag(release));
      if (latest) {
        known = { checkedAt: now, latest };
        await cache.setValue(known);
      }
    } catch {
      // Fica com o que já sabia.
    }
  }
  return known && compareVersions(known.latest, current) > 0 ? known.latest : null;
}

function readTag(release: unknown): string {
  if (typeof release !== 'object' || release === null) return '';
  const { tag_name: tag } = release as Record<string, unknown>;
  return typeof tag === 'string' ? tag : '';
}

async function defaultFetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
  return response.json();
}
