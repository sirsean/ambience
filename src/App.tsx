import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import type { Milieu, TrackSummary } from './audio/types';
import { AmbienceCanvas } from './components/AmbienceCanvas';
import { ControlsPanel } from './components/ControlsPanel';
import { FullscreenPrompt } from './components/FullscreenPrompt';
import { FullscreenToggle } from './components/FullscreenToggle';
import { WeatherBadge } from './components/WeatherBadge';
import { milieuLabel, useMilieu } from './hooks/useMilieu';
import { useGeolocation } from './hooks/useGeolocation';
import { useWeather } from './hooks/useWeather';
import { buildChimeCatalog, type ChimeCatalog } from './lib/chimeCatalog';
import { fetchTrackManifest, fetchTracks } from './lib/api';
import { exposeAmbienceConsole } from './lib/ambienceConsole';
import { audioLog } from './audio/audioLog';
import {
  getEffectiveMilieu,
  loadPreferences,
  type ChimeSelection,
  type ModePreference,
  type UserPreferences,
  updatePreferences,
} from './lib/preferences';
import './styles/app.css';

const IDLE_MS = 4000;
const EMPTY_CHIME_CATALOG: ChimeCatalog = { night: [], sunrise: [], day: [] };

function resolveTrackForMilieu(
  milieu: Milieu,
  tracks: TrackSummary[],
  prefs: UserPreferences,
): string | undefined {
  const milieuTracks = tracks.filter((t) => t.milieu === milieu);
  const stored = prefs.tracks[milieu];
  if (stored && milieuTracks.some((t) => t.id === stored)) return stored;
  return milieuTracks[0]?.id ?? tracks[0]?.id;
}

function activeChimeIds(selection: ChimeSelection): string[] | null {
  return selection.mode === 'auto' ? null : selection.enabledIds;
}

