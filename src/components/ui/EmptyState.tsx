'use client';

import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  actionText,
  onAction,
  actionIcon
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-border/80 bg-surface/20 min-h-[300px] max-w-lg mx-auto w-full space-y-4">
      {icon && (
        <div className="p-4 rounded-full bg-surface-hover border border-border/60 text-text-muted flex items-center justify-center mb-2 shadow-sm">
          {icon}
        </div>
      )}
      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-sm font-bold text-text-primary tracking-wide">{title}</h3>
        <p className="text-xs text-text-muted leading-relaxed">{description}</p>
      </div>
      {actionText && onAction && (
        <Button
          onClick={onAction}
          icon={actionIcon}
          className="mt-2 font-bold px-4 py-2 text-xs flex items-center gap-1.5"
        >
          {actionText}
        </Button>
      )}
    </div>
  );
}
