import type { ComponentChildren } from 'preact';
import logo from '@/assets/logo.png';
import type { ControllerError } from '@/lib/controller';
import { ERROR_MESSAGES } from '@/lib/errors';
import { SEEK_SECONDS, type PlayerCommand, type PlayerState, type TitleInfo } from '@/lib/messages';
import { findSkip } from '@/lib/skip';
import { Icon, type IconName } from '@/ui/icons';
import { EpisodeSelect, SpeedSelect, TrackSelect, episodeLabel } from '@/ui/selects';
import { Timeline } from '@/ui/Timeline';
import { usePlayer } from './usePlayer';

type EmptyAction = 'openNetflix' | 'reload' | 'retry';

/** Ícone e próximo passo de cada erro: cada um leva a uma saída diferente. */
const EMPTY_STATES: Record<ControllerError, { icon: IconName; action: EmptyAction }> = {
  NOT_NETFLIX: { icon: 'openInNew', action: 'openNetflix' },
  NOT_CONNECTED: { icon: 'refresh', action: 'reload' },
  NO_VIDEO: { icon: 'movie', action: 'retry' },
  PLAY_REJECTED: { icon: 'info', action: 'retry' },
  CONTROL_NOT_FOUND: { icon: 'info', action: 'retry' },
  NOMAD_NOT_FOUND: { icon: 'info', action: 'retry' },
};

const ACTION_LABELS: Record<EmptyAction, string> = {
  openNetflix: 'Abrir a Netflix',
  reload: 'Recarregar a página',
  retry: 'Tentar de novo',
};

export function App() {
  const {
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
    toggleFullscreen,
    nomad,
    nomadError,
  } = usePlayer();

  return (
    <main class="popup">
      <header class="header">
        {/* Só a altura é fixa: a largura segue a proporção da imagem. */}
        <img class="header__logo" src={logo} alt="" />
        <h1 class="header__name">Netflix Nomad</h1>
      </header>

      {view.status === 'loading' && (
        <div class="empty" role="status">
          <span class="spinner" aria-hidden="true" />
          <p>Conectando…</p>
        </div>
      )}

      {view.status === 'error' && (
        <div class="empty" role="alert">
          <span class="empty__icon">
            <Icon name={EMPTY_STATES[view.error].icon} />
          </span>
          <p>{ERROR_MESSAGES[view.error]}</p>
          <button
            type="button"
            class="button button--primary"
            onClick={() => {
              const { action } = EMPTY_STATES[view.error];
              if (action === 'openNetflix') void goToNetflix();
              else if (action === 'reload' && view.tab) void reloadPage();
              else void connect();
            }}
            data-testid="empty-action"
          >
            {ACTION_LABELS[EMPTY_STATES[view.error].action]}
          </button>
        </div>
      )}

      {view.status === 'ready' && (
        <Controls
          player={view.player}
          title={title}
          busy={busy}
          notice={view.notice ? ERROR_MESSAGES[view.notice] : null}
          run={(command) => void run(command)}
          onEpisode={(episodeId) => void playEpisode(episodeId)}
          onExit={() => void exit()}
          fullscreen={fullscreen}
          onFullscreen={() => void toggleFullscreen()}
        />
      )}

      {/* Sempre ativo: não depende de vídeo nem do estado da conexão. */}
      <button
        type="button"
        class="button button--ghost"
        onClick={() => void nomad()}
        data-testid="nomad-mode"
      >
        <Icon name="explore" />
        Nomad Mode
      </button>
      {nomadError && (
        <p class="toast" role="alert" data-testid="nomad-error">
          {ERROR_MESSAGES[nomadError]}
        </p>
      )}
    </main>
  );
}

interface ControlsProps {
  player: PlayerState;
  /** `null` enquanto carrega ou se o player não informar. */
  title: TitleInfo | null;
  busy: boolean;
  notice: string | null;
  run: (command: PlayerCommand) => void;
  onEpisode: (episodeId: number) => void;
  onExit: () => void;
  fullscreen: boolean;
  onFullscreen: () => void;
}

