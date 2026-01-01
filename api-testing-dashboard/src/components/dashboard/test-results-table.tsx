'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/shared/status-badge';
import { cn } from '@/lib/utils';
import type { TestResult } from '@/types';

interface TestResultsTableProps {
  results: TestResult[];
  showActions?: boolean;
}

export function TestResultsTable({ results, showActions = true }: TestResultsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        No test results to display. Run some tests to see results here.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-8"></TableHead>
            <TableHead>Test Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead>Assertions</TableHead>
            {showActions && <TableHead className="w-20">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((result) => {
            const isExpanded = expandedRows.has(result.id);
            const passedAssertions = result.assertions.filter((a) => a.passed).length;

            return (
              <>
                <TableRow
                  key={result.id}
                  className={cn(
                    'cursor-pointer hover:bg-accent/50',
                    result.status === 'failed' && 'bg-red-500/5'
                  )}
                  onClick={() => toggleRow(result.id)}
                >
                  <TableCell className="p-2">
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">{result.testName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{result.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={result.status} size="sm" />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {result.duration}ms
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'text-sm',
                        passedAssertions === result.assertions.length
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {passedAssertions}/{result.assertions.length}
                    </span>
                  </TableCell>
                  {showActions && (
                    <TableCell>
                      <ResultDetailDialog result={result} />
                    </TableCell>
                  )}
                </TableRow>

                {/* Expanded Details Row */}
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={showActions ? 7 : 6} className="p-0">
                      <ExpandedResultDetails result={result} />
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ExpandedResultDetails({ result }: { result: TestResult }) {
  return (
    <div className="bg-muted/30 p-4 space-y-4">
      {/* Error Message */}
      {result.error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            Error: {result.error.message}
          </p>
          {result.error.stack && (
            <pre className="text-xs text-muted-foreground mt-2 overflow-x-auto">
              {result.error.stack}
            </pre>
          )}
        </div>
      )}

      {/* Assertions */}
      <div>
        <h4 className="text-sm font-medium mb-2">Assertions</h4>
        <div className="space-y-1">
          {result.assertions.map((assertion, index) => (
            <div
              key={index}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded text-sm',
                assertion.passed
                  ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                  : 'bg-red-500/10 text-red-700 dark:text-red-400'
              )}
            >
              {assertion.passed ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <span className="h-3.5 w-3.5 flex items-center justify-center text-xs">x</span>
              )}
              <span className="flex-1">{assertion.name}</span>
              {!assertion.passed && assertion.message && (
                <span className="text-xs opacity-70">{assertion.message}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Request/Response Preview */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Request</h4>
          <div className="bg-background rounded-lg p-2 text-xs font-mono overflow-x-auto">
            <p className="text-blue-500">
              {result.request.method} {result.request.url}
            </p>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium mb-2">Response</h4>
          <div className="bg-background rounded-lg p-2 text-xs font-mono">
            <p
              className={cn(
                result.response.status >= 200 && result.response.status < 300
                  ? 'text-green-500'
                  : result.response.status >= 400
                  ? 'text-red-500'
                  : 'text-yellow-500'
              )}
            >
              {result.response.status} {result.response.statusText}
            </p>
            <p className="text-muted-foreground">Size: {result.response.size} bytes</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultDetailDialog({ result }: { result: TestResult }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StatusBadge status={result.status} size="sm" />
            {result.testName}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="request" className="mt-4">
          <TabsList>
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
            <TabsTrigger value="assertions">Assertions</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="request" className="mt-4">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge className="mr-2">{result.request.method}</Badge>
                    <code className="text-sm">{result.request.url}</code>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(JSON.stringify(result.request, null, 2))
                    }
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 mr-1" />
                    )}
                    Copy
                  </Button>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Headers</h4>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(result.request.headers, null, 2)}
                  </pre>
                </div>

                {result.request.body !== undefined && result.request.body !== null && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Body</h4>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(result.request.body, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="response" className="mt-4">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge
                      variant={
                        result.response.status >= 200 && result.response.status < 300
                          ? 'default'
                          : 'destructive'
                      }
                    >
                      {result.response.status} {result.response.statusText}
                    </Badge>
                    <span className="text-sm text-muted-foreground ml-2">
                      {result.response.size} bytes | {result.duration}ms
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(JSON.stringify(result.response.body, null, 2))
                    }
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 mr-1" />
                    )}
                    Copy
                  </Button>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Headers</h4>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(result.response.headers, null, 2)}
                  </pre>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Body</h4>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(result.response.body, null, 2)}
                  </pre>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="assertions" className="mt-4">
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {result.assertions.map((assertion, index) => (
                  <div
                    key={index}
                    className={cn(
                      'p-3 rounded-lg border',
                      assertion.passed
                        ? 'bg-green-500/10 border-green-500/20'
                        : 'bg-red-500/10 border-red-500/20'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {assertion.passed ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <span className="h-4 w-4 flex items-center justify-center text-red-500">
                          x
                        </span>
                      )}
                      <span className="font-medium">{assertion.name}</span>
                    </div>
                    {!assertion.passed && (
                      <div className="mt-2 text-sm space-y-1">
                        {assertion.expected !== undefined && (
                          <p>
                            <span className="text-muted-foreground">Expected:</span>{' '}
                            <code>{JSON.stringify(assertion.expected)}</code>
                          </p>
                        )}
                        {assertion.actual !== undefined && (
                          <p>
                            <span className="text-muted-foreground">Actual:</span>{' '}
                            <code>{JSON.stringify(assertion.actual)}</code>
                          </p>
                        )}
                        {assertion.message && (
                          <p className="text-red-600 dark:text-red-400">
                            {assertion.message}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <ScrollArea className="h-[400px]">
              {result.logs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No logs for this test
                </p>
              ) : (
                <div className="space-y-1 font-mono text-xs">
                  {result.logs.map((log) => (
                    <div
                      key={log.id}
                      className={cn(
                        'px-2 py-1 rounded',
                        log.level === 'error' && 'bg-red-500/10 text-red-500',
                        log.level === 'warn' && 'bg-yellow-500/10 text-yellow-500',
                        log.level === 'info' && 'bg-blue-500/10 text-blue-500',
                        log.level === 'debug' && 'bg-gray-500/10 text-gray-500'
                      )}
                    >
                      <span className="text-muted-foreground">
                        {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                      </span>{' '}
                      [{log.level.toUpperCase()}] {log.message}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