export default function App() {
  const milieuState = useMilieu();
  const geo = useGeolocation();
  const { weather, modifiers, loading: weatherLoading } = useWeather(geo.lat, geo.lon);

  const [prefs, setPrefs] = useState<UserPreferences>(() => loadPreferences());
  const effectiveMilieu = useMemo(
    () => getEffectiveMilieu(prefs.mode, milieuState.milieu),
    [prefs.mode, milieuState.milieu],
  );

  const [started, setStarted] = useState(false);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [chimeCatalog, setChimeCatalog] = useState<ChimeCatalog>(EMPTY_CHIME_CATALOG);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [defaultChimeIds, setDefaultChimeIds] = useState<string[]>([]);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [audioEngine, setAudioEngine] = useState<AudioEngine | null>(null);
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const prevEffectiveMilieuRef = useRef<Milieu>(effectiveMilieu);

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
      .then(async (loaded) => {
        setTracks(loaded);
        const catalog = await buildChimeCatalog(loaded);
        setChimeCatalog(catalog);
      })
      .catch(() => setError('Could not load tracks'));
  }, []);

  const applyAudioPreferences = useCallback((engine: AudioEngine, nextPrefs: UserPreferences, milieu: Milieu) => {
    const volumes = nextPrefs.volumes[milieu];
    engine.setMusicVolume(volumes.music);
    engine.setChimeVolume(volumes.chime);
    engine.setMilieuChimeSources(chimeCatalog[milieu].map((entry) => ({
      id: entry.id,
      definition: entry,
      prefix: entry.prefix,
    })));
    engine.setActiveChimes(activeChimeIds(nextPrefs.chimes[milieu]));
  }, [chimeCatalog]);

  const loadAndPlay = useCallback(async (trackId: string, milieu: Milieu, reason: string) => {
    audioLog('Track change requested', { trackId, milieu, reason });
    try {
      let engine = audioEngineRef.current;
      if (!engine) {
        engine = new AudioEngine();
        audioEngineRef.current = engine;
        setAudioEngine(engine);
      }

      const currentPrefs = loadPreferences();
      applyAudioPreferences(engine, currentPrefs, milieu);

      const { manifest, prefix } = await fetchTrackManifest(trackId);
      await engine.start(manifest, prefix, milieu, { reason });
      setSelectedTrackId(trackId);
      setDefaultChimeIds(engine.getDefaultChimeIds());

      const nextPrefs = updatePreferences({
        tracks: { ...currentPrefs.tracks, [milieu]: trackId },
      });
      setPrefs(nextPrefs);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load track';
      audioLog('Track change FAILED', { trackId, milieu, reason, error: message });
      setError(message);
    }
  }, [applyAudioPreferences]);

  const handleStart = async () => {
    setStarted(true);
    const trackId = resolveTrackForMilieu(effectiveMilieu, tracks, prefs);
    if (trackId) {
      await loadAndPlay(trackId, effectiveMilieu, 'enter');
    }
  };

  const handleTrackSelect = async (id: string) => {
    if (!started) return;
    await loadAndPlay(id, effectiveMilieu, 'user-select');
  };

  const handleModeChange = (mode: ModePreference) => {
    const nextPrefs = updatePreferences({ mode });
    setPrefs(nextPrefs);
  };

  const handleMusicVolumeChange = (musicVolume: number) => {
    const nextPrefs = updatePreferences({
      volumes: { [effectiveMilieu]: { music: musicVolume } },
    });
    setPrefs(nextPrefs);
    audioEngineRef.current?.setMusicVolume(musicVolume);
  };

  const handleChimeVolumeChange = (chimeVolume: number) => {
    const nextPrefs = updatePreferences({
      volumes: { [effectiveMilieu]: { chime: chimeVolume } },
    });
    setPrefs(nextPrefs);
    audioEngineRef.current?.setChimeVolume(chimeVolume);
  };

  const handleChimeSelectionChange = (selection: ChimeSelection) => {
    const nextPrefs = updatePreferences({
      chimes: { ...prefs.chimes, [effectiveMilieu]: selection },
    });
    setPrefs(nextPrefs);
    audioEngineRef.current?.setActiveChimes(activeChimeIds(selection));
  };

  useEffect(() => {
    if (!started || !audioEngine) return;

    exposeAmbienceConsole({
      triggerChime: (overrides) => audioEngine.triggerChime(overrides),
    });
  }, [started, audioEngine]);

  useEffect(() => {
    if (!started || tracks.length === 0) return;

    const engine = audioEngineRef.current;
    if (!engine) return;

    const milieuChanged = prevEffectiveMilieuRef.current !== effectiveMilieu;
    if (milieuChanged) {
      prevEffectiveMilieuRef.current = effectiveMilieu;
      const trackId = resolveTrackForMilieu(effectiveMilieu, tracks, prefs);
      if (trackId) {
        void loadAndPlay(trackId, effectiveMilieu, 'milieu-change');
        return;
      }
    }

    engine.setMilieu(effectiveMilieu);
    applyAudioPreferences(engine, prefs, effectiveMilieu);
  }, [effectiveMilieu, started, tracks, prefs, loadAndPlay, applyAudioPreferences]);

  useEffect(() => {
    if (!started || !audioEngineRef.current || chimeCatalog[effectiveMilieu].length === 0) return;
    audioEngineRef.current.setMilieuChimeSources(
      chimeCatalog[effectiveMilieu].map((entry) => ({
        id: entry.id,
        definition: entry,
        prefix: entry.prefix,
      })),
    );
    audioEngineRef.current.setActiveChimes(activeChimeIds(prefs.chimes[effectiveMilieu]));
  }, [chimeCatalog, effectiveMilieu, started, prefs.chimes]);

  const modeLabel =
    prefs.mode === 'auto' ? `${milieuLabel(effectiveMilieu)} (auto)` : milieuLabel(effectiveMilieu);

  if (!started) {
    return (
      <div className="enter-gate">
        <div className="enter-gate__content">
          <h1>Ambience</h1>
          <p>Visual and audio ambience shaped by your time of day and local weather.</p>
          <p className="enter-gate__milieu">
            Current period: <strong>{modeLabel}</strong>
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
        milieuState={{
          ...milieuState,
          milieu: effectiveMilieu,
          previousMilieu: prefs.mode === 'auto' ? milieuState.previousMilieu : effectiveMilieu,
          blendT: prefs.mode === 'auto' ? milieuState.blendT : 1,
        }}
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
        <div className="milieu-indicator">{modeLabel}</div>
        <ControlsPanel
          milieu={effectiveMilieu}
          mode={prefs.mode}
          tracks={tracks}
          selectedTrackId={selectedTrackId}
          chimeCatalog={chimeCatalog}
          chimeSelection={prefs.chimes[effectiveMilieu]}
          defaultChimeIds={defaultChimeIds}
          musicVolume={prefs.volumes[effectiveMilieu].music}
          chimeVolume={prefs.volumes[effectiveMilieu].chime}
          onModeChange={handleModeChange}
          onTrackSelect={handleTrackSelect}
          onMusicVolumeChange={handleMusicVolumeChange}
          onChimeVolumeChange={handleChimeVolumeChange}
          onChimeSelectionChange={handleChimeSelectionChange}
          visible={controlsOpen}
          onToggle={() => setControlsOpen((v) => !v)}
        />
        {error && <p className="error overlay-error">{error}</p>}
      </div>
    </div>
  );
}
