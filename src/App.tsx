import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import type { Milieu, TrackSummary } from './audio/types';
import { AmbienceCanvas } from './components/AmbienceCanvas';
import { FullscreenPrompt } from './components/FullscreenPrompt';
import { FullscreenToggle } from './components/FullscreenToggle';
import { TrackPicker } from './components/TrackPicker';
import { WeatherBadge } from './components/WeatherBadge';
import { milieuLabel, useMilieu } from './hooks/useMilieu';
import { useGeolocation } from './hooks/useGeolocation';
import { useWeather } from './hooks/useWeather';
import { fetchTrackManifest, fetchTracks } from './lib/api';
import './styles/app.css';

const TRACK_STORAGE_KEY = 'ambience-selected-track';
const IDLE_MS = 4000;

function loadStoredTrack(): string | null {
  return localStorage.getItem(TRACK_STORAGE_KEY);
}

function storeTrack(id: string): void {
  localStorage.setItem(TRACK_STORAGE_KEY, id);
}

export default function App() {
  const milieuState = useMilieu();
  const geo = useGeolocation();
  const { weather, modifiers, loading: weatherLoading } = useWeather(geo.lat, geo.lon);

  const [started, setStarted] = useState(false);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(loadStoredTrack());
  const [trackPickerOpen, setTrackPickerOpen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [audioEngine, setAudioEngine] = useState<AudioEngine | null>(null);
  const prevMilieuRef = useRef<Milieu>(milieuState.milieu);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimer = useCallback(() => {
    setControlsVisible(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setControlsVisible(false), IDLE_MS);
  }, []);

  useEffect(() => {
    resetIdleTimer();
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('touchstart', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('touchstart', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [resetIdleTimer]);

  useEffect(() => {
    fetchTracks()
      .then(setTracks)
      .catch(() => setError('Could not load tracks'));
  }, []);

  const loadAndPlay = useCallback(
    async (trackId: string, milieu: Milieu) => {
      try {
        let engine = audioEngine;
        if (!engine) {
          engine = new AudioEngine();
          setAudioEngine(engine);
        }
        const { manifest, prefix } = await fetchTrackManifest(trackId);
        await engine.start(manifest, prefix, milieu);
        setSelectedTrackId(trackId);
        storeTrack(trackId);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load track');
      }
    },
    [audioEngine],
  );

  const handleStart = async () => {
    setStarted(true);
    const milieuTracks = tracks.filter((t) => t.milieu === milieuState.milieu);
    const trackId =
      selectedTrackId && milieuTracks.some((t) => t.id === selectedTrackId)
        ? selectedTrackId
        : milieuTracks[0]?.id ?? tracks[0]?.id;

    if (trackId) {
      await loadAndPlay(trackId, milieuState.milieu);
    }
  };

  const handleTrackSelect = async (id: string) => {
    if (!started) return;
    await loadAndPlay(id, milieuState.milieu);
    setTrackPickerOpen(false);
  };

  useEffect(() => {
    if (!started || !audioEngine) return;

    audioEngine.setMilieu(milieuState.milieu);

    if (prevMilieuRef.current !== milieuState.milieu && milieuState.blendT < 0.05) {
      audioEngine.crossfadeMilieu();
      const milieuTracks = tracks.filter((t) => t.milieu === milieuState.milieu);
      const currentStillValid = selectedTrackId && milieuTracks.some((t) => t.id === selectedTrackId);
      if (!currentStillValid && milieuTracks[0]) {
        loadAndPlay(milieuTracks[0].id, milieuState.milieu);
      }
    }

    prevMilieuRef.current = milieuState.milieu;
  }, [milieuState, started, tracks, selectedTrackId, loadAndPlay, audioEngine]);

  if (!started) {
    return (
      <div className="enter-gate">
        <div className="enter-gate__content">
          <h1>Ambience</h1>
          <p>Visual and audio ambience shaped by your time of day and local weather.</p>
          <p className="enter-gate__milieu">
            Current period: <strong>{milieuLabel(milieuState.milieu)}</strong>
          </p>
          {error && <p className="error">{error}</p>}
          <button type="button" className="enter-gate__button" onClick={handleStart}>
            Enter ambience
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AmbienceCanvas
        milieuState={milieuState}
        weatherModifiers={modifiers}
        audioEngine={audioEngine}
        active={started}
      />

      <FullscreenToggle />

      <div className={`overlay ${controlsVisible ? 'overlay--visible' : ''}`}>
        <FullscreenPrompt />
        <WeatherBadge
          weather={weather}
          timezone={milieuState.timezone}
          loading={weatherLoading}
          geoError={geo.error}
          onRetryGeo={geo.request}
        />
        <div className="milieu-indicator">{milieuLabel(milieuState.milieu)}</div>
        <TrackPicker
          milieu={milieuState.milieu}
          tracks={tracks}
          selectedId={selectedTrackId}
          onSelect={handleTrackSelect}
          visible={trackPickerOpen}
          onToggle={() => setTrackPickerOpen((v) => !v)}
        />
        {error && <p className="error overlay-error">{error}</p>}
      </div>
    </div>
  );
}
