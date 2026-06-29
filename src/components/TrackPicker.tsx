import type { TrackSummary } from '../audio/types';
import type { Milieu } from '../audio/types';
import { milieuLabel } from '../hooks/useMilieu';

interface TrackPickerProps {
  milieu: Milieu;
  tracks: TrackSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  visible: boolean;
  onToggle: () => void;
}

export function TrackPicker({ milieu, tracks, selectedId, onSelect, visible, onToggle }: TrackPickerProps) {
  const filtered = tracks.filter((t) => t.milieu === milieu);

  return (
    <div className={`track-picker ${visible ? 'track-picker--open' : ''}`}>
      <button type="button" className="track-picker__toggle" onClick={onToggle} aria-label="Toggle track picker">
        ♫
      </button>
      {visible && (
        <div className="track-picker__panel">
          <h2>{milieuLabel(milieu)} tracks</h2>
          {filtered.length === 0 ? (
            <p className="muted">No tracks for this time of day yet.</p>
          ) : (
            <ul>
              {filtered.map((track) => (
                <li key={track.id}>
                  <button
                    type="button"
                    className={track.id === selectedId ? 'active' : ''}
                    onClick={() => onSelect(track.id)}
                  >
                    {track.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
