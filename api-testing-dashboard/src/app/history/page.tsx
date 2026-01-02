'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useTestStore } from '@/store/test-store';
import { PassRateTrendChart, DurationTrendChart } from '@/components/dashboard/charts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, Minus, RefreshCw, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getHistoricalData, getTestRuns, calculateDashboardStats } from '@/lib/supabase';
import type { TestRun, HistoricalData } from '@/types';
import { Button } from '@/components/ui/button';

export default function HistoryPage() {
  const { historicalData, setHistoricalData, setStats } = useTestStore();
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from database on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // Load historical data
        const histData = await getHistoricalData(30);
        if (histData.length > 0) {
          setHistoricalData(histData);
        }

        // Load recent test runs
        const runs = await getTestRuns(20);
        setTestRuns(runs);

        // Update stats
        const stats = await calculateDashboardStats();
        setStats(stats);
      } catch (error) {
        console.error('Error loading history data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [setHistoricalData, setStats]);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const histData = await getHistoricalData(30);
      if (histData.length > 0) {
        setHistoricalData(histData);
      }
      const runs = await getTestRuns(20);
      setTestRuns(runs);
      const stats = await calculateDashboardStats();
      setStats(stats);
    } finally {
      setIsLoading(false);
    }
  };

  // Use actual historical data (no mock generation)
  const chartData = historicalData;

  // Calculate trends only if we have data
  const hasData = chartData.length > 0;
  const recentData = chartData.slice(-7);
  const olderData = chartData.slice(-14, -7);

  const recentAvgPassRate = hasData && recentData.length > 0
    ? recentData.reduce((s, d) => s + d.passRate, 0) / recentData.length
    : 0;
  const olderAvgPassRate = olderData.length > 0
    ? olderData.reduce((s, d) => s + d.passRate, 0) / olderData.length
    : recentAvgPassRate;

  const passRateTrend = recentAvgPassRate - olderAvgPassRate;

  const recentAvgDuration = hasData && recentData.length > 0
    ? recentData.reduce((s, d) => s + d.avgDuration, 0) / recentData.length
    : 0;
  const olderAvgDuration = olderData.length > 0
    ? olderData.reduce((s, d) => s + d.avgDuration, 0) / olderData.length
    : recentAvgDuration;

  const durationTrend = recentAvgDuration - olderAvgDuration;

  // Convert test runs for display
  const testRunHistory = useMemo(() => {
    return testRuns.map((run) => ({
      id: run.id,
      date: run.startTime,
      totalTests: run.totalTests,
      passed: run.passedTests,
      failed: run.failedTests,
      skipped: run.skippedTests,
      duration: run.duration,
      passRate: run.totalTests > 0 ? (run.passedTests / run.totalTests) * 100 : 0,
      status: run.status,
    }));
  }, [testRuns]);

  // Empty state component
  const EmptyState = () => (
    <Card className="col-span-full">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Database className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Historical Data</h3>
        <p className="text-muted-foreground text-center max-w-md mb-4">
          Run some tests to start collecting historical data. Your test results will be saved
          automatically and displayed here.
        </p>
        <Button onClick={refreshData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Test History</h1>
          <p className="text-muted-foreground">Historical test run data and trends</p>
        </div>
        <Button onClick={refreshData} variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {!hasData && testRunHistory.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  7-Day Avg Pass Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">
                    {hasData ? `${recentAvgPassRate.toFixed(1)}%` : 'N/A'}
                  </span>
                  {hasData && (
                    <div
                      className={cn(
                        'flex items-center text-sm',
                        passRateTrend > 0
                          ? 'text-green-600 dark:text-green-400'
                          : passRateTrend < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-muted-foreground'
                      )}
                    >
                      {passRateTrend > 0 ? (
                        <TrendingUp className="h-4 w-4 mr-1" />
                      ) : passRateTrend < 0 ? (
                        <TrendingDown className="h-4 w-4 mr-1" />
                      ) : (
                        <Minus className="h-4 w-4 mr-1" />
                      )}
                      {Math.abs(passRateTrend).toFixed(1)}%
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">vs previous 7 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  7-Day Avg Duration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">
                    {hasData ? `${(recentAvgDuration / 1000).toFixed(2)}s` : 'N/A'}
                  </span>
                  {hasData && (
                    <div
                      className={cn(
                        'flex items-center text-sm',
                        durationTrend < 0
                          ? 'text-green-600 dark:text-green-400'
                          : durationTrend > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-muted-foreground'
                      )}
                    >
                      {durationTrend < 0 ? (
                        <TrendingDown className="h-4 w-4 mr-1" />
                      ) : durationTrend > 0 ? (
                        <TrendingUp className="h-4 w-4 mr-1" />
                      ) : (
                        <Minus className="h-4 w-4 mr-1" />
                      )}
                      {Math.abs(durationTrend / 1000).toFixed(2)}s
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">per test execution</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Test Runs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{testRunHistory.length}</div>
                <p className="text-xs text-muted-foreground mt-1">recorded in database</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Tests Executed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {testRunHistory.reduce((s, d) => s + d.totalTests, 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">across all runs</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts - only show if we have historical data */}
          {hasData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PassRateTrendChart data={chartData} />
              <DurationTrendChart data={chartData} />
            </div>
          )}

          {/* Run History Table */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Test Runs</CardTitle>
              <CardDescription>
                {testRunHistory.length > 0
                  ? `Showing ${testRunHistory.length} most recent test runs from database`
                  : 'No test runs recorded yet'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {testRunHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Run some tests to see history here
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Tests</TableHead>
                      <TableHead>Passed</TableHead>
                      <TableHead>Failed</TableHead>
                      <TableHead>Pass Rate</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testRunHistory.map((run) => (
                      <TableRow key={run.id} className="cursor-pointer hover:bg-accent/50">
                        <TableCell>
                          <div className="font-medium">
                            {format(new Date(run.date), 'MMM d, yyyy HH:mm')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(run.date), 'EEEE')}
                          </div>
                        </TableCell>
                        <TableCell>{run.totalTests}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-4 w-4" />
                            {run.passed}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                            <XCircle className="h-4 w-4" />
                            {run.failed}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={run.passRate >= 90 ? 'default' : run.passRate >= 70 ? 'secondary' : 'destructive'}
                          >
                            {run.passRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {((run.duration || 0) / 1000).toFixed(2)}s
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "gap-1",
                              run.status === 'completed' && "border-green-500",
                              run.status === 'cancelled' && "border-yellow-500",
                              run.status === 'running' && "border-blue-500"
                            )}
                          >
                            {run.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                            {run.status === 'cancelled' && <XCircle className="h-3 w-3 text-yellow-500" />}
                            {run.status === 'running' && <RefreshCw className="h-3 w-3 text-blue-500 animate-spin" />}
                            {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
