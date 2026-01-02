'use client';

import { useState } from 'react';
import {
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Tags,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  useTaggerStore,
  useSourceWorkspace,
  useTargetWorkspace,
  useSyncStatus,
  useAnalysis,
} from '@/store/tagger-store';
import type { LegitoRegion, ConnectionStatus } from '@/types/tagger';

function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  const config = {
    disconnected: {
      icon: AlertCircle,
      label: 'Not Connected',
      className: 'bg-muted text-muted-foreground',
    },
    connecting: {
      icon: Loader2,
      label: 'Connecting...',
      className: 'bg-yellow-500/10 text-yellow-500',
    },
    connected: {
      icon: CheckCircle2,
      label: 'Connected',
      className: 'bg-green-500/10 text-green-500',
    },
    error: {
      icon: XCircle,
      label: 'Error',
      className: 'bg-red-500/10 text-red-500',
    },
  };

  const { icon: Icon, label, className } = config[status] || config.disconnected;

  return (
    <Badge variant="outline" className={cn('gap-1.5', className)}>
      <Icon
        className={cn('h-3 w-3', status === 'connecting' && 'animate-spin')}
      />
      {label}
    </Badge>
  );
}

interface WorkspaceFormProps {
  title: string;
  description: string;
  workspaceType: 'source' | 'target';
  gradient: string;
}

