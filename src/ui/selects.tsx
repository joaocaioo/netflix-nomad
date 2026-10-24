import { SPEEDS, type Speed, type TitleInfo, type Track } from '@/lib/messages';

/** A Netflix costuma nomear episódios sem título como "Episódio N". */
export function episodeLabel(seq: number, title: string): string {
  return title === `Episódio ${String(seq)}` ? title : `${String(seq)}. ${title}`;
}

interface EpisodeSelectProps {
  title: TitleInfo;
  disabled: boolean;
  onEpisode: (episodeId: number) => void;
}

/** Todas as temporadas numa lista só, com o episódio atual selecionado. */
export function EpisodeSelect({ title, disabled, onEpisode }: EpisodeSelectProps) {
  return (
    <select
      class="select"
      aria-label="Episódio"
      disabled={disabled}
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
  );
}

interface TrackSelectProps {
  label: string;
  tracks: Track[];
  value: string | null;
  disabled: boolean;
  onChange: (trackId: string) => void;
  testId: string;
}

export function TrackSelect({
  label,
  tracks,
  value,
  disabled,
  onChange,
  testId,
}: TrackSelectProps) {
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

/** "1,25×", com vírgula, como no resto da interface. */
export function speedLabel(rate: number): string {
  return `${String(rate).replace('.', ',')}×`;
}

interface SpeedSelectProps {
  value: number;
  disabled: boolean;
  onChange: (rate: Speed) => void;
}

export function SpeedSelect({ value, disabled, onChange }: SpeedSelectProps) {
  return (
    <label class="field">
      <span class="field__label">Velocidade</span>
      <select
        class="select"
        disabled={disabled}
        value={String(value)}
        onChange={(event) => {
          const rate = SPEEDS.find((speed) => String(speed) === event.currentTarget.value);
          if (rate !== undefined) onChange(rate);
        }}
        data-testid="speed"
      >
        {SPEEDS.map((rate) => (
          <option key={rate} value={String(rate)}>
            {speedLabel(rate)}
          </option>
        ))}
      </select>
    </label>
  );
}
