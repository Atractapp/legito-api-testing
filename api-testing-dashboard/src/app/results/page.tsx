'use client';

import { TestResultsTable } from '@/components/dashboard/test-results-table';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { useTestStore } from '@/store/test-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, Download, RefreshCw, ExternalLink, Link2, Copy, Check } from 'lucide-react';
import { useState, useMemo } from 'react';

export default function ResultsPage() {
  const { testResults, stats, currentRun, categories } = useTestStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredResults = useMemo(() => {
    return testResults.filter((result) => {
      const matchesSearch = result.testName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || result.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || result.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [testResults, searchQuery, statusFilter, categoryFilter]);

  const exportResults = () => {
    const data = JSON.stringify(filteredResults, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-results-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const uniqueCategories = [...new Set(testResults.map((r) => r.category))];

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <StatsCards stats={stats} currentRun={currentRun} />

      {/* External Link Card - Show prominently if available */}
      {currentRun?.externalLinkUrl && (
        <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-green-700 dark:text-green-400">
                External Sharing Link Created
              </CardTitle>
            </div>
            <CardDescription>
              This link was created during the test run and can be used to access the document externally.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <code className="flex-1 px-4 py-3 bg-white dark:bg-gray-900 rounded-lg border text-sm font-mono break-all">
                {currentRun.externalLinkUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(currentRun.externalLinkUrl!)}
                className="shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="default"
                size="sm"
                asChild
                className="shrink-0 bg-green-600 hover:bg-green-700"
              >
                <a href={currentRun.externalLinkUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Link
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>
                View detailed results from your test runs
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {filteredResults.length} of {testResults.length} results
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={exportResults}
                disabled={filteredResults.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchQuery || statusFilter !== 'all' || categoryFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setCategoryFilter('all');
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </div>

          {/* Results Table */}
          <TestResultsTable results={filteredResults} />
        </CardContent>
      </Card>
    </div>
  );
}
