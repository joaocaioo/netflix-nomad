import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { findUpdate } from '@/lib/update';

/** Versão nova disponível nas Releases, ou `null`. Nunca atrasa nem trava o popup. */
export function useUpdate(): string | null {
  const [latest, setLatest] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void findUpdate(browser.runtime.getManifest().version).then((version) => {
      if (alive) setLatest(version);
    });
    return () => {
      alive = false;
    };
  }, []);

  return latest;
}
