'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Layers,
  Trash2,
  Loader2,
  AlertCircle,
  Search,
  Filter,
  ArrowUpDown,
  Pencil,
  Plus,
} from 'lucide-react';
import { useAnnotatorStore, usePatterns } from '@/store/annotator-store';
import {
  ANNOTATION_TYPES,
  ANNOTATION_TYPE_LABELS,
  type AnnotationType,
  type Pattern,
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

  // Edit/Create dialog state
  const [editingPattern, setEditingPattern] = useState<Pattern | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editOriginalText, setEditOriginalText] = useState('');
  const [editAnnotatedText, setEditAnnotatedText] = useState('');
  const [editAnnotationType, setEditAnnotationType] = useState<AnnotationType>('TextInput');
  const [editUserContextHint, setEditUserContextHint] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { loadPatterns, deletePattern, deleteAllPatterns, updatePattern, createPattern } = useAnnotatorStore();
  const { patterns, stats, loading, error } = usePatterns();
  const [deletingAll, setDeletingAll] = useState(false);

  // Open edit dialog
  const handleEdit = (pattern: Pattern) => {
    setEditingPattern(pattern);
    setEditOriginalText(pattern.originalText);
    setEditAnnotatedText(pattern.annotatedText);
    setEditAnnotationType(pattern.annotationType);
    setEditUserContextHint(pattern.userContextHint || '');
  };

  // Open create dialog
  const handleOpenCreate = () => {
    setIsCreateDialogOpen(true);
    setEditOriginalText('');
    setEditAnnotatedText('');
    setEditAnnotationType('TextInput');
    setEditUserContextHint('');
  };

  // Save edited pattern
  const handleSaveEdit = async () => {
    if (!editingPattern) return;
    setIsSaving(true);
    try {
      await updatePattern(editingPattern.id, {
        originalText: editOriginalText,
        annotatedText: editAnnotatedText,
        annotationType: editAnnotationType,
        userContextHint: editUserContextHint || undefined,
      });
      setEditingPattern(null);
    } catch (err) {
      console.error('Failed to update pattern:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Create new pattern
  const handleCreate = async () => {
    if (!editOriginalText || !editAnnotatedText) return;
    setIsSaving(true);
    try {
      await createPattern({
        originalText: editOriginalText,
        annotatedText: editAnnotatedText,
        annotationType: editAnnotationType,
        userContextHint: editUserContextHint || undefined,
      });
      setIsCreateDialogOpen(false);
    } catch (err) {
      console.error('Failed to create pattern:', err);
    } finally {
      setIsSaving(false);
    }
  };

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

  const handleDeleteAll = async () => {
    if (
      confirm(
        `Are you sure you want to delete ALL ${patterns.length} patterns?\n\nThis action cannot be undone. You will need to re-train to create new patterns.`
      )
    ) {
      try {
        setDeletingAll(true);
        const deleted = await deleteAllPatterns();
        alert(`Successfully deleted ${deleted} patterns.`);
      } catch (err) {
        console.error('Delete all failed:', err);
        alert('Failed to delete patterns. Please try again.');
      } finally {
        setDeletingAll(false);
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6" />
            Learned Patterns
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage annotation patterns extracted from training
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Pattern
          </Button>
          {patterns.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={deletingAll}
            >
              {deletingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete All Patterns
                </>
              )}
            </Button>
          )}
        </div>
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
                      <TableCell className="text-xs text-muted-foreground max-w-[300px]">
                        {pattern.semanticContext ? (
                          <span title={pattern.semanticContext} className="line-clamp-2">
                            {pattern.semanticContext}
                          </span>
                        ) : (
                          <span className="italic text-muted-foreground/50">
                            No AI context
                          </span>
                        )}
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
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(pattern)}
                            title="Edit pattern"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(pattern.id)}
                            title="Delete pattern"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Pattern Dialog */}
      <Dialog open={!!editingPattern} onOpenChange={(open) => !open && setEditingPattern(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Edit Pattern</DialogTitle>
            <DialogDescription>
              Modify the pattern text and annotation. AI context will be regenerated.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-original">Original Text (what to find)</Label>
              <Input
                id="edit-original"
                value={editOriginalText}
                onChange={(e) => setEditOriginalText(e.target.value)}
                placeholder="e.g., Creditor's name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-annotated">Annotated Text (replacement)</Label>
              <Input
                id="edit-annotated"
                value={editAnnotatedText}
                onChange={(e) => setEditAnnotatedText(e.target.value)}
                placeholder="e.g., [Textinput: Creditor's name]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Annotation Type</Label>
              <Select
                value={editAnnotationType}
                onValueChange={(v) => setEditAnnotationType(v as AnnotationType)}
              >
                <SelectTrigger id="edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANNOTATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ANNOTATION_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hint">AI Context Hint (optional)</Label>
              <Textarea
                id="edit-hint"
                value={editUserContextHint}
                onChange={(e) => setEditUserContextHint(e.target.value)}
                placeholder="e.g., Use Link when in signature section (second occurrence), TextInput for first occurrence in body"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Help the AI understand when to use this pattern
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPattern(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving || !editOriginalText || !editAnnotatedText}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Pattern Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Create New Pattern</DialogTitle>
            <DialogDescription>
              Add a new annotation pattern manually. AI will generate semantic context.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-original">Original Text (what to find)</Label>
              <Input
                id="create-original"
                value={editOriginalText}
                onChange={(e) => setEditOriginalText(e.target.value)}
                placeholder="e.g., Seller's address"
              />
              <p className="text-xs text-muted-foreground">
                The text that will be searched for in documents
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-annotated">Annotated Text (replacement)</Label>
              <Input
                id="create-annotated"
                value={editAnnotatedText}
                onChange={(e) => setEditAnnotatedText(e.target.value)}
                placeholder="e.g., [Textinput: Seller's address]"
              />
              <p className="text-xs text-muted-foreground">
                The annotation that will replace the original text
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-type">Annotation Type</Label>
              <Select
                value={editAnnotationType}
                onValueChange={(v) => setEditAnnotationType(v as AnnotationType)}
              >
                <SelectTrigger id="create-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANNOTATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ANNOTATION_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-hint">AI Context Hint (optional)</Label>
              <Textarea
                id="create-hint"
                value={editUserContextHint}
                onChange={(e) => setEditUserContextHint(e.target.value)}
                placeholder="e.g., Use Link when in signature section (second occurrence), TextInput for first occurrence in body"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Help the AI understand when to use this pattern
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving || !editOriginalText || !editAnnotatedText}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Pattern'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
