import React from 'react';
import type { TimelineMarker } from '../types';

interface TimelineScrubberProps {
  currentLap: number;
  totalLaps: number;
  sessionTime?: number | null;
  isPaused: boolean;
  playbackSpeed: number;
  onPlayPause: () => void;
  onSeekLap: (lap: number) => void;
  onSpeedChange: (speed: number) => void;
  onStep: () => void;
  markers?: TimelineMarker[];
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  currentLap,
  totalLaps,
  sessionTime,
  isPaused,
  playbackSpeed,
  onPlayPause,
  onSeekLap,
  onSpeedChange,
  onStep,
  markers = [],
}) => {
  const speeds = [0.5, 1.0, 2.0, 4.0];

  const formatTime = (seconds?: number | null) => {
    if (seconds === undefined || seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const lapProgressPercent = Math.min(100, Math.max(0, (currentLap / Math.max(1, totalLaps)) * 100));

  return (
    <div className="timeline-scrubber-bar">
      <div className="scrubber-controls">
        <button
          className={`btn-play-pause ${isPaused ? 'paused' : 'playing'}`}
          onClick={onPlayPause}
          title={isPaused ? 'Resume Replay (SPACE)' : 'Pause Replay (SPACE)'}
        >
          {isPaused ? '▶ PLAY' : '❚❚ PAUSE'}
        </button>

        <button className="btn-step" onClick={onStep} title="Step 1 frame (LEFT/RIGHT ARROW)">
          ⏭ STEP
        </button>

        <div className="speed-selector">
          <span className="label">PLAYBACK RATE:</span>
          {speeds.map((s) => (
            <button
              key={s}
              className={`speed-pill ${playbackSpeed === s ? 'active' : ''}`}
              onClick={() => onSpeedChange(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="scrubber-slider-track">
        <div className="lap-info-row">
          <span className="lap-indicator mono font-bold">
            LAP {currentLap} / {totalLaps}
          </span>
          <span className="session-time mono text-muted">
            SOURCE TIME: {formatTime(sessionTime)}
          </span>
        </div>

        <div className="range-wrapper">
          <input
            type="range"
            min={1}
            max={totalLaps}
            value={currentLap}
            onChange={(e) => onSeekLap(parseInt(e.target.value, 10))}
            className="timeline-slider"
          />
          <div
            className="slider-fill"
            style={{ width: `${lapProgressPercent}%` }}
          />

          {/* Timeline Event Markers */}
          <div className="timeline-markers-layer">
            {markers.map((m) => {
              if (!m.lap || m.lap <= 0 || m.lap > totalLaps) return null;
              const posPercent = (m.lap / totalLaps) * 100;
              const markerClass = m.event_type.toLowerCase();

              return (
                <div
                  key={m.id}
                  className={`timeline-marker-pin marker-${markerClass}`}
                  style={{ left: `${posPercent}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeekLap(m.lap!);
                  }}
                  title={`Lap ${m.lap}: ${m.label || m.event_type} (Click to seek)`}
                >
                  <span className="pin-dot" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