function Controls({
  player,
  title,
  busy,
  notice,
  run,
  onEpisode,
  onExit,
  fullscreen,
  onFullscreen,
}: ControlsProps) {
  const send = (command: PlayerCommand) => () => {
    run(command);
  };
  const previousEpisode = title?.previousEpisode ?? null;
  const nextEpisode = title?.nextEpisode ?? null;
  // Recalculado a cada atualização do tempo: o botão some fora da abertura.
  const skip = title ? findSkip(title.timeCodes, player.currentTime * 1000) : null;
  const volume = player.muted ? 0 : player.volume;
  const episode = title?.seasons
    .flatMap((season) => season.episodes.map((item) => ({ season, item })))
    .find(({ item }) => item.id === title.currentEpisode);

  return (
    <>
      <section class="card" aria-label="Reprodução">
        {title?.title && (
          <div class="now">
            <p class="now__title">{title.title}</p>
            {episode && (
              <p class="now__episode">
                {episode.season.title} · {episodeLabel(episode.item.seq, episode.item.title)}
              </p>
            )}
          </div>
        )}

        <Timeline
          current={player.currentTime}
          duration={player.duration}
          disabled={busy}
          onSeek={(seconds) => {
            run({ type: 'seekTo', seconds });
          }}
        />

        {/* Simétrico, com o play no centro. */}
        <div class="transport">
          <IconButton
            icon="skipPrevious"
            label="Episódio anterior"
            onClick={() => {
              if (previousEpisode !== null) onEpisode(previousEpisode);
            }}
            disabled={busy || previousEpisode === null}
            testId="previous"
          />
          <IconButton
            icon="replay"
            label={`Voltar ${String(SEEK_SECONDS)} segundos`}
            onClick={send({ type: 'seekBy', seconds: -SEEK_SECONDS })}
            disabled={busy}
            testId="back10"
          />
          <button
            type="button"
            class="play"
            disabled={busy}
            onClick={send({ type: 'togglePlay' })}
            aria-label={player.paused ? 'Reproduzir' : 'Pausar'}
            title={player.paused ? 'Reproduzir' : 'Pausar'}
            data-testid="toggle-play"
          >
            <Icon name={player.paused ? 'play' : 'pause'} />
          </button>
          <IconButton
            icon="replay"
            flip
            label={`Avançar ${String(SEEK_SECONDS)} segundos`}
            onClick={send({ type: 'seekBy', seconds: SEEK_SECONDS })}
            disabled={busy}
            testId="forward10"
          />
          <IconButton
            icon="skipNext"
            label="Próximo episódio"
            onClick={() => {
              if (nextEpisode !== null) onEpisode(nextEpisode);
            }}
            disabled={busy || nextEpisode === null}
            testId="next"
          />
        </div>

        {skip && (
          <button
            type="button"
            class="button button--outline"
            disabled={busy}
            onClick={send({ type: 'skip' })}
            data-testid="skip"
          >
            <Icon name="fastForward" />
            {skip.kind === 'recap' ? 'Pular recapitulação' : 'Pular abertura'}
          </button>
        )}

        {notice && (
          <p class="notice" role="alert">
            {notice}
          </p>
        )}
      </section>

      <section class="card" aria-label="Volume">
        <div class="line">
          <IconButton
            icon={player.muted ? 'volumeOff' : 'volumeUp'}
            label={player.muted ? 'Ativar som' : 'Silenciar'}
            onClick={send({ type: 'toggleMute' })}
            disabled={busy}
            pressed={player.muted}
            testId="toggle-mute"
          />
          <input
            type="range"
            class="slider"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            disabled={busy}
            aria-label="Volume"
            style={{ '--value': `${String(volume * 100)}%` }}
            onChange={(event) => {
              run({ type: 'setVolume', volume: Number(event.currentTarget.value) });
            }}
            data-testid="volume"
          />
          <output class="line__value" aria-live="polite" data-testid="volume-value">
            {player.muted ? 'Mudo' : `${String(Math.round(player.volume * 100))}%`}
          </output>
        </div>
      </section>

      <section class="card" aria-label="Episódio, áudio, legendas e velocidade">
        {title && title.seasons.length > 0 && (
          <Field label="Episódio">
            <EpisodeSelect title={title} disabled={busy} onEpisode={onEpisode} />
          </Field>
        )}
        {title && (
          <>
            <TrackSelect
              label="Áudio"
              tracks={title.audioTracks}
              value={title.audioTrack}
              disabled={busy}
              onChange={(trackId) => {
                run({ type: 'setAudioTrack', trackId });
              }}
              testId="audio-track"
            />
            <TrackSelect
              label="Legendas"
              tracks={title.textTracks}
              value={title.textTrack}
              disabled={busy}
              onChange={(trackId) => {
                run({ type: 'setTextTrack', trackId });
              }}
              testId="text-track"
            />
          </>
        )}
        <SpeedSelect
          value={player.playbackRate}
          disabled={busy}
          onChange={(rate) => {
            run({ type: 'setSpeed', rate });
          }}
        />
      </section>

      <footer class="footer">
        <button
          type="button"
          class="button"
          disabled={busy}
          onClick={onFullscreen}
          data-testid="fullscreen"
        >
          <Icon name={fullscreen ? 'fullscreenExit' : 'fullscreen'} />
          {fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
        </button>
        <button type="button" class="button" disabled={busy} onClick={onExit} data-testid="exit">
          <Icon name="arrowBack" />
          Sair do título
        </button>
      </footer>
    </>
  );
}

function Field({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="field">
      <span class="field__label">{label}</span>
      {children}
    </div>
  );
}

interface IconButtonProps {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled: boolean;
  testId: string;
  flip?: boolean;
  pressed?: boolean;
}

function IconButton({ icon, label, onClick, disabled, testId, flip, pressed }: IconButtonProps) {
  return (
    <button
      type="button"
      class="icon-button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      data-testid={testId}
    >
      <Icon name={icon} flip={flip} />
    </button>
  );
}
