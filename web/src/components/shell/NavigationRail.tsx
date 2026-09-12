import React from 'react';
import type { ContextWorkspace, SystemHealthStatus } from '../../types';

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
    { id: 'STRATEGY', label: 'STRAT', shortcut: '2' },
    { id: 'EVENTS', label: 'EVENTS', shortcut: '3' },
    { id: 'ANALYSIS', label: 'ANLYS', shortcut: '4' },
    { id: 'SYSTEM', label: 'SYS', shortcut: '5' },
  ];

  const healthClass =
    systemHealth === 'OPERATIONAL'
      ? 'health-operational'
      : systemHealth === 'DEGRADED' || systemHealth === 'DECISION_BLOCKED'
      ? 'health-degraded'
      : 'health-offline';

  return (
    <aside className="kyntra-nav-rail" aria-label="Workstation Navigation">
      {/* Brand Icon */}
      <div className="nav-brand-slot" title="KYNTRA Mission Control">
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
              <span className="nav-tab-label mono font-bold">{item.label}</span>
              <span className="nav-tab-shortcut mono">{item.shortcut}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Operational Status Info */}
      <div className="nav-bottom-status">
        <div className="status-block" title={`Operating Mode: ${runtimeMode}`}>
          <span className="status-lbl">MODE</span>
          <span className="status-val mono font-bold text-accent">
            {runtimeMode.replace('_FEED', '').replace('HISTORICAL_', '')}
          </span>
        </div>

        <div className="status-block" title={`Telemetry Source: ${sourceProvider}`}>
          <span className="status-lbl">SOURCE</span>
          <span className="status-val mono font-bold">
            {sourceProvider ? sourceProvider.slice(0, 7) : 'UNKNOWN'}
          </span>
        </div>

        <div
          className={`status-block status-health-block ${healthClass} clickable`}
          onClick={onOpenSystemModal}
          title={`Platform Health: ${systemHealth}. Click to inspect diagnostics.`}
        >
          <span className="status-lbl">SYSTEM</span>
          <div className="health-indicator-row">
            <span className="health-dot" />
            <span className="health-val mono font-bold">
              {systemHealth === 'OPERATIONAL'
                ? 'OK'
                : systemHealth === 'DEGRADED'
                ? 'DEGR'
                : 'OFF'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
