import { useCallback, useEffect, useState } from 'preact/hooks';
import {
  getTargetTab,
  isFullscreen,
  openNetflix,
  reloadTab,
  sendCommand,
  sendNomad,
  sendTitle,
  setFullscreen,
  type ControllerError,
  type ControllerResult,
  type TargetTab,
} from '@/lib/controller';
import { NOTICE_ERRORS } from '@/lib/errors';
import type { PlayerCommand, PlayerState, TitleInfo } from '@/lib/messages';

export type View =
  | { status: 'loading' }
  /** `tab` existe quando a aba é da Netflix e o erro veio dela. */
  | { status: 'error'; error: ControllerError; tab?: TargetTab }
  | { status: 'ready'; tab: TargetTab; player: PlayerState; notice?: ControllerError };

/** Intervalo de atualização do estado enquanto o popup está aberto. */
const POLL_MS = 1000;

/** Novas tentativas ao abrir, enquanto o content script carrega (até 3 s). */
const CONNECT_RETRIES = 6;
const CONNECT_RETRY_MS = 500;

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
  const [fullscreen, setFullscreenState] = useState(false);
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
    // Logo depois de a página carregar, o content script pode ainda não
    // estar ouvindo: tenta de novo por um instante antes de mostrar o erro.
    let result = await sendCommand(target.tab.id, { type: 'getState' });
    for (let attempt = 1; !result.ok && result.error === 'NOT_CONNECTED'; attempt++) {
      if (attempt > CONNECT_RETRIES) break;
      await sleep(CONNECT_RETRY_MS);
      result = await sendCommand(target.tab.id, { type: 'getState' });
    }
    if (!result.ok) {
      setView({ status: 'error', error: result.error, tab: target.tab });
      return;
    }
    setView({ status: 'ready', tab: target.tab, player: result.state });
    setFullscreenState(await isFullscreen(target.tab.windowId));
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
            : { status: 'error', error: result.error, tab: current.tab };
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
        return { status: 'error', error: result.error, tab: current.tab };
      });
      if (result.ok && TRACK_COMMANDS.has(command.type)) await loadTitle(tab);
      return result.ok;
    },
    [tab, loadTitle],
  );

  /**
   * Espera a aba voltar depois de recarregar (troca de episódio ou
   * "Recarregar a página"); o content script recomeça junto. Até `done`
   * aceitar a resposta, o popup fica em "Conectando…" em vez de mostrar o
   * erro de conexão do meio do caminho.
   */
  const reconnect = useCallback(
    async (tab: TargetTab, done: (result: ControllerResult) => Promise<boolean>) => {
      setView({ status: 'loading' });
      setTitle(null);
      const deadline = Date.now() + NAVIGATION_TIMEOUT_MS;
      for (;;) {
        await sleep(POLL_MS);
        const result = await sendCommand(tab.id, { type: 'getState' });
        const finished = await done(result);
        if (finished && result.ok) {
          setView({ status: 'ready', tab, player: result.state });
          await loadTitle(tab);
          return;
        }
        if (finished || Date.now() > deadline) {
          setView({ status: 'error', error: result.ok ? 'NOT_CONNECTED' : result.error, tab });
          return;
        }
      }
    },
    [loadTitle],
  );

  const playEpisode = useCallback(
    async (episodeId: number) => {
      if (!tab || !(await run({ type: 'playEpisode', episodeId }))) return;
      await reconnect(
        tab,
        async (result) => result.ok && (await sendTitle(tab.id))?.currentEpisode === episodeId,
      );
    },
    [tab, run, reconnect],
  );

  // Termina quando o content script responde, com vídeo ou sem.
  const reloadPage = useCallback(async () => {
    if (view.status !== 'error' || !view.tab) return;
    const { tab: errorTab } = view;
    await reloadTab(errorTab.id);
    await reconnect(errorTab, (result) =>
      Promise.resolve(result.ok || result.error !== 'NOT_CONNECTED'),
    );
  }, [view, reconnect]);

  const goToNetflix = useCallback(async () => {
    await openNetflix();
    window.close();
  }, []);

  // Sair do título leva a aba para o catálogo, onde não há o que controlar.
  const exit = useCallback(async () => {
    if (await run({ type: 'exit' })) window.close();
  }, [run]);

  // Entra ou sai da tela cheia; o popup fecha sozinho quando a janela muda.
  const toggleWindowFullscreen = useCallback(async () => {
    if (!tab) return;
    await setFullscreen(!fullscreen, tab.windowId);
    window.close();
  }, [tab, fullscreen]);

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
    reloadPage,
    goToNetflix,
    run,
    playEpisode,
    exit,
    fullscreen,
    toggleFullscreen: toggleWindowFullscreen,
    nomad,
    nomadError,
  };
}