function WorkspaceForm({
  title,
  description,
  workspaceType,
  gradient,
}: WorkspaceFormProps) {
  const sourceWorkspace = useSourceWorkspace();
  const targetWorkspace = useTargetWorkspace();
  const workspace = workspaceType === 'source' ? sourceWorkspace : targetWorkspace;
  const {
    setSourceCredentials,
    setTargetCredentials,
    testConnection,
    fetchTags,
  } = useTaggerStore();

  const setCredentials =
    workspaceType === 'source' ? setSourceCredentials : setTargetCredentials;

  const [key, setKey] = useState(workspace.credentials?.key || '');
  const [privateKey, setPrivateKey] = useState(
    workspace.credentials?.privateKey || ''
  );
  const [region, setRegion] = useState<LegitoRegion>(
    workspace.credentials?.region || 'emea'
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleSaveAndTest = async () => {
    if (!key || !privateKey) return;

    setCredentials({ key, privateKey, region });
    setIsLoading(true);

    try {
      const isValid = await testConnection(workspaceType);
      if (isValid) {
        await fetchTags(workspaceType);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <div
        className={cn(
          'absolute inset-0 opacity-5',
          `bg-gradient-to-br ${gradient}`
        )}
      />
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <ConnectionStatusBadge status={workspace.connectionStatus} />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`${workspaceType}-key`}>API Key</Label>
              <Input
                id={`${workspaceType}-key`}
                type="text"
                placeholder="Enter API key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${workspaceType}-private`}>Private Key</Label>
              <Input
                id={`${workspaceType}-private`}
                type="password"
                placeholder="Enter private key"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-end gap-4">
            <div className="space-y-2 flex-1">
              <Label htmlFor={`${workspaceType}-region`}>Region</Label>
              <Select
                value={region}
                onValueChange={(v) => setRegion(v as LegitoRegion)}
              >
                <SelectTrigger id={`${workspaceType}-region`}>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emea">EMEA (Europe)</SelectItem>
                  <SelectItem value="us">US (United States)</SelectItem>
                  <SelectItem value="ca">CA (Canada)</SelectItem>
                  <SelectItem value="apac">APAC (Asia Pacific)</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSaveAndTest}
              disabled={!key || !privateKey || isLoading}
              className="min-w-[140px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Save & Test
                </>
              )}
            </Button>
          </div>

          {workspace.connectionError && (
            <p className="text-sm text-red-500">{workspace.connectionError}</p>
          )}

          {workspace.connectionStatus === 'connected' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Tags className="h-4 w-4" />
              <span>{workspace.tags?.length ?? 0} tags found</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function SyncPanel() {
  const { status: syncStatus, progress: syncProgress, result: syncResult, error: syncError } = useSyncStatus();
  const analysis = useAnalysis();
  const source = useSourceWorkspace();
  const target = useTargetWorkspace();
  const { analyzeSync, executeSync, clearAnalysis } = useTaggerStore();

  const canAnalyze =
    source.connectionStatus === 'connected' &&
    target.connectionStatus === 'connected';

  const handleAnalyze = async () => {
    try {
      await analyzeSync();
    } catch (error) {
      console.error('Analysis failed:', error);
    }
  };

  const handleSync = async () => {
    try {
      await executeSync(false);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const progressPercent =
    syncProgress?.total && syncProgress?.current
      ? (syncProgress.current / syncProgress.total) * 100
      : 0;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Tag Synchronization</h3>
          <p className="text-sm text-muted-foreground">
            Copy tags from source workspace to target workspace
          </p>
        </div>
        {analysis && (
          <Button variant="outline" size="sm" onClick={clearAnalysis}>
            Clear Analysis
          </Button>
        )}
      </div>

      {/* Connection Status Summary */}
      <div className="flex items-center justify-center gap-8 py-6 mb-6 border rounded-lg bg-muted/30">
        <div className="text-center">
          <p className="text-sm font-medium mb-1">Source</p>
          <Badge
            variant={
              source.connectionStatus === 'connected' ? 'default' : 'secondary'
            }
          >
            {source.tags?.length ?? 0} tags
          </Badge>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium mb-1">Target</p>
          <Badge
            variant={
              target.connectionStatus === 'connected' ? 'default' : 'secondary'
            }
          >
            {target.tags?.length ?? 0} tags
          </Badge>
        </div>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="mb-6 p-4 border rounded-lg bg-muted/30">
          <h4 className="font-medium mb-3">Analysis Results</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-500">
                {analysis.tagsToCreate.length}
              </p>
              <p className="text-sm text-muted-foreground">Tags to Create</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-500">
                {analysis.duplicates.length}
              </p>
              <p className="text-sm text-muted-foreground">
                Duplicates (Skip)
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground">
                {analysis.sourceTags.length}
              </p>
              <p className="text-sm text-muted-foreground">Total Source</p>
            </div>
          </div>

          {analysis.tagsToCreate.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium mb-2">Tags to be created:</p>
              <div className="flex flex-wrap gap-2">
                {analysis.tagsToCreate.slice(0, 10).map((tag) => (
                  <Badge key={tag.id} variant="outline">
                    {tag.name}
                  </Badge>
                ))}
                {analysis.tagsToCreate.length > 10 && (
                  <Badge variant="outline">
                    +{analysis.tagsToCreate.length - 10} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sync Progress */}
      {syncStatus === 'syncing' && syncProgress && (
        <div className="mb-6 p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">{syncProgress.message}</p>
            {syncProgress.total && (
              <p className="text-sm text-muted-foreground">
                {syncProgress.current}/{syncProgress.total}
              </p>
            )}
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      )}

      {/* Sync Result */}
      {syncResult && syncStatus === 'complete' && (
        <div className="mb-6 p-4 border rounded-lg bg-green-500/10">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p className="font-medium text-green-500">Sync Complete!</p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center mt-3">
            <div>
              <p className="text-xl font-bold">{syncResult.tagsCreated}</p>
              <p className="text-xs text-muted-foreground">Created</p>
            </div>
            <div>
              <p className="text-xl font-bold">{syncResult.duplicatesSkipped}</p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
            <div>
              <p className="text-xl font-bold">{syncResult.tagsFailed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {syncError && (
        <div className="mb-6 p-4 border rounded-lg bg-red-500/10">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-500">{syncError}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleAnalyze}
          disabled={!canAnalyze || syncStatus === 'syncing'}
          variant="outline"
          className="flex-1"
        >
          {syncStatus === 'analyzing' ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Analyze Tags
            </>
          )}
        </Button>
        <Button
          onClick={handleSync}
          disabled={
            !analysis ||
            analysis.tagsToCreate.length === 0 ||
            syncStatus === 'syncing'
          }
          className="flex-1"
        >
          {syncStatus === 'syncing' ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Copy Tags to Target
            </>
          )}
        </Button>
      </div>

      {!canAnalyze && (
        <p className="text-sm text-muted-foreground text-center mt-4">
          Connect both workspaces to enable tag synchronization
        </p>
      )}
    </Card>
  );
}

export default function TaggerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tag Sync</h1>
        <p className="text-muted-foreground">
          Synchronize tags between Legito workspaces
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WorkspaceForm
          title="Source Workspace"
          description="Tags will be copied from this workspace"
          workspaceType="source"
          gradient="from-blue-500 to-cyan-500"
        />
        <WorkspaceForm
          title="Target Workspace"
          description="Tags will be created in this workspace"
          workspaceType="target"
          gradient="from-purple-500 to-pink-500"
        />
      </div>

      <SyncPanel />
    </div>
  );
}
