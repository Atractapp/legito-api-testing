'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { useTestStore } from '@/store/test-store';
import { ChartsDashboard, PassRateTrendChart, DurationTrendChart } from '@/components/dashboard/charts';
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
import { CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HistoryPage() {
  const { historicalData, testResults } = useTestStore();

  // Generate sample historical data if none exists
  const chartData = useMemo(() => {
    if (historicalData.length > 0) return historicalData;

    // Generate 30 days of sample data
    const data = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const total = 20 + Math.floor(Math.random() * 5);
      const passed = Math.floor(total * (0.7 + Math.random() * 0.25));
      const failed = total - passed;
      data.push({
        date: date.toISOString().split('T')[0],
        totalTests: total,
        passed,
        failed,
        passRate: (passed / total) * 100,
        avgDuration: 500 + Math.floor(Math.random() * 1500),
      });
    }
    return data;
  }, [historicalData]);

  // Calculate trends
  const recentData = chartData.slice(-7);
  const olderData = chartData.slice(-14, -7);

  const recentAvgPassRate = recentData.reduce((s, d) => s + d.passRate, 0) / recentData.length;
  const olderAvgPassRate = olderData.length > 0
    ? olderData.reduce((s, d) => s + d.passRate, 0) / olderData.length
    : recentAvgPassRate;

  const passRateTrend = recentAvgPassRate - olderAvgPassRate;

  const recentAvgDuration = recentData.reduce((s, d) => s + d.avgDuration, 0) / recentData.length;
  const olderAvgDuration = olderData.length > 0
    ? olderData.reduce((s, d) => s + d.avgDuration, 0) / olderData.length
    : recentAvgDuration;

  const durationTrend = recentAvgDuration - olderAvgDuration;

  // Generate sample test run history
  const testRunHistory = useMemo(() => {
    return chartData.slice(-10).reverse().map((data, index) => ({
      id: `run-${index}`,
      date: data.date,
      totalTests: data.totalTests,
      passed: data.passed,
      failed: data.failed,
      skipped: Math.floor(Math.random() * 3),
      duration: data.avgDuration * data.totalTests,
      passRate: data.passRate,
      status: 'completed' as const,
    }));
  }, [chartData]);

  return (
    <div className="space-y-6">
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
              <span className="text-2xl font-bold">{recentAvgPassRate.toFixed(1)}%</span>
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
              <span className="text-2xl font-bold">{(recentAvgDuration / 1000).toFixed(2)}s</span>
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
            <div className="text-2xl font-bold">{chartData.length}</div>
            <p className="text-xs text-muted-foreground mt-1">in the last 30 days</p>
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
              {chartData.reduce((s, d) => s + d.totalTests, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">across all runs</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PassRateTrendChart data={chartData} />
        <DurationTrendChart data={chartData} />
      </div>

      {/* Run History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Test Runs</CardTitle>
          <CardDescription>History of test executions</CardDescription>
        </CardHeader>
        <CardContent>
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
                      {format(new Date(run.date), 'MMM d, yyyy')}
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
                    {(run.duration / 1000).toFixed(2)}s
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Completed
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
