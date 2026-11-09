import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { PlayerCommand, PlayerErrorCode, PlayerState, TitleInfo } from '@/lib/messages';
import { watchId } from '@/lib/netflix';
import { runCommand, type PageActions } from '@/lib/player';
import { findVideo } from '@/lib/selectors';

/** O HUD mostra a linha do tempo correndo, então atualiza mais que o popup. */
const POLL_MS = 500;
const NOTICE_MS = 3000;
const TRACK_COMMANDS = new Set<PlayerCommand['type']>(['setAudioTrack', 'setTextTrack']);

/**
 * O título carregado é o da URL? A Netflix troca de episódio sem recarregar,
 * e por um instante o player ainda responde pelo anterior. Compara pelo id
 * do player, que existe mesmo antes dos metadados: comparar pelo episódio
 * aceitava qualquer resposta sem metadados (episódio `null`).
 */
function matchesPage(title: TitleInfo): boolean {
  const id = watchId(location.pathname);
  return id === null || title.movieId === id || title.currentEpisode === id;
}

/**
 * Estado e comandos do HUD. Roda dentro do content script, então executa
 * os comandos direto na página, sem passar pelo `runtime.sendMessage` do popup.
 */
export function useHud(page: PageActions) {
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [title, setTitle] = useState<TitleInfo | null>(null);
  const [notice, setNotice] = useState<PlayerErrorCode | null>(null);
  /** Aviso neutro, que não é erro (ex.: "Abertura pulada"). */
  const [info, setInfo] = useState<string | null>(null);
  const titleLoaded = useRef(false);

  useEffect(() => {
    let ended = false;
    let running = false;
    // Função, não variável: o efeito pode acabar durante um `await`.
    const alive = () => !ended;

    async function tick() {
      // Uma atualização lenta (a ponte espera até 2s) não acumula outras.
      if (running) return;
      running = true;
      try {
        const result = await runCommand(findVideo(), { type: 'getState' }, page);
        if (!alive()) return;
        setPlayer(result.ok ? result.state : null);
        if (result.ok && !titleLoaded.current) {
          const loaded = await page.getTitle();
          if (alive() && loaded && matchesPage(loaded)) {
            // Sem metadados, já serve para faixas e "Pular", mas não tem nome
            // nem episódios: continua pedindo até vir completo.
            titleLoaded.current = loaded.complete;
            setTitle(loaded);
          }
        }
      } finally {
        running = false;
      }
    }

    // Episódio novo sem recarregar a página: busca o título de novo.
    let path = location.pathname;
    const timer = setInterval(() => {
      if (location.pathname !== path) {
        path = location.pathname;
        titleLoaded.current = false;
        // Não mostra nome, anterior e próximo do episódio que acabou.
        setTitle(null);
      }
      void tick();
    }, POLL_MS);
    void tick();
    return () => {
      ended = true;
      clearInterval(timer);
    };
  }, [page]);

  useEffect(() => {
    if (!notice && !info) return;
    const timer = setTimeout(() => {
      setNotice(null);
      setInfo(null);
    }, NOTICE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [notice, info]);

  const run = useCallback(
    async (command: PlayerCommand) => {
      const result = await runCommand(findVideo(), command, page);
      if (!result.ok) {
        setNotice(result.error);
        return false;
      }
      setPlayer(result.state);
      if (TRACK_COMMANDS.has(command.type)) {
        const loaded = await page.getTitle();
        if (loaded) setTitle(loaded);
      }
      return true;
    },
    [page],
  );

  return { player, title, notice, info, showInfo: setInfo, run };
}
