'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Layers,
  Trash2,
  Loader2,
  AlertCircle,
  Search,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import { useAnnotatorStore, usePatterns } from '@/store/annotator-store';
import {
  ANNOTATION_TYPES,
  ANNOTATION_TYPE_LABELS,
  type AnnotationType,
} from '@/types/annotator';
import { format } from 'date-fns';

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-100 text-green-800';
  if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

export default function PatternsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AnnotationType | 'all'>('all');
  const [minConfidence, setMinConfidence] = useState(0);
  const [sortField, setSortField] = useState<'confidence' | 'usageCount' | 'createdAt'>(
    'confidence'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { loadPatterns, deletePattern } = useAnnotatorStore();
  const { patterns, stats, loading, error } = usePatterns();

  useEffect(() => {
    loadPatterns();
  }, [loadPatterns]);

  // Filter and sort patterns
  const filteredPatterns = patterns
    .filter((p) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !p.originalText.toLowerCase().includes(searchLower) &&
          !p.annotatedText.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      // Type filter
      if (typeFilter !== 'all' && p.annotationType !== typeFilter) {
        return false;
      }
      // Confidence filter
      if (p.confidence < minConfidence / 100) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'confidence':
          comparison = a.confidence - b.confidence;
          break;
        case 'usageCount':
          comparison = a.usageCount - b.usageCount;
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this pattern?')) {
      try {
        await deletePattern(id);
      } catch (err) {
        console.error('Delete failed:', err);
      }
    }
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Layers className="h-6 w-6" />
          Learned Patterns
        </h1>
        <p className="text-muted-foreground mt-1">
          View and manage annotation patterns extracted from training
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPatterns}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.averageConfidence * 100).toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.averageSuccessRate * 100).toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Most Common Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {Object.entries(stats.byType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type]) => ANNOTATION_TYPE_LABELS[type as AnnotationType])[0] ||
                  'None'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Search */}
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patterns..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Type Filter */}
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as AnnotationType | 'all')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {ANNOTATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ANNOTATION_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Confidence Filter */}
            <div className="space-y-2">
              <Label>Min Confidence: {minConfidence}%</Label>
              <Slider
                value={[minConfidence]}
                onValueChange={([v]) => setMinConfidence(v)}
                max={100}
                step={10}
              />
            </div>

            {/* Sort */}
            <div className="space-y-2">
              <Label>Sort By</Label>
              <Select
                value={sortField}
                onValueChange={(v) =>
                  setSortField(v as 'confidence' | 'usageCount' | 'createdAt')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confidence">Confidence</SelectItem>
                  <SelectItem value="usageCount">Usage Count</SelectItem>
                  <SelectItem value="createdAt">Created Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Patterns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Patterns ({filteredPatterns.length})</CardTitle>
          <CardDescription>
            Click column headers to sort. Delete patterns to remove them from future
            suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPatterns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No patterns found</p>
              <p className="text-sm">
                {patterns.length === 0
                  ? 'Upload training pairs to start learning patterns'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Original</TableHead>
                    <TableHead>Annotated</TableHead>
                    <TableHead>Context</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSort('confidence')}
                        className="-ml-4"
                      >
                        Confidence
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSort('usageCount')}
                        className="-ml-4"
                      >
                        Usage
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSort('createdAt')}
                        className="-ml-4"
                      >
                        Created
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatterns.map((pattern) => (
                    <TableRow key={pattern.id}>
                      <TableCell className="font-mono text-sm max-w-[200px] truncate">
                        {pattern.originalText}
                      </TableCell>
                      <TableCell className="font-mono text-sm max-w-[200px] truncate text-primary">
                        {pattern.annotatedText}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[250px]">
                        <span className="font-mono">
                          {pattern.contextBefore && (
                            <span title={pattern.contextBefore}>
                              ...{pattern.contextBefore.slice(-25)}
                            </span>
                          )}
                          <span className="text-primary font-medium mx-1">
                            [{pattern.originalText}]
                          </span>
                          {pattern.contextAfter && (
                            <span title={pattern.contextAfter}>
                              {pattern.contextAfter.slice(0, 25)}...
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ANNOTATION_TYPE_LABELS[pattern.annotationType]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getConfidenceColor(pattern.confidence)}>
                          {(pattern.confidence * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {pattern.usageCount}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(pattern.createdAt), 'MMM d')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(pattern.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
