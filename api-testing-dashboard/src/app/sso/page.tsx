'use client';

import { useEffect } from 'react';
import { Shield, Activity, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ServerStatusCard } from '@/components/sso/server-status-card';
import { TestHistoryTable } from '@/components/sso/test-history-table';
import { useSsoStore, useSsoOverallStats } from '@/store/sso-store';
import { SSO_SERVER_LIST } from '@/lib/sso/config';

function StatsCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </div>
    </Card>
  );
}

export default function SsoPage() {
  const { fetchAllStatuses, fetchResults } = useSsoStore();
  const overallStats = useSsoOverallStats();

  useEffect(() => {
    fetchAllStatuses();
    fetchResults(undefined, 5);
  }, [fetchAllStatuses, fetchResults]);

  const handleRefresh = () => {
    fetchAllStatuses();
    fetchResults(undefined, 5);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SSO Testing</h1>
            <p className="text-muted-foreground">
              Automated Azure SSO login testing across Legito environments
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Total Tests"
          value={overallStats?.totalTests || 0}
          icon={Activity}
          color="bg-blue-500/10 text-blue-500"
        />
        <StatsCard
          title="Success Rate"
          value={`${(overallStats?.successRate || 0).toFixed(1)}%`}
          icon={CheckCircle2}
          color="bg-green-500/10 text-green-500"
        />
        <StatsCard
          title="Failures (24h)"
          value={overallStats?.failuresLast24h || 0}
          icon={XCircle}
          color="bg-red-500/10 text-red-500"
        />
      </div>

      {/* Server Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Servers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SSO_SERVER_LIST.map((server) => (
            <ServerStatusCard key={server.id} server={server} />
          ))}
        </div>
      </div>

      {/* Recent Tests */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Tests</h2>
          <Button variant="link" asChild>
            <a href="/sso/history">View all history</a>
          </Button>
        </div>
        <TestHistoryTable limit={5} />
      </div>
    </div>
  );
}
