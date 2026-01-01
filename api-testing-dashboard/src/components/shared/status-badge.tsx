'use client';

import { cn } from '@/lib/utils';
import type { TestStatus } from '@/types';
import { CheckCircle2, XCircle, Clock, Loader2, SkipForward } from 'lucide-react';

interface StatusBadgeProps {
  status: TestStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<
  TestStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-muted text-muted-foreground',
  },
  running: {
    label: 'Running',
    icon: Loader2,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  passed: {
    label: 'Passed',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  skipped: {
    label: 'Skipped',
    icon: SkipForward,
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
};

const sizeConfig = {
  sm: { badge: 'px-1.5 py-0.5 text-xs', icon: 'h-3 w-3' },
  md: { badge: 'px-2 py-1 text-xs', icon: 'h-3.5 w-3.5' },
  lg: { badge: 'px-2.5 py-1.5 text-sm', icon: 'h-4 w-4' },
};

export function StatusBadge({
  status,
  size = 'md',
  showLabel = true,
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        config.className,
        sizes.badge,
        className
      )}
    >
      <Icon
        className={cn(
          sizes.icon,
          status === 'running' && 'animate-spin'
        )}
      />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

// Simpler dot indicator for compact views
interface StatusDotProps {
  status: TestStatus;
  className?: string;
}

const dotColors: Record<TestStatus, string> = {
  pending: 'bg-muted-foreground',
  running: 'bg-blue-500 animate-pulse',
  passed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-yellow-500',
};

export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        dotColors[status],
        className
      )}
    />
  );
}
