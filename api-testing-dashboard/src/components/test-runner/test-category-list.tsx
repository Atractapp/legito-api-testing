'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, FolderOpen, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTestStore } from '@/store/test-store';
import { StatusBadge, StatusDot } from '@/components/shared/status-badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { TestCategory, TestCase } from '@/types';

interface TestCategoryListProps {
  onTestSelect?: (testId: string) => void;
}

export function TestCategoryList({ onTestSelect }: TestCategoryListProps) {
  const { categories, selectedTests, toggleTestSelection, selectCategory, isRunning } =
    useTestStore();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map((c) => c.id))
  );

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const getCategoryStatus = (category: TestCategory) => {
    const statuses = category.tests.map((t) => t.status);
    if (statuses.every((s) => s === 'passed')) return 'passed';
    if (statuses.some((s) => s === 'failed')) return 'failed';
    if (statuses.some((s) => s === 'running')) return 'running';
    if (statuses.some((s) => s === 'skipped')) return 'skipped';
    return 'pending';
  };

  const isCategorySelected = (category: TestCategory) => {
    return category.tests.every((t) => selectedTests.includes(t.id));
  };

  const isCategoryPartiallySelected = (category: TestCategory) => {
    const selectedCount = category.tests.filter((t) =>
      selectedTests.includes(t.id)
    ).length;
    return selectedCount > 0 && selectedCount < category.tests.length;
  };

  return (
    <div className="space-y-1">
      {categories.map((category) => {
        const isExpanded = expandedCategories.has(category.id);
        const isSelected = isCategorySelected(category);
        const isPartial = isCategoryPartiallySelected(category);
        const categoryStatus = getCategoryStatus(category);

        return (
          <div key={category.id} className="rounded-lg border border-border bg-card">
            {/* Category Header */}
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg',
                !isExpanded && 'rounded-b-lg'
              )}
              onClick={() => toggleCategory(category.id)}
            >
              <button
                className="p-0.5 hover:bg-accent rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCategory(category.id);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              <Checkbox
                checked={isSelected}
                ref={(el) => {
                  if (el) {
                    (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = isPartial;
                  }
                }}
                onCheckedChange={() => selectCategory(category.id)}
                onClick={(e) => e.stopPropagation()}
                disabled={isRunning}
                className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
              />

              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Folder className="h-4 w-4 text-muted-foreground" />
              )}

              <span className="flex-1 font-medium text-sm">{category.name}</span>

              <Badge variant="outline" className="text-xs">
                {category.tests.length} tests
              </Badge>

              <StatusDot status={categoryStatus} />
            </div>

            {/* Test List */}
            {isExpanded && (
              <div className="border-t border-border">
                {category.tests.map((test, index) => (
                  <TestItem
                    key={test.id}
                    test={test}
                    isSelected={selectedTests.includes(test.id)}
                    onToggle={() => toggleTestSelection(test.id)}
                    onClick={() => onTestSelect?.(test.id)}
                    disabled={isRunning}
                    isLast={index === category.tests.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface TestItemProps {
  test: TestCase;
  isSelected: boolean;
  onToggle: () => void;
  onClick?: () => void;
  disabled?: boolean;
  isLast?: boolean;
}

function TestItem({
  test,
  isSelected,
  onToggle,
  onClick,
  disabled,
  isLast,
}: TestItemProps) {
  const methodColors: Record<string, string> = {
    GET: 'text-green-600 dark:text-green-400',
    POST: 'text-blue-600 dark:text-blue-400',
    PUT: 'text-yellow-600 dark:text-yellow-400',
    DELETE: 'text-red-600 dark:text-red-400',
    PATCH: 'text-purple-600 dark:text-purple-400',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 pl-10 hover:bg-accent/30 transition-colors cursor-pointer',
        isLast && 'rounded-b-lg'
      )}
      onClick={onClick}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        disabled={disabled}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-mono font-bold', methodColors[test.method])}>
            {test.method}
          </span>
          <span className="text-sm font-medium truncate">{test.name}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground font-mono truncate">
            {test.endpoint}
          </span>
          <span className="text-xs text-muted-foreground">
            {test.assertions} assertions
          </span>
        </div>
      </div>

      <StatusBadge status={test.status} size="sm" />

      {test.duration && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {test.duration}ms
        </span>
      )}
    </div>
  );
}
