import { useCallback, useEffect, useState } from 'preact/hooks';
import {
  enterFullscreen,
  getTargetTab,
  sendCommand,
  sendNomad,
  sendTitle,
  type ControllerError,
  type TargetTab,
} from '@/lib/controller';
import { NOTICE_ERRORS } from '@/lib/errors';
import type { PlayerCommand, PlayerState, TitleInfo } from '@/lib/messages';

export type View =
  | { status: 'loading' }
  | { status: 'error'; error: ControllerError }
  | { status: 'ready'; tab: TargetTab; player: PlayerState; notice?: ControllerError };

/** Intervalo de atualização do estado enquanto o popup está aberto. */
const POLL_MS = 1000;

/** Quanto esperar o novo episódio carregar antes de mostrar o erro. */
const NAVIGATION_TIMEOUT_MS = 20_000;

const TRACK_COMMANDS = new Set<PlayerCommand['type']>(['setAudioTrack', 'setTextTrack']);

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Conecta o popup à aba da Netflix. O popup não guarda estado do player:
 * ele pede o estado ao abrir, a cada segundo e após cada comando.
 */
export function usePlayer() {
  const [view, setView] = useState<View>({ status: 'loading' });
  const [title, setTitle] = useState<TitleInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [nomadError, setNomadError] = useState<ControllerError>();

  const loadTitle = useCallback(async (tab: TargetTab) => {
    setTitle(await sendTitle(tab.id));
  }, []);

  const connect = useCallback(async () => {
    setView({ status: 'loading' });
    const target = await getTargetTab();
    if (!target.ok) {
      setView({ status: 'error', error: target.error });
      return;
    }
    const result = await sendCommand(target.tab.id, { type: 'getState' });
    if (!result.ok) {
      setView({ status: 'error', error: result.error });
      return;
    }
    setView({ status: 'ready', tab: target.tab, player: result.state });
    await loadTitle(target.tab);
  }, [loadTitle]);

  useEffect(() => {
    void connect();
  }, [connect]);

  const tab = view.status === 'ready' ? view.tab : undefined;

  // Mantém tempo, pausa e volume em dia com o que acontece na página.
  useEffect(() => {
    if (!tab) return;
    const timer = setInterval(() => {
      void sendCommand(tab.id, { type: 'getState' }).then((result) => {
        setView((current) => {
          if (current.status !== 'ready') return current;
          return result.ok
            ? { ...current, player: result.state }
            : { status: 'error', error: result.error };
        });
      });
    }, POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [tab]);

  const run = useCallback(
    async (command: PlayerCommand) => {
      if (!tab) return false;
      setBusy(true);
      const result = await sendCommand(tab.id, command);
      setBusy(false);

      setView((current) => {
        if (current.status !== 'ready') return current;
        if (result.ok) return { status: 'ready', tab: current.tab, player: result.state };
        // Ação que falhou sem derrubar o player: só avisa.
        if (NOTICE_ERRORS.has(result.error)) return { ...current, notice: result.error };
        return { status: 'error', error: result.error };
      });
      if (result.ok && TRACK_COMMANDS.has(command.type)) await loadTitle(tab);
      return result.ok;
    },
    [tab, loadTitle],
  );

  /**
   * Trocar de episódio recarrega a página da Netflix, e o content script
   * recomeça junto. Até o novo episódio responder, o popup fica em
   * "Conectando…" em vez de mostrar o erro de conexão.
   */
  const playEpisode = useCallback(
    async (episodeId: number) => {
      if (!tab || !(await run({ type: 'playEpisode', episodeId }))) return;
      setView({ status: 'loading' });
      setTitle(null);
      const deadline = Date.now() + NAVIGATION_TIMEOUT_MS;
      for (;;) {
        await sleep(POLL_MS);
        const result = await sendCommand(tab.id, { type: 'getState' });
        const loaded = result.ok && (await sendTitle(tab.id))?.currentEpisode === episodeId;
        if (result.ok && loaded) {
          setView({ status: 'ready', tab, player: result.state });
          await loadTitle(tab);
          return;
        }
        if (Date.now() > deadline) {
          setView({ status: 'error', error: result.ok ? 'NOT_CONNECTED' : result.error });
          return;
        }
      }
    },
    [tab, run, loadTitle],
  );

  // Sair do título leva a aba para o catálogo, onde não há o que controlar.
  const exit = useCallback(async () => {
    if (await run({ type: 'exit' })) window.close();
  }, [run]);

  const fullscreen = useCallback(async () => {
    if (!tab) return;
    await enterFullscreen(tab.windowId);
    window.close();
  }, [tab]);

  // Independe de `view`: o Nomad Mode funciona em qualquer página da
  // Netflix, com ou sem vídeo, então busca a aba por conta própria.
  const nomad = useCallback(async () => {
    const target = await getTargetTab();
    const result = target.ok ? await sendNomad(target.tab.id) : target;
    setNomadError(result.ok ? undefined : result.error);
  }, []);

  return {
    view,
    title,
    busy,
    connect,
    run,
    playEpisode,
    exit,
    fullscreen,
    nomad,
    nomadError,
  };
}
