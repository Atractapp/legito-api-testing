'use client';

import { useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TestHistoryTable } from '@/components/sso/test-history-table';
import { useSsoStore } from '@/store/sso-store';
import { SSO_SERVER_LIST } from '@/lib/sso/config';
import type { SsoServerId } from '@/types/sso';

export default function SsoHistoryPage() {
  const [selectedServer, setSelectedServer] = useState<SsoServerId | 'all'>('all');
  const { fetchResults } = useSsoStore();

  const handleServerChange = (value: string) => {
    const serverId = value === 'all' ? undefined : (value as SsoServerId);
    setSelectedServer(value as SsoServerId | 'all');
    fetchResults(serverId, 50);
  };

  const handleRefresh = () => {
    const serverId = selectedServer === 'all' ? undefined : selectedServer;
    fetchResults(serverId, 50);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <History className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Test History</h1>
            <p className="text-muted-foreground">
              View all SSO test results across environments
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Server:</span>
          <Select value={selectedServer} onValueChange={handleServerChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select server" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Servers</SelectItem>
              {SSO_SERVER_LIST.map((server) => (
                <SelectItem key={server.id} value={server.id}>
                  {server.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Table */}
      <TestHistoryTable
        serverId={selectedServer === 'all' ? undefined : selectedServer}
        limit={50}
      />
    </div>
  );
}
