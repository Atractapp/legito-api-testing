'use client';

import { Play, Square, RefreshCw, Trash2, CheckSquare, XSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTestStore } from '@/store/test-store';
import { cn } from '@/lib/utils';

interface RunControlsProps {
  onRunTests: () => void;
  onStopTests: () => void;
  onResetTests: () => void;
}

export function RunControls({ onRunTests, onStopTests, onResetTests }: RunControlsProps) {
  const {
    categories,
    selectedTests,
    selectAll,
    deselectAll,
    isRunning,
    configuration,
    setConfiguration,
    savedConfigurations,
    loadConfiguration,
  } = useTestStore();

  const totalTests = categories.reduce((sum, cat) => sum + cat.tests.length, 0);
  const selectedCount = selectedTests.length;

  return (
    <div className="flex flex-col gap-4 p-4 border-b border-border bg-card/50">
      {/* Main Controls Row */}
      <div className="flex items-center gap-3">
        {/* Run Button */}
        <Button
          onClick={onRunTests}
          disabled={isRunning || selectedCount === 0}
          className="gap-2"
          size="lg"
        >
          <Play className="h-4 w-4" />
          Run {selectedCount > 0 ? `(${selectedCount})` : 'Tests'}
        </Button>

        {/* Stop Button */}
        <Button
          variant="destructive"
          onClick={onStopTests}
          disabled={!isRunning}
          className="gap-2"
        >
          <Square className="h-4 w-4" />
          Stop
        </Button>

        {/* Reset Button */}
        <Button
          variant="outline"
          onClick={onResetTests}
          disabled={isRunning}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reset
        </Button>

        <div className="flex-1" />

        {/* Configuration Selector */}
        <Select
          value={configuration.id}
          onValueChange={(id) => loadConfiguration(id)}
          disabled={isRunning}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select configuration" />
          </SelectTrigger>
          <SelectContent>
            {savedConfigurations.map((config) => (
              <SelectItem key={config.id} value={config.id}>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      config.environment === 'production'
                        ? 'bg-red-500'
                        : config.environment === 'staging'
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    )}
                  />
                  {config.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selection Controls Row */}
      <div className="flex items-center gap-2 text-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={selectAll}
          disabled={isRunning}
          className="gap-1.5 h-8"
        >
          <CheckSquare className="h-3.5 w-3.5" />
          Select All
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={deselectAll}
          disabled={isRunning || selectedCount === 0}
          className="gap-1.5 h-8"
        >
          <XSquare className="h-3.5 w-3.5" />
          Deselect All
        </Button>

        <div className="flex-1" />

        <span className="text-muted-foreground">
          {selectedCount} of {totalTests} tests selected
        </span>
      </div>
    </div>
  );
}

// Quick filter bar for status filtering
export function StatusFilter() {
  const { filter, setFilter, clearFilter, categories } = useTestStore();

  const statusCounts = categories.reduce(
    (acc, cat) => {
      cat.tests.forEach((test) => {
        acc[test.status] = (acc[test.status] || 0) + 1;
      });
      return acc;
    },
    {} as Record<string, number>
  );

  const statuses = [
    { value: undefined, label: 'All', count: categories.reduce((s, c) => s + c.tests.length, 0) },
    { value: 'passed', label: 'Passed', count: statusCounts.passed || 0 },
    { value: 'failed', label: 'Failed', count: statusCounts.failed || 0 },
    { value: 'running', label: 'Running', count: statusCounts.running || 0 },
    { value: 'pending', label: 'Pending', count: statusCounts.pending || 0 },
    { value: 'skipped', label: 'Skipped', count: statusCounts.skipped || 0 },
  ] as const;

  return (
    <div className="flex items-center gap-1 p-2 border-b border-border">
      {statuses.map((status) => (
        <Button
          key={status.label}
          variant={filter.status === status.value ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            if (status.value === undefined) {
              clearFilter();
            } else {
              setFilter({ status: status.value });
            }
          }}
          className="h-7 text-xs gap-1.5"
        >
          {status.label}
          <span className="text-muted-foreground">({status.count})</span>
        </Button>
      ))}
    </div>
  );
}
