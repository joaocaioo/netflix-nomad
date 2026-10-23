import type { ComponentChildren } from 'preact';
import { ERROR_MESSAGES } from '@/lib/errors';
import { SPEEDS, type PlayerCommand, type PlayerControl, type PlayerState } from '@/lib/messages';
import { VOLUME_STEP } from '@/lib/player';
import { formatTime } from '@/lib/time';
import { Icon, type IconName } from './icons';
import { usePlayer } from './usePlayer';

export function App() {
  const { view, busy, connect, run, fullscreen } = usePlayer();

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
            busy={busy}
            run={(command) => void run(command)}
            onFullscreen={() => void fullscreen()}
          />
          {view.notice && (
            <p class="status status--warning" role="alert">
              {ERROR_MESSAGES[view.notice]}
            </p>
          )}
        </>
      )}
    </main>
  );
}

interface ControlsProps {
  player: PlayerState;
  busy: boolean;
  run: (command: PlayerCommand) => void;
  onFullscreen: () => void;
}

function Controls({ player, busy, run, onFullscreen }: ControlsProps) {
  const press = (control: PlayerControl) => () => {
    run({ type: 'pressControl', control });
  };
  const volumePercent = String(Math.round(player.volume * 100));

  return (
    <>
      <Progress current={player.currentTime} duration={player.duration} />

      <div class="transport">
        <Button
          icon="replay"
          label="−10s"
          onClick={press('back10')}
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
          onClick={press('forward10')}
          disabled={busy}
          testId="forward10"
        />
      </div>

      <div class="row">
        <Button
          icon="fastForward"
          label="Pular abertura"
          onClick={press('skip')}
          disabled={busy}
          testId="skip"
        />
        <Button
          icon="skipNext"
          label="Próximo episódio"
          onClick={press('next')}
          disabled={busy}
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

      <div class="row">
        <Button
          icon="list"
          label="Episódios"
          onClick={press('episodes')}
          disabled={busy}
          testId="episodes"
        />
        <Button
          icon="subtitles"
          label="Áudio e legendas"
          onClick={press('audioSubtitles')}
          disabled={busy}
          testId="audio-subtitles"
        />
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
          onClick={press('exit')}
          disabled={busy}
          testId="exit"
        />
      </div>

      <button
        type="button"
        class="nomad"
        disabled={busy}
        onClick={() => {
          run({ type: 'nomadMode' });
        }}
        data-testid="nomad-mode"
      >
        Nomad Mode
      </button>
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
