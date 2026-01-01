'use client';

import {
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardStats, TestRun } from '@/types';

interface StatsCardsProps {
  stats: DashboardStats;
  currentRun?: TestRun | null;
}

export function StatsCards({ stats, currentRun }: StatsCardsProps) {
  const trendIcon = {
    up: TrendingUp,
    down: TrendingDown,
    stable: Minus,
  };

  const TrendIcon = trendIcon[stats.recentTrend];

  const cards = [
    {
      title: 'Total Test Runs',
      value: stats.totalTestRuns.toLocaleString(),
      description: `${stats.todayRuns} today, ${stats.weeklyRuns} this week`,
      icon: Activity,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Pass Rate',
      value: `${stats.avgPassRate.toFixed(1)}%`,
      description: (
        <span className="flex items-center gap-1">
          <TrendIcon
            className={cn(
              'h-3 w-3',
              stats.recentTrend === 'up' && 'text-green-500',
              stats.recentTrend === 'down' && 'text-red-500'
            )}
          />
          {stats.recentTrend === 'up'
            ? 'Improving'
            : stats.recentTrend === 'down'
            ? 'Declining'
            : 'Stable'}
        </span>
      ),
      icon: CheckCircle2,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Avg Duration',
      value: `${(stats.avgDuration / 1000).toFixed(2)}s`,
      description: 'Per test run',
      icon: Clock,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      title: 'Total Tests',
      value: stats.totalTests.toLocaleString(),
      description: stats.lastRunTime
        ? `Last run: ${new Date(stats.lastRunTime).toLocaleDateString()}`
        : 'No runs yet',
      icon: Zap,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={cn('p-2 rounded-lg', card.bgColor)}>
                <Icon className={cn('h-4 w-4', card.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}

      {/* Current Run Card (shown when running) */}
      {currentRun && currentRun.status === 'running' && (
        <Card className="md:col-span-2 lg:col-span-4 border-primary/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              Current Test Run
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Progress</p>
                <p className="text-lg font-semibold">
                  {currentRun.passedTests + currentRun.failedTests + currentRun.skippedTests} / {currentRun.totalTests}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" /> Passed
                </p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {currentRun.passedTests}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" /> Failed
                </p>
                <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                  {currentRun.failedTests}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-lg font-semibold">
                  {currentRun.duration
                    ? `${(currentRun.duration / 1000).toFixed(1)}s`
                    : 'Running...'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Compact stats for sidebar or header
export function CompactStats({ stats }: { stats: DashboardStats }) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="font-medium">{stats.avgPassRate.toFixed(0)}%</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Activity className="h-4 w-4 text-blue-500" />
        <span className="font-medium">{stats.totalTestRuns}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock className="h-4 w-4 text-yellow-500" />
        <span className="font-medium">{(stats.avgDuration / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}
