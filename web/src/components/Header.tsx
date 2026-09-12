import React from 'react';
import type { ContextWorkspace, LayoutPreset, OperatingMode, RaceState } from '../types';

interface HeaderProps {
  currentMode: OperatingMode;
  onSelectMode: (mode: OperatingMode) => void;
  layoutPreset: LayoutPreset;
  onSelectLayoutPreset: (preset: LayoutPreset) => void;
  currentContext: ContextWorkspace;
  onSelectContext: (ctx: ContextWorkspace) => void;
  raceState: RaceState | null;
  wsConnected: boolean;
  onOpenSessionSwitcher?: () => void;
  onOpenInspector?: (type: 'MODEL' | 'ENERGY' | 'COMPLIANCE') => void;
  onOpenSystem?: () => void;
  onToggleShortcuts?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onSelectMode,
  layoutPreset,
  onSelectLayoutPreset,
  currentContext: _currentContext,
  onSelectContext: _onSelectContext,
  raceState,
  wsConnected: _wsConnected,
  onOpenSessionSwitcher,
  onOpenInspector,
  onOpenSystem,
  onToggleShortcuts,
}) => {
  const session = raceState?.session;
  const track = raceState?.track;
  const trackStatus = track?.track_status || '1';

  const isNeutralized = ['2', '4', '5', '6', '7', 'SC', 'VSC', 'RED'].includes(trackStatus);
  const trackStatusLabel =
    trackStatus === '4'
      ? 'SAFETY CAR'
      : trackStatus === '6' || trackStatus === '7'
      ? 'VSC'
      : trackStatus === '5'
      ? 'RED FLAG'
      : trackStatus === '2'
      ? 'YELLOW'
      : 'GREEN';

  const modes: OperatingMode[] = ['LIVE', 'REPLAY', 'FORECAST'];
  const presets: { id: LayoutPreset; label: string }[] = [
    { id: 'PIT_WALL', label: 'PIT WALL' },
    { id: 'ANALYSIS', label: 'ANALYSIS' },
    { id: 'DEMO', label: 'DEMO' },
  ];

  return (
    <header className="pitwall-header">
      {/* 1. Official Trimmed Brand Lockup (Optically aligned, no stacked subtitles) */}
      <div className="header-brand-block" title="KYNTRA — Predictive Racecraft Intelligence">
        <img
          src="/brand/kyntra-symbol-ui.png"
          alt="KYNTRA Symbol"
          className="official-kyntra-symbol-ui"
        />
        <img
          src="/brand/kyntra-wordmark-ui.png"
          alt="KYNTRA"
          className="official-kyntra-wordmark-ui"
        />
      </div>

      <div className="header-divider" />

      {/* 2. Primary Operating Mode Switcher */}
      <nav className="primary-mode-nav" aria-label="Operating Modes">
        {modes.map((mode) => (
          <button
            key={mode}
            type="button"
            className={`mode-tab-btn ${currentMode === mode ? 'active' : ''}`}
            onClick={() => onSelectMode(mode)}
          >
            {mode}
          </button>
        ))}
      </nav>

      <div className="header-divider" />

      {/* 3. Workstation Layout Presets (PIT WALL | ANALYSIS | DEMO) */}
      <nav className="layout-preset-nav" aria-label="Workstation Layout Presets">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`preset-tab-btn ${layoutPreset === preset.id ? 'active' : ''}`}
            onClick={() => onSelectLayoutPreset(preset.id)}
            title={`Switch to ${preset.label} workstation layout`}
          >
            {preset.label}
          </button>
        ))}
      </nav>

      {/* 4. Session / Circuit Context (Clickable Hot-Swap Replay) */}
      <div
        className="header-session-context interactive-pill-btn"
        onClick={onOpenSessionSwitcher}
        title="Click to Switch Race Session / Demo Circuit"
        role="button"
        tabIndex={0}
      >
        <div className="status-pill session-pill">
          <span className="session-circuit-text font-bold">
            {session?.event_name || '—'}
          </span>
          <span className="session-type-sub">RACE</span>
          <span className="session-lap-counter mono font-bold text-accent">
            {session ? `L${session.current_lap} / ${session.total_laps}` : 'L— / —'}
          </span>
          <span className="pill-caret">▾</span>
        </div>
      </div>

      {/* 5. Minimal Pit-Wall Status Ribbon */}
      <div className="header-status-ribbon">
        {/* Track Flag State */}
        <div
          className={`status-pill pill-flag ${isNeutralized ? 'flag-neutralized' : 'flag-clear'}`}
          title={`Track Status: ${trackStatus}`}
        >
          <span className="flag-dot" />
          <span className="pill-val mono font-bold">{trackStatusLabel}</span>
        </div>

        {/* Stream Link State */}
        <div className="status-pill pill-stream" title="Telemetry Ingress Pipeline Active">
          <span className="stream-live-dot" />
          <span className="pill-val mono font-bold">
            {currentMode === 'REPLAY' ? 'REPLAY STREAM' : 'STREAM ACTIVE'}
          </span>
        </div>

        {/* Model Bundle Indicator */}
        <button
          type="button"
          className="status-pill pill-btn"
          title="LightGBM Overtake V1 (PAV Monotonic). Click to inspect evidence."
          onClick={() => onOpenInspector && onOpenInspector('MODEL')}
        >
          <span className="pill-val mono font-bold text-accent">MODEL V1</span>
        </button>

        {/* System Utility Button (Far Right) */}
        <button
          type="button"
          className="status-pill pill-btn system-utility-btn"
          title="Open Engineering Diagnostics, Provenance & Provider Capability Matrix"
          onClick={onOpenSystem}
        >
          <span className="pill-val font-bold">SYSTEM</span>
        </button>

        {/* Keyboard Operations Cheat Sheet */}
        {onToggleShortcuts && (
          <button
            type="button"
            className="status-pill pill-btn shortcuts-btn"
            onClick={onToggleShortcuts}
            title="Keyboard Shortcuts Cheat Sheet (Press ?)"
          >
            <span className="pill-val mono">⌨</span>
          </button>
        )}
      </div>
    </header>
  );
};
