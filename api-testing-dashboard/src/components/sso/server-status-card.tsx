'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Play,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSsoStore, useSsoServerStatus, useSsoRunningTests } from '@/store/sso-store';
import type { SsoServerConfig, SsoTestStatus } from '@/types/sso';

interface ServerStatusCardProps {
  server: SsoServerConfig;
}

function StatusIcon({ status }: { status: SsoTestStatus | null }) {
  if (!status) {
    return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
  }

  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'failure':
    case 'error':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'running':
    case 'pending':
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    default:
      return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
  }
}

function StatusBadge({ status }: { status: SsoTestStatus | null }) {
  if (!status) {
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        No tests
      </Badge>
    );
  }

  const config: Record<SsoTestStatus, { className: string; label: string }> = {
    pending: {
      className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      label: 'Pending',
    },
    running: {
      className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      label: 'Running',
    },
    success: {
      className: 'bg-green-500/10 text-green-500 border-green-500/20',
      label: 'Passed',
    },
    failure: {
      className: 'bg-red-500/10 text-red-500 border-red-500/20',
      label: 'Failed',
    },
    error: {
      className: 'bg-red-500/10 text-red-500 border-red-500/20',
      label: 'Error',
    },
  };

  const { className, label } = config[status];

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

function formatTimeAgo(date: Date | string | null): string {
  if (!date) return 'Never';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function ServerStatusCard({ server }: ServerStatusCardProps) {
  const status = useSsoServerStatus(server.id);
  const runningTests = useSsoRunningTests();
  const { triggerTest, fetchServerStatus } = useSsoStore();
  const [isTriggering, setIsTriggering] = useState(false);

  const isRunning = runningTests.has(server.id) || status?.isRunning;
  const lastTest = status?.lastTest;

  const handleRunTest = async () => {
    setIsTriggering(true);
    try {
      const result = await triggerTest(server.id);
      if (result.success) {
        // Poll for status updates
        const pollInterval = setInterval(async () => {
          await fetchServerStatus(server.id);
          const updatedStatus = useSsoStore.getState().serverStatuses[server.id];
          if (updatedStatus && !updatedStatus.isRunning) {
            clearInterval(pollInterval);
          }
        }, 3000);

        // Stop polling after 2 minutes
        setTimeout(() => clearInterval(pollInterval), 120000);
      }
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <StatusIcon status={lastTest?.status || null} />
            <div>
              <h3 className="font-semibold text-lg">{server.name}</h3>
              <p className="text-sm text-muted-foreground">{server.description}</p>
            </div>
          </div>
          <StatusBadge status={lastTest?.status || null} />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <a
            href={server.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {server.url.replace('https://', '')}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Last tested: {formatTimeAgo(lastTest?.startedAt || null)}
            </span>
          </div>

          <Button
            onClick={handleRunTest}
            disabled={isRunning || isTriggering}
            size="sm"
            className={cn(
              isRunning && 'bg-blue-500 hover:bg-blue-600'
            )}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : isTriggering ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Test
              </>
            )}
          </Button>
        </div>

        {lastTest?.errorMessage && (
          <div className="mt-4 p-3 bg-red-500/10 rounded-lg">
            <p className="text-sm text-red-500 font-medium">Last Error:</p>
            <p className="text-sm text-red-400 mt-1">{lastTest.errorMessage}</p>
          </div>
        )}

        {status?.stats && status.stats.totalTests > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-4 text-center pt-4 border-t">
            <div>
              <p className="text-lg font-semibold">{status.stats.totalTests}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-green-500">
                {status.stats.successCount}
              </p>
              <p className="text-xs text-muted-foreground">Passed</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-red-500">
                {status.stats.failureCount}
              </p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
