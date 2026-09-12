import React from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  badge?: string;
  className?: string;
  icon?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  badge = 'STATUS',
  className = '',
}) => {
  return (
    <div className={`kyntra-empty-state ${className}`}>
      <span className="empty-badge mono">{badge}</span>
      <h4 className="empty-title font-bold mono">{title}</h4>
      {description && <p className="empty-desc text-secondary">{description}</p>}
    </div>
  );
};
