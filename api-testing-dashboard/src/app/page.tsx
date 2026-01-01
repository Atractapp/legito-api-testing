'use client';

import { RunControls, StatusFilter } from '@/components/test-runner/run-controls';
import { TestCategoryList } from '@/components/test-runner/test-category-list';
import { LiveLogs, TestProgressLog } from '@/components/test-runner/live-logs';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { ResultDistributionChart } from '@/components/dashboard/charts';
import { useTestStore } from '@/store/test-store';
import { useTestRunner } from '@/hooks/use-test-runner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TestRunnerPage() {
  const { currentRun, stats, testResults } = useTestStore();
  const { runTests, stopTests, resetTests } = useTestRunner();

  const passed = testResults.filter((r) => r.status === 'passed').length;
  const failed = testResults.filter((r) => r.status === 'failed').length;
  const skipped = testResults.filter((r) => r.status === 'skipped').length;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <StatsCards stats={stats} currentRun={currentRun} />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Test Suite */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-0">
              <CardTitle>Test Suite</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <RunControls
                onRunTests={runTests}
                onStopTests={stopTests}
                onResetTests={resetTests}
              />
              <StatusFilter />
              <ScrollArea className="h-[500px]">
                <div className="p-4">
                  <TestCategoryList />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Live Progress & Logs */}
        <div className="space-y-4">
          {/* Progress Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Test Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <TestProgressLog />
              {testResults.length === 0 && !currentRun && (
                <p className="text-muted-foreground text-sm text-center py-4">
                  Select tests and click Run to start
                </p>
              )}
            </CardContent>
          </Card>

          {/* Distribution Chart (when there are results) */}
          {testResults.length > 0 && (
            <ResultDistributionChart passed={passed} failed={failed} skipped={skipped} />
          )}
        </div>
      </div>

      {/* Bottom Section - Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Execution Logs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <LiveLogs maxHeight="300px" />
        </CardContent>
      </Card>
    </div>
  );
}
