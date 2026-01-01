'use client';

import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTestStore } from '@/store/test-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Download, ArrowDown } from 'lucide-react';
import type { LogEntry } from '@/types';

interface LiveLogsProps {
  maxHeight?: string;
  autoScroll?: boolean;
}

export function LiveLogs({ maxHeight = '400px', autoScroll = true }: LiveLogsProps) {
  const { logs, clearLogs } = useTestStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const exportLogs = () => {
    const logText = logs
      .map(
        (log) =>
          `[${format(new Date(log.timestamp), 'HH:mm:ss.SSS')}] [${log.level.toUpperCase()}] ${log.message}`
      )
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col border border-border rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm">Live Logs</h3>
          <Badge variant="outline" className="text-xs">
            {logs.length} entries
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={scrollToBottom}
            title="Scroll to bottom"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={exportLogs}
            disabled={logs.length === 0}
            title="Export logs"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={clearLogs}
            disabled={logs.length === 0}
            title="Clear logs"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Log Content */}
      <ScrollArea
        className="font-mono text-xs"
        style={{ height: maxHeight }}
        ref={scrollRef}
      >
        <div className="p-2 space-y-0.5">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              No logs yet. Run tests to see output.
            </div>
          ) : (
            logs.map((log) => <LogLine key={log.id} log={log} />)
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}

interface LogLineProps {
  log: LogEntry;
}

function LogLine({ log }: LogLineProps) {
  const levelStyles: Record<string, string> = {
    info: 'text-blue-500',
    warn: 'text-yellow-500',
    error: 'text-red-500',
    debug: 'text-gray-500',
  };

  const levelBg: Record<string, string> = {
    info: 'bg-blue-500/10',
    warn: 'bg-yellow-500/10',
    error: 'bg-red-500/10',
    debug: 'bg-gray-500/10',
  };

  return (
    <div
      className={cn(
        'flex items-start gap-2 px-2 py-1 rounded hover:bg-accent/50',
        levelBg[log.level]
      )}
    >
      <span className="text-muted-foreground shrink-0">
        {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
      </span>
      <span className={cn('uppercase shrink-0 w-12', levelStyles[log.level])}>
        [{log.level}]
      </span>
      <span className="flex-1 break-all text-foreground">{log.message}</span>
      {log.testId && (
        <Badge variant="outline" className="text-[10px] shrink-0">
          {log.testId}
        </Badge>
      )}
    </div>
  );
}

// Compact progress log for the test runner
export function TestProgressLog() {
  const { currentRun, testResults } = useTestStore();

  if (!currentRun) return null;

  const progress = currentRun.totalTests > 0
    ? Math.round(((currentRun.passedTests + currentRun.failedTests + currentRun.skippedTests) / currentRun.totalTests) * 100)
    : 0;

  const latestResults = testResults.slice(-5).reverse();

  return (
    <div className="space-y-3">
      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progress</span>
          <span className="text-muted-foreground">{progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {currentRun.passedTests + currentRun.failedTests + currentRun.skippedTests} / {currentRun.totalTests} completed
          </span>
          <div className="flex items-center gap-3">
            <span className="text-green-500">{currentRun.passedTests} passed</span>
            <span className="text-red-500">{currentRun.failedTests} failed</span>
            <span className="text-yellow-500">{currentRun.skippedTests} skipped</span>
          </div>
        </div>
      </div>

      {/* Recent Results */}
      {latestResults.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Recent Results</span>
          <div className="space-y-1">
            {latestResults.map((result) => (
              <div
                key={result.id}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded text-xs',
                  result.status === 'passed' && 'bg-green-500/10 text-green-700 dark:text-green-400',
                  result.status === 'failed' && 'bg-red-500/10 text-red-700 dark:text-red-400',
                  result.status === 'skipped' && 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                )}
              >
                <span className="flex-1 font-medium truncate">{result.testName}</span>
                <span className="tabular-nums">{result.duration}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
