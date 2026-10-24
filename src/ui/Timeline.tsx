import { useEffect, useState } from 'preact/hooks';
import { SEEK_SECONDS } from '@/lib/messages';
import { formatTime, pointerRatio } from '@/lib/time';

interface TimelineProps {
  /** Em segundos. */
  current: number;
  /** Em segundos; 0 enquanto desconhecida, e aí a linha não navega. */
  duration: number;
  onSeek: (seconds: number) => void;
  disabled?: boolean;
  /** Mostra tempo atual e duração embaixo da linha. */
  showTimes?: boolean;
}

/** Quanto tempo a bolinha espera no destino do clique pelo vídeo chegar lá. */
const SEEK_HOLD_MS = 2000;
/** A partir de quanto o vídeo é considerado no destino, em segundos. */
const SEEK_TOLERANCE = 1.5;

/**
 * Linha do tempo navegável: a bolinha marca o ponto atual, o mouse por cima
 * mostra o tempo daquele ponto e clicar ou arrastar leva o vídeo para lá.
 * As setas do teclado voltam e avançam `SEEK_SECONDS`.
 */
export function Timeline({
  current,
  duration,
  onSeek,
  disabled = false,
  showTimes = true,
}: TimelineProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  // Destino do último clique, em segundos. Sem ele a bolinha voltaria ao
  // ponto antigo até a próxima atualização do tempo.
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    if (pending !== null && Math.abs(current - pending) < SEEK_TOLERANCE) setPending(null);
  }, [pending, current]);

  useEffect(() => {
    if (pending === null) return;
    const timer = setTimeout(() => {
      setPending(null);
    }, SEEK_HOLD_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [pending]);

  const usable = !disabled && duration > 0;

  function ratioAt(event: PointerEvent): number {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return pointerRatio(event.clientX, rect.left, rect.width);
  }

  function seek(seconds: number) {
    const target = Math.min(Math.max(0, seconds), duration);
    setPending(target);
    onSeek(target);
  }

  const ratio = drag ?? (usable ? Math.min(1, (pending ?? current) / duration) : 0);
  const tip = usable ? (drag ?? hover) : null;
  const percent = (value: number) => `${String(value * 100)}%`;

  return (
    <div class="timeline" data-testid="timeline">
      <div
        class={drag === null ? 'timeline__hit' : 'timeline__hit timeline__hit--dragging'}
        role="slider"
        tabIndex={usable ? 0 : -1}
        aria-label="Linha do tempo"
        aria-disabled={!usable}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(current)}
        aria-valuetext={formatTime(current)}
        onPointerMove={(event) => {
          if (!usable) return;
          const value = ratioAt(event);
          setHover(value);
          if (drag !== null) setDrag(value);
        }}
        onPointerLeave={() => {
          setHover(null);
        }}
        onPointerDown={(event) => {
          if (!usable || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDrag(ratioAt(event));
        }}
        onPointerUp={(event) => {
          if (drag === null) return;
          setDrag(null);
          seek(ratioAt(event) * duration);
        }}
        onPointerCancel={() => {
          setDrag(null);
        }}
        onKeyDown={(event) => {
          if (!usable) return;
          if (event.key === 'ArrowLeft') seek(current - SEEK_SECONDS);
          else if (event.key === 'ArrowRight') seek(current + SEEK_SECONDS);
          else return;
          event.preventDefault();
        }}
      >
        <div class="timeline__track">
          <div class="timeline__fill" style={{ width: percent(ratio) }} />
        </div>
        {usable && <div class="timeline__thumb" style={{ left: percent(ratio) }} />}
        {tip !== null && (
          <div
            class="timeline__tooltip"
            style={{ '--left': percent(tip) }}
            data-testid="timeline-tooltip"
          >
            {formatTime(tip * duration)}
          </div>
        )}
      </div>
      {showTimes && (
        <div class="timeline__times">
          <span>{formatTime(drag === null ? current : drag * duration)}</span>
          <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
        </div>
      )}
    </div>
  );
}
