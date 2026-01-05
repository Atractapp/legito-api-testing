'use client';

import { useState, useCallback } from 'react';
import {
  Plus,
  GripVertical,
  Trash2,
  Settings2,
  ChevronUp,
  ChevronDown,
  Play,
  AlertCircle,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AddTestDialog } from './add-test-dialog';
import { getOperationById } from '@/lib/operation-catalog';
import type { ConfiguredTest, WorkspaceResources } from '@/types';

interface TestSuiteBuilderProps {
  tests: ConfiguredTest[];
  onTestsChange: (tests: ConfiguredTest[]) => void;
  workspaceResources?: WorkspaceResources;
  onConfigureElements?: (test: ConfiguredTest) => void;
}

export function TestSuiteBuilder({
  tests,
  onTestsChange,
  workspaceResources,
  onConfigureElements,
}: TestSuiteBuilderProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleAddTest = useCallback((newTest: ConfiguredTest) => {
    onTestsChange([...tests, newTest]);
  }, [tests, onTestsChange]);

  const handleToggleEnabled = useCallback((testId: string) => {
    onTestsChange(
      tests.map(t =>
        t.id === testId ? { ...t, enabled: !t.enabled } : t
      )
    );
  }, [tests, onTestsChange]);

  const handleDelete = useCallback((testId: string) => {
    // Also update any tests that reference this one
    const updatedTests = tests
      .filter(t => t.id !== testId)
      .map(t => ({
        ...t,
        config: t.config.useResultFrom === testId
          ? { ...t.config, useResultFrom: undefined }
          : t.config,
      }))
      // Re-order remaining tests
      .map((t, index) => ({ ...t, order: index }));

    onTestsChange(updatedTests);
    setDeleteConfirmId(null);
  }, [tests, onTestsChange]);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    const newTests = [...tests];
    [newTests[index - 1], newTests[index]] = [newTests[index], newTests[index - 1]];
    newTests.forEach((t, i) => t.order = i);
    onTestsChange(newTests);
  }, [tests, onTestsChange]);

  const handleMoveDown = useCallback((index: number) => {
    if (index === tests.length - 1) return;
    const newTests = [...tests];
    [newTests[index], newTests[index + 1]] = [newTests[index + 1], newTests[index]];
    newTests.forEach((t, i) => t.order = i);
    onTestsChange(newTests);
  }, [tests, onTestsChange]);

  const getMethodBadgeVariant = (method: string) => {
    switch (method) {
      case 'GET': return 'secondary';
      case 'POST': return 'default';
      case 'PUT': return 'outline';
      case 'DELETE': return 'destructive';
      default: return 'outline';
    }
  };

  const getTestDependencyWarning = (test: ConfiguredTest): string | null => {
    if (!test.config.useResultFrom) return null;
    const sourceTest = tests.find(t => t.id === test.config.useResultFrom);
    if (!sourceTest) return 'Source test not found';
    if (!sourceTest.enabled) return 'Source test is disabled';

    const sourceIndex = tests.indexOf(sourceTest);
    const thisIndex = tests.indexOf(test);
    if (sourceIndex >= thisIndex) return 'Source test must run before this test';

    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Test Suite
            </CardTitle>
            <CardDescription>
              {tests.length === 0
                ? 'No tests configured. Add operations to build your test suite.'
                : `${tests.filter(t => t.enabled).length} of ${tests.length} tests enabled`}
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Test
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No Tests Yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Start building your test suite by adding API operations.
              Each test can be configured with specific data and dependencies.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Test
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {tests.map((test, index) => {
                const opDef = getOperationById(test.operation);
                const warning = getTestDependencyWarning(test);

                return (
                  <div
                    key={test.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      !test.enabled ? 'opacity-50 bg-muted/30' : 'bg-card hover:bg-muted/30'
                    } ${warning ? 'border-orange-300 dark:border-orange-700' : ''}`}
                  >
                    {/* Drag Handle & Order */}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <GripVertical className="h-4 w-4 cursor-grab" />
                      <span className="text-sm font-mono w-6">{index + 1}.</span>
                    </div>

                    {/* Enable/Disable Toggle */}
                    <Switch
                      checked={test.enabled}
                      onCheckedChange={() => handleToggleEnabled(test.id)}
                      className="data-[state=checked]:bg-green-500"
                    />

                    {/* Test Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={getMethodBadgeVariant(opDef?.method || 'GET')} className="text-xs">
                          {opDef?.method}
                        </Badge>
                        <span className="font-medium truncate">{test.name}</span>
                        {warning && (
                          <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {opDef?.category}
                        </span>
                        {test.config.templateName && (
                          <Badge variant="outline" className="text-xs">
                            {test.config.templateName}
                          </Badge>
                        )}
                        {test.config.objectName && (
                          <Badge variant="outline" className="text-xs">
                            {test.config.objectName}
                          </Badge>
                        )}
                        {test.config.useResultFrom && (
                          <Badge variant="secondary" className="text-xs">
                            Uses #{tests.findIndex(t => t.id === test.config.useResultFrom) + 1}
                          </Badge>
                        )}
                        {warning && (
                          <span className="text-xs text-orange-600 dark:text-orange-400">
                            {warning}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === tests.length - 1}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Settings2 className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(test.operation === 'CREATE_DOCUMENT' || test.operation === 'UPDATE_DOCUMENT') && (
                            <>
                              <DropdownMenuItem onClick={() => onConfigureElements?.(test)}>
                                <Settings2 className="h-4 w-4 mr-2" />
                                Configure Elements
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteConfirmId(test.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Test
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Summary */}
        {tests.length > 0 && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Check className="h-4 w-4 text-green-500" />
                {tests.filter(t => t.enabled).length} enabled
              </span>
              <span>
                {tests.filter(t => !t.enabled).length} disabled
              </span>
            </div>
            <span>
              Execution order: 1 → {tests.length}
            </span>
          </div>
        )}
      </CardContent>

      {/* Add Test Dialog */}
      <AddTestDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAddTest={handleAddTest}
        existingTests={tests}
        workspaceResources={workspaceResources}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Test?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the test from your suite. Any tests that depend on this one
              will have their dependency cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
