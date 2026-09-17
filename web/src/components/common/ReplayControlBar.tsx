import React from 'react';

interface ReplayControlBarProps {
  currentLap: number;
  totalLaps: number;
  sessionTime?: number | null;
  isPaused: boolean;
  playbackSpeed: number;
  eventId: string;
  sourceMode?: string;
  onPlayPause: () => void;
  onStepForward: () => void;
  onStepBack: () => void;
  onSeekLap: (lap: number) => void;
  onSpeedChange: (speed: number) => void;
}

export const ReplayControlBar: React.FC<ReplayControlBarProps> = ({
  currentLap,
  totalLaps = 53,
  sessionTime,
  isPaused,
  playbackSpeed,
  eventId,
  sourceMode = 'HISTORICAL_REPLAY',
  onPlayPause,
  onStepForward,
  onStepBack,
  onSeekLap,
  onSpeedChange,
}) => {
  const speeds = [0.5, 1.0, 2.0, 4.0, 8.0, 16.0];

  const formatTime = (secs?: number | null) => {
    if (secs == null) return '--:--';
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder.toString().padStart(2, '0')}`;
  };

  const progressPercent = Math.min(100, Math.max(0, (currentLap / Math.max(1, totalLaps)) * 100));

  return (
    <div className="kyntra-replay-hud-bar" aria-label="Historical Replay HUD Controls">
      {/* 1. Left Controls: Play/Pause, Step Back, Step Forward */}
      <div className="replay-hud-left">
        <button
          type="button"
          className={`btn-replay-action btn-play ${isPaused ? 'is-paused' : 'is-playing'}`}
          onClick={onPlayPause}
          disabled={!totalLaps}
          title={isPaused ? 'Play Replay (SPACE)' : 'Pause Replay (SPACE)'}
        >
          {isPaused ? '▶ PLAY' : '❚❚ PAUSE'}
        </button>

        <button
          type="button"
          className="btn-replay-action btn-step"
          onClick={onStepBack}
          title="Step 1 Lap Back"
          disabled={currentLap <= 1 || !totalLaps}
        >
          ⏮ BACK
        </button>

        <button
          type="button"
          className="btn-replay-action btn-step"
          onClick={onStepForward}
          title="Step 1 Lap Forward (→)"
          disabled={currentLap >= totalLaps}
        >
          NEXT ⏭
        </button>

        {/* Speed Selector */}
        <div className="replay-speed-group mono">
          <span className="speed-lbl text-muted">PLAYBACK RATE:</span>
          {speeds.map((s) => (
            <button
              key={s}
              type="button"
              className={`speed-btn ${playbackSpeed === s ? 'active' : ''}`}
              onClick={() => onSpeedChange(s)}
              disabled={!totalLaps}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* 2. Center Scrubber Slider */}
      <div className="replay-hud-center">
        <div className="scrubber-track-wrapper">
          <input
            type="range"
            aria-label="Replay lap"
            disabled={!totalLaps}
            min={1}
            max={Math.max(1,totalLaps)}
            value={Math.max(1,currentLap)}
            onChange={(e) => onSeekLap(parseInt(e.target.value, 10))}
            className="replay-slider"
            title={`Scrub replay: Lap ${currentLap} of ${totalLaps}`}
          />
          <div
            className="replay-slider-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 3. Right Telemetry Context */}
      <div className="replay-hud-right mono">
        <div className="hud-metric">
          <span className="h-lbl text-muted">SOURCE:</span>
          <span className="h-val font-bold text-accent">{sourceMode}</span>
        </div>
        <div className="hud-metric">
          <span className="h-lbl text-muted">EVENT:</span>
          <span className="h-val font-bold text-primary">[{eventId}]</span>
        </div>
        <div className="hud-metric">
          <span className="h-lbl text-muted">LAP:</span>
          <span className="h-val font-bold text-primary">{currentLap || '—'} / {totalLaps || '—'}</span>
        </div>
        <div className="hud-metric">
          <span className="h-lbl text-muted">SOURCE TIME:</span>
          <span className="h-val text-secondary font-bold">{formatTime(sessionTime)}</span>
        </div>
      </div>
    </div>
  );
};
