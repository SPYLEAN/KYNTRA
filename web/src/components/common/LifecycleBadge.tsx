import React from 'react';

interface LifecycleBadgeProps {
  state: 'VALID' | 'AGING' | 'EXPIRED' | 'BLOCKED' | 'WITHHELD' | 'INVALIDATED' | 'PENDING_FINAL_GATE' | string;
  className?: string;
  showDot?: boolean;
}

export const LifecycleBadge: React.FC<LifecycleBadgeProps> = ({
  state,
  className = '',
  showDot = true,
}) => {
  const norm = (state || 'WITHHELD').toUpperCase();

  let badgeClass = 'lifecycle-withheld';
  let label = norm;

  switch (norm) {
    case 'VALID':
      badgeClass = 'lifecycle-valid';
      label = 'VALID';
      break;
    case 'AGING':
      badgeClass = 'lifecycle-aging';
      label = 'AGING';
      break;
    case 'EXPIRED':
      badgeClass = 'lifecycle-expired';
      label = 'EXPIRED';
      break;
    case 'BLOCKED':
      badgeClass = 'lifecycle-blocked';
      label = 'BLOCKED';
      break;
    case 'WITHHELD':
      badgeClass = 'lifecycle-withheld';
      label = 'WITHHELD';
      break;
    case 'INVALIDATED':
      badgeClass = 'lifecycle-invalidated';
      label = 'INVALIDATED';
      break;
    case 'PENDING_FINAL_GATE':
      badgeClass = 'lifecycle-pending';
      label = 'PENDING FINAL GATE';
      break;
    default:
      badgeClass = 'lifecycle-withheld';
      label = norm;
  }

  return (
    <span className={`lifecycle-badge ${badgeClass} ${className}`}>
      {showDot && <span className="lifecycle-dot" />}
      <span className="lifecycle-text">{label}</span>
    </span>
  );
};
