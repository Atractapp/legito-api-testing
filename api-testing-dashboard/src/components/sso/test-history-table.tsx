'use client';

import { useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSsoStore, useSsoResults } from '@/store/sso-store';
import { getServerConfig } from '@/lib/sso/config';
import type { SsoTestStatus, SsoServerId } from '@/types/sso';

interface TestHistoryTableProps {
  serverId?: SsoServerId;
  limit?: number;
}

function StatusIcon({ status }: { status: SsoTestStatus }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failure':
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'running':
    case 'pending':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function StatusBadge({ status }: { status: SsoTestStatus }) {
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

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  const seconds = ms / 1000;
  return `${seconds.toFixed(1)}s`;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TestHistoryTable({ serverId, limit = 20 }: TestHistoryTableProps) {
  const { results, loading, error } = useSsoResults();
  const { fetchResults } = useSsoStore();

  useEffect(() => {
    fetchResults(serverId, limit);
  }, [fetchResults, serverId, limit]);

  if (loading && results.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading results...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-500">
        <AlertCircle className="h-5 w-5 mr-2" />
        <span>{error}</span>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No test results yet</p>
        <p className="text-sm">Run a test to see results here</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead>Server</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Timestamp</TableHead>
            <TableHead>Triggered By</TableHead>
            <TableHead className="max-w-[200px]">Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((result) => {
            const serverConfig = getServerConfig(result.serverId);
            return (
              <TableRow key={result.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={result.status} />
                    <StatusBadge status={result.status} />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{serverConfig.name}</span>
                    <a
                      href={serverConfig.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {formatDuration(result.durationMs)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTimestamp(result.startedAt)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {result.triggeredBy}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[200px]">
                  {result.errorMessage ? (
                    <span
                      className="text-sm text-red-500 truncate block"
                      title={result.errorMessage}
                    >
                      {result.errorMessage}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
