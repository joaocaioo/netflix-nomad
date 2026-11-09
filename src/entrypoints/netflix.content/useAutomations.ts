import { useEffect, useRef, useState } from 'preact/hooks';
import { AUTO_NEXT_MS, creditsStart } from '@/lib/autoplay';
import type { PlayerState, TitleInfo } from '@/lib/messages';
import type { Skip } from '@/lib/skip';

/** De quanto em quanto tempo a contagem anda (e a barra de progresso redesenha). */
const COUNTDOWN_TICK_MS = 100;

/** Folga para considerar que o vídeo chegou ao fim (aí ele fica "pausado"). */
const END_TOLERANCE_S = 0.5;

/**
 * Pula recapitulação e abertura sozinho, se a opção estiver ligada. Cada
 * trecho é pulado uma vez por episódio: quem voltar de propósito para a
 * abertura consegue assisti-la. Só vale para trechos marcados pela Netflix
 * e com o vídeo tocando.
 */
export function useAutoSkip(
  enabled: boolean,
  skip: Skip | null,
  player: PlayerState | null,
  movieId: number | null,
  doSkip: (skip: Skip) => void,
): void {
  const done = useRef(new Set<number>());

  useEffect(() => {
    done.current.clear();
  }, [movieId]);

  const paused = player?.paused ?? true;
  const target = enabled && skip?.marked && !paused ? skip : null;

  useEffect(() => {
    if (!target || done.current.has(target.targetMs)) return;
    done.current.add(target.targetMs);
    doSkip(target);
    // Só o trecho importa: `doSkip` muda a cada render.
  }, [target?.targetMs]);
}

export interface NextUp {
  episodeId: number;
  /** De 0 a 1; `null` sem contagem (opção desligada): só o botão. */
  progress: number | null;
  dismiss: () => void;
}

/**
 * Chamada para o próximo episódio nos créditos, no lugar da da Netflix (que
 * fica escondida). Com o próximo automático ligado, conta `AUTO_NEXT_MS` e
 * vai sozinho; a contagem para enquanto o vídeo está pausado. "Assistir
 * créditos" dispensa até a pessoa voltar para antes dos créditos.
 */
export function useNextUp(
  autoNext: boolean,
  /** `false` enquanto o card não está à vista: a contagem espera. */
  visible: boolean,
  player: PlayerState | null,
  title: TitleInfo | null,
  playEpisode: (episodeId: number) => void,
): NextUp | null {
  const [dismissed, setDismissed] = useState(false);
  const fired = useRef(false);

  const next = title?.nextEpisode ?? null;
  const start = title && player ? creditsStart(title.timeCodes, player.duration) : null;
  const inCredits =
    next !== null && start !== null && player !== null && player.currentTime >= start;

  useEffect(() => {
    if (inCredits) return;
    setDismissed(false);
    fired.current = false;
  }, [inCredits]);

  const showing = inCredits && !dismissed;
  const atEnd = player !== null && player.currentTime >= player.duration - END_TOLERANCE_S;
  const counting = showing && autoNext && visible && (!player.paused || atEnd);
  const elapsed = useElapsed(counting, showing);

  useEffect(() => {
    if (!counting || fired.current || elapsed < AUTO_NEXT_MS) return;
    fired.current = true;
    playEpisode(next);
  }, [counting, elapsed, next, playEpisode]);

  if (!showing) return null;
  return {
    episodeId: next,
    progress: autoNext ? Math.min(1, elapsed / AUTO_NEXT_MS) : null,
    dismiss: () => {
      setDismissed(true);
    },
  };
}

/**
 * Milissegundos acumulados enquanto `running`; para quando ele fica `false`
 * e zera quando `resetKey` muda. Mede pelo relógio, não pelos ticks, que o
 * navegador atrasa em abas em segundo plano.
 */
function useElapsed(running: boolean, resetKey: unknown): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
  }, [resetKey]);

  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      setElapsed((value) => value + now - last);
      last = now;
    }, COUNTDOWN_TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, [running]);

  return elapsed;
}
