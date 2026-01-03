'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Star,
  RefreshCw,
} from 'lucide-react';
import { useMcpStore, useMcpWorkspaces } from '@/store/mcp-store';
import type { LegitoRegion } from '@/types/mcp';

const REGIONS: { value: LegitoRegion; label: string }[] = [
  { value: 'emea', label: 'EMEA (Europe)' },
  { value: 'us', label: 'US (United States)' },
  { value: 'ca', label: 'CA (Canada)' },
  { value: 'apac', label: 'APAC (Asia Pacific)' },
  { value: 'quarterly', label: 'Quarterly' },
];

interface WorkspaceFormData {
  name: string;
  key: string;
  privateKey: string;
  region: LegitoRegion;
}

const initialFormData: WorkspaceFormData = {
  name: '',
  key: '',
  privateKey: '',
  region: 'emea',
};

export default function McpWorkspacesPage() {
  const workspaces = useMcpWorkspaces();
  const {
    addWorkspace,
    removeWorkspace,
    setDefaultWorkspace,
    testConnection,
  } = useMcpStore();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState<WorkspaceFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

  const handleAddWorkspace = async () => {
    if (!formData.name || !formData.key || !formData.privateKey) return;

    setIsSaving(true);
    try {
      const id = `ws_${Date.now()}`;
      addWorkspace({
        id,
        name: formData.name,
        credentials: {
          key: formData.key,
          privateKey: formData.privateKey,
          region: formData.region,
        },
        isDefault: workspaces.length === 0,
      });

      // Test connection after adding
      await testConnection(id);

      setFormData(initialFormData);
      setIsAddDialogOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async (workspaceId: string) => {
    setTestingIds((prev) => new Set(prev).add(workspaceId));
    try {
      await testConnection(workspaceId);
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev);
        next.delete(workspaceId);
        return next;
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-muted-foreground">
            Manage Legito API credentials for MCP tools
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Workspace</DialogTitle>
              <DialogDescription>
                Configure a new Legito workspace with API credentials
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Workspace Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Production, Staging"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Select
                  value={formData.region}
                  onValueChange={(value: LegitoRegion) =>
                    setFormData((prev) => ({ ...prev, region: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((region) => (
                      <SelectItem key={region.value} value={region.value}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="key">API Key</Label>
                <Input
                  id="key"
                  placeholder="Your Legito API key"
                  value={formData.key}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, key: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="privateKey">Private Key</Label>
                <Input
                  id="privateKey"
                  type="password"
                  placeholder="Your Legito private key"
                  value={formData.privateKey}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, privateKey: e.target.value }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddWorkspace}
                disabled={
                  isSaving ||
                  !formData.name ||
                  !formData.key ||
                  !formData.privateKey
                }
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Workspace
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Workspaces List */}
      {workspaces.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">No workspaces configured</p>
              <p className="text-sm mb-4">
                Add a workspace to start using MCP tools with your Legito API
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Workspace
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {workspaces.map((ws) => (
            <Card key={ws.workspace.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {ws.workspace.name}
                      {ws.workspace.isDefault && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </CardTitle>
                    <CardDescription>
                      {ws.workspace.credentials.region.toUpperCase()} region
                      <span className="mx-2">-</span>
                      ID: <code className="text-xs">{ws.workspace.id}</code>
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      ws.connectionStatus === 'connected'
                        ? 'default'
                        : ws.connectionStatus === 'error'
                          ? 'destructive'
                          : ws.connectionStatus === 'connecting'
                            ? 'secondary'
                            : 'outline'
                    }
                  >
                    {ws.connectionStatus === 'connected' && (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    )}
                    {ws.connectionStatus === 'error' && (
                      <XCircle className="h-3 w-3 mr-1" />
                    )}
                    {ws.connectionStatus === 'connecting' && (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    )}
                    {ws.connectionStatus}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {ws.connectionError && (
                      <p className="text-red-500">{ws.connectionError}</p>
                    )}
                    {ws.lastConnected && (
                      <p>
                        Last connected:{' '}
                        {new Date(ws.lastConnected).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection(ws.workspace.id)}
                      disabled={testingIds.has(ws.workspace.id)}
                    >
                      {testingIds.has(ws.workspace.id) ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Test
                    </Button>
                    {!ws.workspace.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDefaultWorkspace(ws.workspace.id)}
                      >
                        <Star className="h-4 w-4 mr-2" />
                        Set Default
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{ws.workspace.name}"?
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeWorkspace(ws.workspace.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Usage Note */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Using Workspaces with MCP</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            When using MCP tools, you'll need to provide the workspace ID to identify
            which Legito credentials to use.
          </p>
          <p>
            Each tool accepts a <code className="bg-muted px-1 rounded">workspaceId</code>{' '}
            parameter. Use the ID shown on each workspace card above.
          </p>
          <p>
            Example: <code className="bg-muted px-1 rounded">ws_1234567890</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
