import { useCallback, useEffect, useState } from 'preact/hooks';
import {
  enterFullscreen,
  getTargetTab,
  sendCommand,
  sendNomad,
  type ControllerError,
  type TargetTab,
} from '@/lib/controller';
import { NOTICE_ERRORS } from '@/lib/errors';
import type { PlayerCommand, PlayerState } from '@/lib/messages';

export type View =
  | { status: 'loading' }
  | { status: 'error'; error: ControllerError }
  | { status: 'ready'; tab: TargetTab; player: PlayerState; notice?: ControllerError };

/** Intervalo de atualização do estado enquanto o popup está aberto. */
const POLL_MS = 1000;

/**
 * Conecta o popup à aba da Netflix. O popup não guarda estado do player:
 * ele pede o estado ao abrir, a cada segundo e após cada comando.
 */
export function usePlayer() {
  const [view, setView] = useState<View>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [nomadError, setNomadError] = useState<ControllerError>();

  const connect = useCallback(async () => {
    setView({ status: 'loading' });
    const target = await getTargetTab();
    if (!target.ok) {
      setView({ status: 'error', error: target.error });
      return;
    }
    const result = await sendCommand(target.tab.id, { type: 'getState' });
    setView(
      result.ok
        ? { status: 'ready', tab: target.tab, player: result.state }
        : { status: 'error', error: result.error },
    );
  }, []);

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
      if (!tab) return;
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
    },
    [tab],
  );

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

  return { view, busy, connect, run, fullscreen, nomad, nomadError };
}
