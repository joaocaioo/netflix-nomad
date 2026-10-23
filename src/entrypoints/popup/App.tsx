import type { ComponentChildren } from 'preact';
import { ERROR_MESSAGES } from '@/lib/errors';
import {
  SEEK_SECONDS,
  SPEEDS,
  type PlayerCommand,
  type PlayerState,
  type TitleInfo,
  type Track,
} from '@/lib/messages';
import { VOLUME_STEP } from '@/lib/player';
import { formatTime } from '@/lib/time';
import { Icon, type IconName } from './icons';
import { usePlayer } from './usePlayer';

export function App() {
  const { view, title, busy, connect, run, playEpisode, exit, fullscreen, nomad, nomadError } =
    usePlayer();

  return (
    <main class="popup">
      <h1 class="title">Netflix Nomad</h1>

      {view.status === 'loading' && (
        <p class="status" role="status">
          Conectando…
        </p>
      )}

      {view.status === 'error' && (
        <div class="status status--error" role="alert">
          <p>{ERROR_MESSAGES[view.error]}</p>
          <button type="button" onClick={() => void connect()}>
            Tentar de novo
          </button>
        </div>
      )}

      {view.status === 'ready' && (
        <>
          <Controls
            player={view.player}
            title={title}
            busy={busy}
            run={(command) => void run(command)}
            onEpisode={(episodeId) => void playEpisode(episodeId)}
            onExit={() => void exit()}
            onFullscreen={() => void fullscreen()}
          />
          {view.notice && (
            <p class="status status--warning" role="alert">
              {ERROR_MESSAGES[view.notice]}
            </p>
          )}
        </>
      )}

      {/* Sempre ativo: não depende de vídeo nem do estado da conexão. */}
      <button type="button" class="nomad" onClick={() => void nomad()} data-testid="nomad-mode">
        Nomad Mode
      </button>
      {nomadError && (
        <p class="status status--warning" role="alert" data-testid="nomad-error">
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
  run: (command: PlayerCommand) => void;
  onEpisode: (episodeId: number) => void;
  onExit: () => void;
  onFullscreen: () => void;
}

function Controls({ player, title, busy, run, onEpisode, onExit, onFullscreen }: ControlsProps) {
  const send = (command: PlayerCommand) => () => {
    run(command);
  };
  const nextEpisode = title?.nextEpisode ?? null;
  const volumePercent = String(Math.round(player.volume * 100));

  return (
    <>
      <Progress current={player.currentTime} duration={player.duration} />

      <div class="transport">
        <Button
          icon="replay"
          label="−10s"
          onClick={send({ type: 'seekBy', seconds: -SEEK_SECONDS })}
          disabled={busy}
          testId="back10"
        />
        <button
          type="button"
          class="primary"
          disabled={busy}
          onClick={() => {
            run({ type: 'togglePlay' });
          }}
          data-testid="toggle-play"
        >
          <Icon name={player.paused ? 'play' : 'pause'} />
          {player.paused ? 'Reproduzir' : 'Pausar'}
        </button>
        <Button
          icon="replay"
          flip
          label="+10s"
          onClick={send({ type: 'seekBy', seconds: SEEK_SECONDS })}
          disabled={busy}
          testId="forward10"
        />
      </div>

      <div class="row">
        <Button
          icon="fastForward"
          label="Pular abertura"
          onClick={send({ type: 'skip' })}
          disabled={busy}
          testId="skip"
        />
        <Button
          icon="skipNext"
          label="Próximo episódio"
          onClick={() => {
            if (nextEpisode !== null) onEpisode(nextEpisode);
          }}
          disabled={busy || nextEpisode === null}
          testId="next"
        />
      </div>

      <Section title="Volume">
        <div class="volume">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              run({ type: 'toggleMute' });
            }}
            aria-pressed={player.muted}
            aria-label={player.muted ? 'Ativar som' : 'Silenciar'}
            title={player.muted ? 'Ativar som' : 'Silenciar'}
            data-testid="toggle-mute"
          >
            <Icon name={player.muted ? 'volumeOff' : 'volumeUp'} />
          </button>
          <button
            type="button"
            disabled={busy || player.volume <= 0}
            onClick={() => {
              run({ type: 'changeVolume', delta: -VOLUME_STEP });
            }}
            aria-label="Diminuir volume"
            data-testid="volume-down"
          >
            −
          </button>
          <output class="volume__value" aria-live="polite" data-testid="volume">
            {player.muted ? 'Mudo' : `${volumePercent}%`}
          </output>
          <button
            type="button"
            disabled={busy || player.volume >= 1}
            onClick={() => {
              run({ type: 'changeVolume', delta: VOLUME_STEP });
            }}
            aria-label="Aumentar volume"
            data-testid="volume-up"
          >
            +
          </button>
        </div>
      </Section>

      <Section title="Velocidade">
        <div class="speeds" role="group" aria-label="Velocidade">
          {SPEEDS.map((rate) => (
            <button
              key={rate}
              type="button"
              disabled={busy}
              aria-pressed={player.playbackRate === rate}
              onClick={() => {
                run({ type: 'setSpeed', rate });
              }}
              data-testid={`speed-${String(rate)}`}
            >
              {String(rate).replace('.', ',')}×
            </button>
          ))}
        </div>
      </Section>

      {title && title.seasons.length > 0 && (
        <Section title="Episódio">
          <select
            class="select"
            aria-label="Episódio"
            disabled={busy}
            value={String(title.currentEpisode)}
            onChange={(event) => {
              onEpisode(Number(event.currentTarget.value));
            }}
            data-testid="episode"
          >
            {title.seasons.map((season) => (
              <optgroup key={season.title} label={season.title}>
                {season.episodes.map((episode) => (
                  <option key={episode.id} value={String(episode.id)}>
                    {episodeLabel(episode.seq, episode.title)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Section>
      )}

      {title && (
        <Section title="Áudio e legendas">
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
        </Section>
      )}

      <div class="row">
        <Button
          icon="fullscreen"
          label="Tela cheia"
          onClick={onFullscreen}
          disabled={busy}
          testId="fullscreen"
        />
        <Button
          icon="arrowBack"
          label="Sair do título"
          onClick={onExit}
          disabled={busy}
          testId="exit"
        />
      </div>
    </>
  );
}

function Progress({ current, duration }: { current: number; duration: number }) {
  const percent = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
  return (
    <div class="progress" data-testid="progress">
      <div
        class="progress__bar"
        role="progressbar"
        aria-label="Progresso"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(current)}
      >
        <div class="progress__fill" style={{ width: `${String(percent)}%` }} />
      </div>
      <div class="progress__times">
        <span>{formatTime(current)}</span>
        <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
      </div>
    </div>
  );
}

/** A Netflix costuma nomear episódios sem título como "Episódio N". */
function episodeLabel(seq: number, title: string): string {
  return title === `Episódio ${String(seq)}` ? title : `${String(seq)}. ${title}`;
}

interface TrackSelectProps {
  label: string;
  tracks: Track[];
  value: string | null;
  disabled: boolean;
  onChange: (trackId: string) => void;
  testId: string;
}

function TrackSelect({ label, tracks, value, disabled, onChange, testId }: TrackSelectProps) {
  return (
    <label class="field">
      <span class="field__label">{label}</span>
      <select
        class="select"
        disabled={disabled || tracks.length === 0}
        value={value ?? ''}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
        data-testid={testId}
      >
        {tracks.map((track) => (
          <option key={track.id} value={track.id}>
            {track.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Section({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="section">
      <h2 class="section__title">{title}</h2>
      {children}
    </section>
  );
}

interface ButtonProps {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled: boolean;
  testId: string;
  flip?: boolean;
}

function Button({ icon, label, onClick, disabled, testId, flip }: ButtonProps) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} data-testid={testId}>
      <Icon name={icon} flip={flip} />
      {label}
    </button>
  );
}
