import React from 'react';
import type { ContextWorkspace, SystemHealthStatus } from '../../types';
import { resolveSystemHealthDisplay } from '../../domain/types';

interface NavigationRailProps {
  currentContext: ContextWorkspace;
  onSelectContext: (ctx: ContextWorkspace) => void;
  runtimeMode: string;
  sourceProvider: string;
  systemHealth: SystemHealthStatus | string;
  onOpenSystemModal?: () => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  currentContext,
  onSelectContext,
  runtimeMode,
  sourceProvider,
  systemHealth,
  onOpenSystemModal,
}) => {
  const navItems: { id: ContextWorkspace; label: string; shortcut: string }[] = [
    { id: 'RACE', label: 'RACE', shortcut: '1' },
    { id: 'STRATEGY', label: 'STRATEGY', shortcut: '2' },
    { id: 'EVENTS', label: 'EVENTS', shortcut: '3' },
    { id: 'ANALYSIS', label: 'ANALYSIS', shortcut: '4' },
    { id: 'SYSTEM', label: 'SYSTEM', shortcut: '5' },
  ];

  const resolvedHealth = resolveSystemHealthDisplay(systemHealth as any);
  const isOk = resolvedHealth === 'OPERATIONAL';
  const isWarn = resolvedHealth.includes('DEGRADED');

  return (
    <aside className="kyntra-nav-rail" aria-label="Workstation Navigation Rail">
      {/* Brand Icon */}
      <div className="nav-brand-slot" title="KYNTRA Motorsport Strategy Operations">
        <img
          src="/brand/kyntra-symbol-ui.png"
          alt="KYNTRA"
          className="nav-brand-logo"
        />
      </div>

      {/* Primary Workstation Navigation Tabs */}
      <nav className="nav-tabs-group">
        {navItems.map((item) => {
          const isActive = currentContext === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectContext(item.id)}
              title={`${item.label} Workspace [Key: ${item.shortcut}]`}
            >
              <span className="nav-tab-shortcut mono-num">{item.shortcut}</span>
              <span className="nav-tab-label font-bold">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Operational Status Info */}
      <div className="nav-bottom-status">
        <div className="status-block" title={`Operating Mode: ${runtimeMode}`}>
          <span className="status-lbl text-muted">MODE</span>
          <span className="status-val font-bold text-secondary">
            {runtimeMode.replace('_FEED', '').replace('HISTORICAL_', '')}
          </span>
        </div>

        <div className="status-block" title={`Telemetry Source: ${sourceProvider}`}>
          <span className="status-lbl text-muted">SRC</span>
          <span className="status-val font-bold text-secondary">
            {sourceProvider ? sourceProvider.slice(0, 6) : 'LIVE'}
          </span>
        </div>

        <div
          className={`status-block status-health-block ${isOk ? 'health-ok' : isWarn ? 'health-warn' : 'health-off'} clickable`}
          onClick={onOpenSystemModal}
          title={`Platform Health: ${resolvedHealth}. Click to inspect diagnostics.`}
        >
          <span className="status-lbl text-muted">SYS</span>
          <div className="health-indicator-row">
            <span className="health-dot" />
            <span className="health-val font-bold">
              {isOk ? 'OK' : isWarn ? 'WARN' : 'ERR'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
