import { storage } from 'wxt/utils/storage';

/**
 * Preferências de quem usa a extensão. Ficam em `storage.local`, que o
 * popup, o content script e o service worker enxergam igual: mudar no popup
 * vale na hora na aba da Netflix, sem recarregar.
 */
export interface Settings {
  /** Desligada, a extensão sai da página e a Netflix volta ao player dela. */
  enabled: boolean;
  /** Pula recapitulação e abertura assim que elas começam. */
  autoSkip: boolean;
  /** Nos créditos, vai para o próximo episódio depois de uma contagem. */
  autoNext: boolean;
}

/**
 * O pulo automático vem desligado: pular sem pedir surpreende quem não
 * conhece a opção. O próximo episódio automático vem ligado, como na Netflix.
 */
export const DEFAULT_SETTINGS: Settings = { enabled: true, autoSkip: false, autoNext: true };

const item = storage.defineItem<Partial<Settings>>('local:settings', { fallback: {} });

/** Completa com os padrões: chaves novas valem para quem já tinha preferências salvas. */
function withDefaults(saved: Partial<Settings> | null): Settings {
  return { ...DEFAULT_SETTINGS, ...saved };
}

export async function getSettings(): Promise<Settings> {
  return withDefaults(await item.getValue());
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await item.setValue(next);
  return next;
}

/** Avisa a cada mudança, venha de onde vier. Devolve a função que para de ouvir. */
export function watchSettings(onChange: (settings: Settings) => void): () => void {
  return item.watch((saved) => {
    onChange(withDefaults(saved));
  });
}
