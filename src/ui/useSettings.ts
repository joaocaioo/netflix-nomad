import { useCallback, useEffect, useState } from 'preact/hooks';
import { getSettings, updateSettings, watchSettings, type Settings } from '@/lib/settings';

/**
 * Preferências salvas, em dia com o que mudar em outro lugar (popup ou HUD).
 * `null` até a primeira leitura, para não piscar o valor padrão.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let alive = true;
    void getSettings().then((loaded) => {
      if (alive) setSettings(loaded);
    });
    const stop = watchSettings(setSettings);
    return () => {
      alive = false;
      stop();
    };
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    setSettings(await updateSettings(patch));
  }, []);

  return { settings, update };
}
