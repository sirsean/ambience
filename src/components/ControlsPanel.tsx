import type { ChimeCatalog, ChimeCatalogEntry } from '../lib/chimeCatalog';
import type { ChimeSelection, ModePreference } from '../lib/preferences';
import { chimeLabel } from '../lib/preferences';
import type { TrackSummary } from '../audio/types';
import type { Milieu } from '../audio/types';
import { milieuLabel } from '../hooks/useMilieu';

interface ControlsPanelProps {
  milieu: Milieu;
  mode: ModePreference;
  tracks: TrackSummary[];
  selectedTrackId: string | null;
  chimeCatalog: ChimeCatalog;
  chimeSelection: ChimeSelection;
  defaultChimeIds: string[];
  musicVolume: number;
  chimeVolume: number;
  onModeChange: (mode: ModePreference) => void;
  onTrackSelect: (id: string) => void;
  onMusicVolumeChange: (volume: number) => void;
  onChimeVolumeChange: (volume: number) => void;
  onChimeSelectionChange: (selection: ChimeSelection) => void;
  visible: boolean;
  onToggle: () => void;
}

const MODE_OPTIONS: { value: ModePreference; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'sunrise', label: 'Sunrise' },
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
];

function volumePercent(value: number): number {
  return Math.round(value * 100);
}

export function ControlsPanel({
  milieu,
  mode,
  tracks,
  selectedTrackId,
  chimeCatalog,
  chimeSelection,
  defaultChimeIds,
  musicVolume,
  chimeVolume,
  onModeChange,
  onTrackSelect,
  onMusicVolumeChange,
  onChimeVolumeChange,
  onChimeSelectionChange,
  visible,
  onToggle,
}: ControlsPanelProps) {
  const filteredTracks = tracks.filter((t) => t.milieu === milieu);
  const milieuChimes = chimeCatalog[milieu];
  const defaultIdSet = new Set(defaultChimeIds);
  const enabledIdSet = new Set(chimeSelection.enabledIds);
  const isChimeAuto = chimeSelection.mode === 'auto';

  const isChimeActive = (chime: ChimeCatalogEntry): boolean => {
    if (isChimeAuto) return defaultIdSet.has(chime.id);
    return enabledIdSet.has(chime.id);
  };

  const handleChimeAuto = () => {
    onChimeSelectionChange({ mode: 'auto', enabledIds: [] });
  };

  const handleChimeCustom = () => {
    if (!isChimeAuto) return;
    onChimeSelectionChange({ mode: 'custom', enabledIds: [...defaultChimeIds] });
  };

  const handleChimeToggle = (chimeId: string) => {
    const baseIds = isChimeAuto ? defaultChimeIds : chimeSelection.enabledIds;
    const next = new Set(baseIds);
    if (next.has(chimeId)) {
      next.delete(chimeId);
    } else {
      next.add(chimeId);
    }
    onChimeSelectionChange({ mode: 'custom', enabledIds: [...next] });
  };

  return (
    <div className={`controls-panel ${visible ? 'controls-panel--open' : ''}`}>
      <button type="button" className="controls-panel__toggle" onClick={onToggle} aria-label="Toggle controls">
        ⚙
      </button>
      {visible && (
        <div className="controls-panel__panel">
          <section className="controls-section">
            <h2>Mode</h2>
            <div className="controls-segmented">
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={mode === option.value ? 'active' : ''}
                  onClick={() => onModeChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="controls-section">
            <h2>{milieuLabel(milieu)} volume</h2>
            <label className="controls-slider">
              <span>Music</span>
              <input
                type="range"
                min={0}
                max={100}
                value={volumePercent(musicVolume)}
                onChange={(e) => onMusicVolumeChange(Number(e.target.value) / 100)}
              />
              <span className="controls-slider__value">{volumePercent(musicVolume)}%</span>
            </label>
            <label className="controls-slider">
              <span>Chimes</span>
              <input
                type="range"
                min={0}
                max={100}
                value={volumePercent(chimeVolume)}
                onChange={(e) => onChimeVolumeChange(Number(e.target.value) / 100)}
              />
              <span className="controls-slider__value">{volumePercent(chimeVolume)}%</span>
            </label>
          </section>

          <section className="controls-section">
            <h2>{milieuLabel(milieu)} tracks</h2>
            {filteredTracks.length === 0 ? (
              <p className="muted">No tracks for this time of day yet.</p>
            ) : (
              <ul className="controls-list">
                {filteredTracks.map((track) => (
                  <li key={track.id}>
                    <button
                      type="button"
                      className={track.id === selectedTrackId ? 'active' : ''}
                      onClick={() => onTrackSelect(track.id)}
                    >
                      {track.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="controls-section">
            <h2>{milieuLabel(milieu)} chimes</h2>
            <div className="controls-segmented controls-segmented--2">
              <button type="button" className={isChimeAuto ? 'active' : ''} onClick={handleChimeAuto}>
                Auto
              </button>
              <button type="button" className={!isChimeAuto ? 'active' : ''} onClick={handleChimeCustom}>
                Custom
              </button>
            </div>
            {isChimeAuto ? (
              <p className="muted controls-chime-hint">Using this track&apos;s defaults. Tap Custom or toggle a chime to choose your own.</p>
            ) : (
              <p className="muted controls-chime-hint">Choose which chimes play in {milieuLabel(milieu).toLowerCase()} mode.</p>
            )}
            {milieuChimes.length === 0 ? (
              <p className="muted">No chimes available for this mode.</p>
            ) : (
              <ul className="controls-chime-list">
                {milieuChimes.map((chime) => {
                  const active = isChimeActive(chime);
                  const isDefault = defaultIdSet.has(chime.id);
                  return (
                    <li key={chime.id}>
                      <label className={`controls-chime-item ${active ? 'controls-chime-item--active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => handleChimeToggle(chime.id)}
                        />
                        <span className="controls-chime-item__label">{chimeLabel(chime.id)}</span>
                        {isChimeAuto && isDefault && (
                          <span className="controls-chime-item__badge">default</span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
