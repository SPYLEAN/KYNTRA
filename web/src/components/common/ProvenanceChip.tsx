import React from 'react';
import type { ProvenanceType } from '../../types';

interface ProvenanceChipProps {
  type: ProvenanceType | string;
  className?: string;
  onClick?: () => void;
  title?: string;
}

export const ProvenanceChip: React.FC<ProvenanceChipProps> = ({
  type,
  className = '',
  onClick,
  title,
}) => {
  const norm = (type || 'UNKNOWN').toUpperCase();

  let colorClass = 'chip-unknown';
  let label = norm;

  if (norm.includes('MODEL') || norm.includes('FROZEN')) {
    colorClass = 'chip-model';
    label = 'FROZEN MODEL';
  } else if (norm.includes('SIMULATED') || norm.includes('ENERGY')) {
    colorClass = 'chip-simulated';
    label = 'SIMULATED ENERGY';
  } else if (norm.includes('RULE') || norm.includes('FIA')) {
    colorClass = 'chip-rule';
    label = 'RULE CHECK';
  } else if (norm.includes('STABILITY')) {
    colorClass = 'chip-stability';
    label = 'ORDINAL STABILITY';
  } else if (norm.includes('FORECAST')) {
    colorClass = 'chip-forecast';
    label = 'FORECAST SIMULATION';
  } else if (norm.includes('LIVE')) {
    colorClass = 'chip-live';
    label = 'LIVE';
  } else if (norm.includes('PUBLIC') || norm.includes('SOURCE_BACKED')) {
    colorClass = 'chip-source';
    label = 'PUBLIC SOURCE';
  } else if (norm.includes('DERIVED')) {
    colorClass = 'chip-derived';
    label = 'DERIVED';
  } else if (norm.includes('ASSUMPTION')) {
    colorClass = 'chip-assumption';
    label = 'CONFIG ASSUMPTION';
  } else if (norm.includes('HISTORICAL')) {
    colorClass = 'chip-historical';
    label = 'HISTORICAL';
  }

  return (
    <span
      className={`provenance-chip ${colorClass} ${className} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      title={title || `Data Provenance: ${label}`}
    >
      {label}
    </span>
  );
};
