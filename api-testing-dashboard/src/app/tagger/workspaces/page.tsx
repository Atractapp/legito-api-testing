'use client';

import {
  KeyRound,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  useTaggerStore,
  useSourceWorkspace,
  useTargetWorkspace,
} from '@/store/tagger-store';
import type { ConnectionStatus } from '@/types/tagger';

function ConnectionStatusIcon({ status }: { status: ConnectionStatus }) {
  const config = {
    disconnected: { icon: AlertCircle, className: 'text-muted-foreground' },
    connecting: { icon: RefreshCw, className: 'text-yellow-500 animate-spin' },
    connected: { icon: CheckCircle2, className: 'text-green-500' },
    error: { icon: XCircle, className: 'text-red-500' },
  };

  const { icon: Icon, className } = config[status];
  return <Icon className={cn('h-5 w-5', className)} />;
}

interface WorkspaceCardProps {
  title: string;
  workspaceType: 'source' | 'target';
  color: string;
}

function WorkspaceCard({ title, workspaceType, color }: WorkspaceCardProps) {
  const workspace =
    workspaceType === 'source' ? useSourceWorkspace() : useTargetWorkspace();
  const { clearCredentials, testConnection, fetchTags } = useTaggerStore();

  const hasCredentials = !!workspace.credentials;

  const handleRefresh = async () => {
    if (hasCredentials) {
      const isValid = await testConnection(workspaceType);
      if (isValid) {
        await fetchTags(workspaceType);
      }
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              `bg-${color}-500/10`
            )}
          >
            <KeyRound className={`h-5 w-5 text-${color}-500`} />
          </div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">
              {workspaceType === 'source'
                ? 'Source for tag sync'
                : 'Target for tag sync'}
            </p>
          </div>
        </div>
        <ConnectionStatusIcon status={workspace.connectionStatus} />
      </div>

      {hasCredentials ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Region</p>
              <p className="font-medium uppercase">
                {workspace.credentials?.region}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">API Key</p>
              <p className="font-mono text-sm">
                {workspace.credentials?.key.slice(0, 8)}...
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{workspace.tags.length} tags</Badge>
              {workspace.lastFetched && (
                <span className="text-xs text-muted-foreground">
                  Updated{' '}
                  {new Date(workspace.lastFetched).toLocaleTimeString()}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearCredentials(workspaceType)}
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {workspace.connectionError && (
            <p className="text-sm text-red-500">{workspace.connectionError}</p>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">No credentials configured</p>
          <Button variant="outline" asChild>
            <a href="/tagger">Configure on Tag Sync page</a>
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function WorkspacesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
        <p className="text-muted-foreground">
          Manage your Legito workspace connections
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WorkspaceCard
          title="Source Workspace"
          workspaceType="source"
          color="blue"
        />
        <WorkspaceCard
          title="Target Workspace"
          workspaceType="target"
          color="purple"
        />
      </div>
    </div>
  );
}
