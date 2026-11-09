import type { RefObject } from 'preact';
import { useCallback, useEffect, useRef, useState, type MutableRef } from 'preact/hooks';
import { ERROR_MESSAGES } from '@/lib/errors';
import { setFullscreen } from '@/lib/controller';
import { SEEK_SECONDS, type TitleInfo } from '@/lib/messages';
import { VOLUME_STEP, type PageActions } from '@/lib/player';
import { findPageControlAt } from '@/lib/selectors';
import { findSkip, type Skip } from '@/lib/skip';
import { setSubtitleLift } from '@/lib/subtitles';
import { formatTime } from '@/lib/time';
import { Icon, type IconName } from '@/ui/icons';
import { EpisodeSelect, SpeedSelect, TrackSelect, episodeLabel } from '@/ui/selects';
import { Switch } from '@/ui/Switch';
import { Timeline } from '@/ui/Timeline';
import { useSettings } from '@/ui/useSettings';
import { useAutoSkip, useNextUp, type NextUp } from './useAutomations';
import { useHud } from './useHud';

/** Quanto tempo o HUD fica na tela depois que o mouse para. */
const IDLE_MS = 3000;

/** Teclas que os controles do HUD já usam quando estão com o foco. */
const CONTROL_KEYS = new Set([' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

/**
 * Controles sobre o vídeo, no estilo de um player: aparecem quando o mouse
 * mexe e somem depois de `IDLE_MS` parado. Ficam na tela enquanto o mouse
 * está sobre eles, com o vídeo pausado ou com o painel de opções aberto.
 * O botão de pular abertura aparece sempre que há o que pular, como na Netflix.
 */
export function Hud({ page }: { page: PageActions }) {
  const { player, title, notice, info, showInfo, run } = useHud(page);
  const { settings, update } = useSettings();
  const active = useActivity(IDLE_MS);
  const fullscreen = useWindowFullscreen();
  const [hovering, setHovering] = useState(false);
  const [panel, setPanel] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const shortcuts = useRef<(key: string) => boolean>(() => false);
  useShortcuts(root, shortcuts);

  const visible = player !== null && (active || hovering || panel || player.paused);

  // Escondido, nenhum controle fica com o foco: o espaço acionaria um botão
  // invisível (ex.: "−10s") em vez de pausar.
  useEffect(() => {
    if (visible) return;
    const focused = (root.current?.getRootNode() as ShadowRoot | undefined)?.activeElement;
    if (focused instanceof HTMLElement) focused.blur();
  }, [visible]);

  // Sem o HUD, o cursor também some, para não ficar parado sobre o vídeo.
  useEffect(() => {
    if (player === null || visible) return;
    document.body.style.cursor = 'none';
    return () => {
      document.body.style.cursor = '';
    };
  }, [player, visible]);

  // Com o HUD na tela, a legenda sobe para não ficar sob a linha do tempo.
  useEffect(() => {
    setSubtitleLift(visible);
  }, [visible]);

  useEffect(
    () => () => {
      setSubtitleLift(false);
    },
    [],
  );

  const skip = title && player ? findSkip(title.timeCodes, player.currentTime * 1000) : null;
  useAutoSkip(settings?.autoSkip ?? false, skip, player, title?.movieId ?? null, (target: Skip) => {
    void run({ type: 'skip' }).then((ok) => {
      if (ok) showInfo(target.kind === 'recap' ? 'Recapitulação pulada' : 'Abertura pulada');
    });
  });
  const playEpisode = useCallback(
    (episodeId: number) => {
      void run({ type: 'playEpisode', episodeId });
    },
    [run],
  );
  // Com o painel aberto o card some; a contagem espera, para o episódio não
  // trocar sem a pessoa ver.
  const nextUp = useNextUp(settings?.autoNext ?? false, !panel, player, title, playEpisode);

  if (!player) return null;

  const episode = findEpisode(title, title?.currentEpisode ?? null);
  const toggleFullscreen = () => {
    void setFullscreen(!fullscreen);
  };

  // Atalhos no estilo da Netflix; a função é refeita a cada render para usar
  // o estado atual (tempo, pular, tela cheia).
  shortcuts.current = (key) => {
    switch (key) {
      case ' ':
      case 'k':
        void run({ type: 'togglePlay' });
        return true;
      case 'ArrowLeft':
      case 'ArrowRight':
        void run({ type: 'seekBy', seconds: key === 'ArrowLeft' ? -SEEK_SECONDS : SEEK_SECONDS });
        return true;
      case 'ArrowUp':
      case 'ArrowDown':
        void run({ type: 'changeVolume', delta: key === 'ArrowUp' ? VOLUME_STEP : -VOLUME_STEP });
        return true;
      case 'm':
        void run({ type: 'toggleMute' });
        return true;
      case 'f':
        toggleFullscreen();
        return true;
      case 's':
        if (skip) void run({ type: 'skip' });
        return skip !== null;
      default:
        return false;
    }
  };

  const hover = {
    onPointerEnter: () => {
      setHovering(true);
    },
    onPointerLeave: () => {
      setHovering(false);
    },
  };

  return (
    <div ref={root} class={visible ? 'hud hud--visible' : 'hud'} data-testid="hud">
      {/*
        Fica sob os controles e cobre o vídeo: clique pausa ou continua,
        duplo clique entra ou sai da tela cheia (os dois cliques se anulam).
        Com o painel aberto, o clique só fecha o painel. Um botão da Netflix
        embaixo (ex.: "Você ainda está assistindo?") recebe o clique.
      */}
      <div
        class="hud__surface"
        onClick={(event) => {
          const host = root.current?.getRootNode();
          const control =
            host instanceof ShadowRoot
              ? findPageControlAt(event.clientX, event.clientY, host.host)
              : null;
          if (control) control.click();
          else if (panel) setPanel(false);
          else void run({ type: 'togglePlay' });
        }}
        onDblClick={() => {
          if (!panel) toggleFullscreen();
        }}
        data-testid="hud-surface"
      />
      <div class="hud__top hud__fade" {...hover}>
        <HudButton
          icon="arrowBack"
          label="Sair do título"
          onClick={() => void run({ type: 'exit' })}
          testId="exit"
        />
        {title?.title && (
          <div class="hud__title">
            <strong>{title.title}</strong>
            {episode && (
              <span>
                {episode.season.title} · {episodeLabel(episode.item.seq, episode.item.title)}
              </span>
            )}
          </div>
        )}
      </div>

      {skip && !panel && (
        <button
          type="button"
          class="hud__skip"
          onClick={() => void run({ type: 'skip' })}
          data-testid="skip"
        >
          <Icon name="fastForward" />
          {skip.kind === 'recap' ? 'Pular recapitulação' : 'Pular abertura'}
        </button>
      )}

      {nextUp && !panel && (
        <NextUpCard
          nextUp={nextUp}
          episode={findEpisode(title, nextUp.episodeId)}
          onPlay={() => {
            playEpisode(nextUp.episodeId);
          }}
        />
      )}

      {notice ? (
        <p class="hud__notice" role="alert">
          {ERROR_MESSAGES[notice]}
        </p>
      ) : (
        info && (
          <p class="hud__notice hud__notice--info" role="status">
            {info}
          </p>
        )
      )}

      {panel && (
        <div
          class="hud__panel hud__fade"
          role="dialog"
          aria-label="Opções"
          {...hover}
          data-testid="hud-panel"
        >
          <div class="hud__panel-header">Opções</div>
          <div class="hud__panel-body">
            {title && title.seasons.length > 0 && (
              <div class="field">
                <span class="field__label">Episódio</span>
                <EpisodeSelect
                  title={title}
                  disabled={false}
                  onEpisode={(episodeId) => void run({ type: 'playEpisode', episodeId })}
                />
              </div>
            )}
            {title && (
              <>
                <TrackSelect
                  label="Áudio"
                  tracks={title.audioTracks}
                  value={title.audioTrack}
                  disabled={false}
                  onChange={(trackId) => void run({ type: 'setAudioTrack', trackId })}
                  testId="audio-track"
                />
                <TrackSelect
                  label="Legendas"
                  tracks={title.textTracks}
                  value={title.textTrack}
                  disabled={false}
                  onChange={(trackId) => void run({ type: 'setTextTrack', trackId })}
                  testId="text-track"
                />
              </>
            )}
            <SpeedSelect
              value={player.playbackRate}
              disabled={false}
              onChange={(rate) => void run({ type: 'setSpeed', rate })}
            />
          </div>
          {settings && (
            <div class="hud__panel-body hud__panel-body--settings">
              <Switch
                label="Pular abertura automaticamente"
                checked={settings.autoSkip}
                onChange={(autoSkip) => void update({ autoSkip })}
                testId="hud-auto-skip"
              />
              <Switch
                label="Próximo episódio automático"
                checked={settings.autoNext}
                onChange={(autoNext) => void update({ autoNext })}
                testId="hud-auto-next"
              />
            </div>
          )}
        </div>
      )}

      <div class="hud__bottom hud__fade" {...hover}>
        <div class="hud__timeline">
          <Timeline
            current={player.currentTime}
            duration={player.duration}
            showTimes={false}
            onSeek={(seconds) => void run({ type: 'seekTo', seconds })}
          />
          <span class="hud__remaining">
            {player.duration > 0 ? formatTime(player.duration - player.currentTime) : '--:--'}
          </span>
        </div>
        <div class="hud__bar">
          <div class="hud__group">
            <HudButton
              icon={player.paused ? 'play' : 'pause'}
              label={player.paused ? 'Reproduzir' : 'Pausar'}
              onClick={() => void run({ type: 'togglePlay' })}
              testId="toggle-play"
            />
            <HudButton
              icon="replay"
              label={`Voltar ${String(SEEK_SECONDS)} segundos`}
              onClick={() => void run({ type: 'seekBy', seconds: -SEEK_SECONDS })}
              testId="back10"
            />
            <HudButton
              icon="replay"
              flip
              label={`Avançar ${String(SEEK_SECONDS)} segundos`}
              onClick={() => void run({ type: 'seekBy', seconds: SEEK_SECONDS })}
              testId="forward10"
            />
            <HudButton
              icon={player.muted ? 'volumeOff' : 'volumeUp'}
              label={player.muted ? 'Ativar som' : 'Silenciar'}
              onClick={() => void run({ type: 'toggleMute' })}
              testId="toggle-mute"
            />
            <input
              type="range"
              class="slider hud__volume"
              min={0}
              max={1}
              step={0.05}
              value={player.muted ? 0 : player.volume}
              aria-label="Volume"
              style={{ '--value': `${String((player.muted ? 0 : player.volume) * 100)}%` }}
              onInput={(event) =>
                void run({ type: 'setVolume', volume: Number(event.currentTarget.value) })
              }
              data-testid="volume"
            />
            <span class="hud__time">
              {formatTime(player.currentTime)} /{' '}
              {player.duration > 0 ? formatTime(player.duration) : '--:--'}
            </span>
          </div>
          <div class="hud__group">
            {title?.previousEpisode != null && (
              <HudButton
                icon="skipPrevious"
                label="Episódio anterior"
                onClick={() => {
                  if (title.previousEpisode !== null) {
                    void run({ type: 'playEpisode', episodeId: title.previousEpisode });
                  }
                }}
                testId="previous"
              />
            )}
            {title?.nextEpisode != null && (
              <HudButton
                icon="skipNext"
                label="Próximo episódio"
                onClick={() => void run({ type: 'nextEpisode' })}
                testId="next"
              />
            )}
            <HudButton
              icon="tune"
              label="Episódios, áudio, legendas e velocidade"
              pressed={panel}
              onClick={() => {
                setPanel(!panel);
              }}
              testId="hud-settings"
            />
            <HudButton
              icon={fullscreen ? 'fullscreenExit' : 'fullscreen'}
              label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              onClick={toggleFullscreen}
              testId="fullscreen"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Episódio pelo id, com a temporada; `undefined` em filmes ou se não estiver na lista. */
function findEpisode(title: TitleInfo | null, episodeId: number | null) {
  if (!title || episodeId === null) return undefined;
  for (const season of title.seasons) {
    const item = season.episodes.find((candidate) => candidate.id === episodeId);
    if (item) return { season, item };
  }
  return undefined;
}

interface NextUpCardProps {
  nextUp: NextUp;
  episode: ReturnType<typeof findEpisode>;
  onPlay: () => void;
}

/**
 * Chamada para o próximo episódio nos créditos. Com contagem, uma barra
 * enche na base do botão e, cheia, o episódio troca sozinho. Fica fora do
 * `.hud__fade`: aparece mesmo com o HUD escondido.
 */
function NextUpCard({ nextUp, episode, onPlay }: NextUpCardProps) {
  const counting = nextUp.progress !== null;
  return (
    <div class="hud__next" role="group" aria-label="Próximo episódio" data-testid="next-up">
      {episode && (
        <span class="hud__next-label">
          A seguir · {episodeLabel(episode.item.seq, episode.item.title)}
        </span>
      )}
      <div class="hud__next-actions">
        <button
          type="button"
          class="hud__next-play"
          style={{ '--progress': String(nextUp.progress ?? 0) }}
          onClick={onPlay}
          data-testid="next-up-play"
        >
          {counting && <span class="hud__next-fill" aria-hidden="true" />}
          <Icon name="play" />
          {counting ? 'Próximo episódio' : 'Assistir próximo'}
        </button>
        <button
          type="button"
          class="hud__next-dismiss"
          onClick={nextUp.dismiss}
          data-testid="next-up-dismiss"
        >
          Assistir créditos
        </button>
      </div>
    </div>
  );
}

interface HudButtonProps {
  icon: IconName;
  label: string;
  onClick: () => void;
  testId: string;
  flip?: boolean;
  pressed?: boolean;
}

function HudButton({ icon, label, onClick, testId, flip, pressed }: HudButtonProps) {
  return (
    <button
      type="button"
      class="hud__button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      data-testid={testId}
    >
      <Icon name={icon} flip={flip} />
    </button>
  );
}

/** `true` enquanto o mouse mexeu ou uma tecla foi apertada nos últimos `idleMs`. */
function useActivity(idleMs: number): boolean {
  const [active, setActive] = useState(true);

  useEffect(() => {
    let timer = setTimeout(() => {
      setActive(false);
    }, idleMs);
    const onActivity = () => {
      setActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        setActive(false);
      }, idleMs);
    };
    const options = { capture: true, passive: true };
    const events = ['mousemove', 'pointerdown', 'keydown'];
    for (const event of events) window.addEventListener(event, onActivity, options);
    return () => {
      clearTimeout(timer);
      for (const event of events) window.removeEventListener(event, onActivity, options);
    };
  }, [idleMs]);

  return active;
}

/**
 * Atalhos de teclado. Os da Netflix não respondem quando a barra dela não
 * existe, então a extensão fica com a tecla e a Netflix não a recebe. Com o
 * foco num controle do HUD, espaço, Enter e setas continuam com o controle
 * (botão, lista, linha do tempo, volume).
 */
function useShortcuts(
  root: RefObject<HTMLElement>,
  handler: MutableRef<(key: string) => boolean>,
): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const { target } = event;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement)
      ) {
        return;
      }
      const insideHud = root.current !== null && event.composedPath().includes(root.current);
      if (insideHud && CONTROL_KEYS.has(event.key)) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (handler.current(key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const options = { capture: true };
    window.addEventListener('keydown', onKeyDown, options);
    return () => {
      window.removeEventListener('keydown', onKeyDown, options);
    };
  }, [root, handler]);
}

/**
 * A janela está em tela cheia? A media query acompanha a tela cheia da janela
 * (a do botão e a do F11); comparar com o tamanho da tela erraria em janelas
 * maximizadas do tamanho da tela.
 */
function useWindowFullscreen(): boolean {
  const [query] = useState(() => matchMedia('(display-mode: fullscreen)'));
  const [fullscreen, setFullscreen] = useState(query.matches);

  useEffect(() => {
    const onChange = () => {
      setFullscreen(query.matches);
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, [query]);

  return fullscreen;
}
