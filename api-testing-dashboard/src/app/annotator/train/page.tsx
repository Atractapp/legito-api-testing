'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  FileText,
  Check,
  X,
  Loader2,
  Trash2,
  GraduationCap,
  AlertCircle,
  Save,
} from 'lucide-react';
import {
  useAnnotatorStore,
  useTrainingPairs,
  usePendingPatterns,
} from '@/store/annotator-store';
import { PatternSuggestionCard } from '@/components/annotator/pattern-suggestion-card';
import { format } from 'date-fns';
import type { PatternSuggestion } from '@/types/annotator';

export default function TrainPage() {
  const [name, setName] = useState('');
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [annotatedFile, setAnnotatedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isSavingPatterns, setIsSavingPatterns] = useState(false);

  const {
    uploadTrainingPair,
    deleteTrainingPair,
    deleteAllTrainingPairs,
    loadTrainingPairs,
    setPendingPatterns,
    acceptPendingPattern,
    rejectPendingPattern,
    updatePendingPattern,
    confirmPendingPatterns,
    clearPendingPatterns,
  } = useAnnotatorStore();
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const { trainingPairs, loading, error } = useTrainingPairs();
  const { pendingPatterns, source: pendingSource, trainingPairId } = usePendingPatterns();

  useEffect(() => {
    loadTrainingPairs();
  }, [loadTrainingPairs]);

  // Original file dropzone
  const onDropOriginal = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setOriginalFile(acceptedFiles[0]);
      // Auto-generate name from filename if empty
      if (!name) {
        const baseName = acceptedFiles[0].name.replace(/\.docx?$/i, '');
        setName(baseName);
      }
    }
  }, [name]);

  const { getRootProps: getOriginalRootProps, getInputProps: getOriginalInputProps, isDragActive: isOriginalDragActive } = useDropzone({
    onDrop: onDropOriginal,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
  });

  // Annotated file dropzone
  const onDropAnnotated = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setAnnotatedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps: getAnnotatedRootProps, getInputProps: getAnnotatedInputProps, isDragActive: isAnnotatedDragActive } = useDropzone({
    onDrop: onDropAnnotated,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!name || !originalFile || !annotatedFile) {
      setUploadError('Please provide a name and both files');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      // Upload returns extractedPatterns for review
      const formData = new FormData();
      formData.append('name', name);
      formData.append('originalFile', originalFile);
      formData.append('annotatedFile', annotatedFile);

      const response = await fetch('/api/annotator/training', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${response.status}`);
      }

      const data = await response.json();

      // Set pending patterns for review
      if (data.extractedPatterns && data.extractedPatterns.length > 0) {
        setPendingPatterns(
          data.extractedPatterns as PatternSuggestion[],
          'training',
          data.trainingPair.id
        );
        setUploadSuccess(
          `Training pair uploaded! Review ${data.extractedPatterns.length} extracted patterns below.`
        );
      } else {
        setUploadSuccess('Training pair uploaded, but no patterns were extracted.');
        // Reload training pairs since no review step
        loadTrainingPairs();
      }

      // Reset form
      setName('');
      setOriginalFile(null);
      setAnnotatedFile(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSavePatterns = async () => {
    if (!pendingPatterns || pendingPatterns.length === 0) return;

    setIsSavingPatterns(true);
    try {
      const result = await confirmPendingPatterns();
      setUploadSuccess(
        `Saved ${result.saved} new patterns${result.updated > 0 ? ` and updated ${result.updated} existing` : ''}.`
      );
      // Reload training pairs
      loadTrainingPairs();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to save patterns');
    } finally {
      setIsSavingPatterns(false);
    }
  };

  const handleDiscardPatterns = () => {
    clearPendingPatterns();
    setUploadSuccess(null);
    // Reload training pairs
    loadTrainingPairs();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this training pair?')) {
      try {
        await deleteTrainingPair(id);
      } catch (err) {
        console.error('Delete failed:', err);
      }
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="h-6 w-6" />
          Train Model
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload document pairs to teach the AI how to annotate
        </p>
      </div>

      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Training Pair</CardTitle>
          <CardDescription>
            Upload an original document and its annotated version. The AI will learn
            from the differences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="name">Training Pair Name</Label>
            <Input
              id="name"
              placeholder="e.g., Service Agreement Template"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* File Upload Areas */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Original File */}
            <div className="space-y-2">
              <Label>Original Document</Label>
              <div
                {...getOriginalRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isOriginalDragActive
                    ? 'border-primary bg-primary/5'
                    : originalFile
                      ? 'border-green-500 bg-green-50 dark:bg-green-950'
                      : 'border-border hover:border-primary'
                }`}
              >
                <input {...getOriginalInputProps()} />
                {originalFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium">{originalFile.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOriginalFile(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Drop original .docx file here
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Annotated File */}
            <div className="space-y-2">
              <Label>Annotated Document</Label>
              <div
                {...getAnnotatedRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isAnnotatedDragActive
                    ? 'border-primary bg-primary/5'
                    : annotatedFile
                      ? 'border-green-500 bg-green-50 dark:bg-green-950'
                      : 'border-border hover:border-primary'
                }`}
              >
                <input {...getAnnotatedInputProps()} />
                {annotatedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium">{annotatedFile.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnnotatedFile(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Drop annotated .docx file here
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {uploadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {uploadSuccess && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <Check className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                {uploadSuccess}
              </AlertDescription>
            </Alert>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!name || !originalFile || !annotatedFile || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading & Processing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Training Pair
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Pattern Review Section - shown when patterns extracted from training */}
      {pendingPatterns && pendingPatterns.length > 0 && pendingSource === 'training' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Review Extracted Patterns</span>
              <Badge variant="secondary">
                {pendingPatterns.filter((p) => p.isAccepted).length} / {pendingPatterns.length}{' '}
                accepted
              </Badge>
            </CardTitle>
            <CardDescription>
              Review patterns extracted from the training documents. Accept or reject each pattern,
              and edit the annotation text if needed. Context is shown around each pattern.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {pendingPatterns.map((pattern) => (
                  <PatternSuggestionCard
                    key={pattern.id}
                    pattern={pattern}
                    onAccept={() => acceptPendingPattern(pattern.id)}
                    onReject={() => rejectPendingPattern(pattern.id)}
                    onUpdate={(updates) => updatePendingPattern(pattern.id, updates)}
                  />
                ))}
              </div>
            </ScrollArea>

            <div className="mt-4 flex gap-2">
              <Button
                onClick={handleSavePatterns}
                disabled={
                  isSavingPatterns ||
                  pendingPatterns.filter((p) => p.isAccepted).length === 0
                }
                className="flex-1"
              >
                {isSavingPatterns ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save {pendingPatterns.filter((p) => p.isAccepted).length} Patterns
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleDiscardPatterns}>
                Discard All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Training Pairs List */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Training Pairs</CardTitle>
            <CardDescription>
              Previously uploaded document pairs used for training
            </CardDescription>
          </div>
          {trainingPairs.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (confirm('Delete ALL training pairs and patterns? This cannot be undone.')) {
                  try {
                    setIsDeletingAll(true);
                    const count = await deleteAllTrainingPairs();
                    alert(`Deleted ${count} training pairs and all associated patterns.`);
                  } catch (err) {
                    console.error('Delete all failed:', err);
                    alert('Failed to delete. Please try again.');
                  } finally {
                    setIsDeletingAll(false);
                  }
                }
              }}
              disabled={isDeletingAll}
            >
              {isDeletingAll ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete All
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : trainingPairs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No training pairs yet</p>
              <p className="text-sm">Upload your first document pair above</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Patterns</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainingPairs.map((pair) => (
                  <TableRow key={pair.id}>
                    <TableCell className="font-medium">{pair.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{pair.patternsCount} patterns</Badge>
                    </TableCell>
                    <TableCell>
                      {pair.isUserCorrected ? (
                        <Badge variant="outline" className="text-blue-600">
                          Correction
                        </Badge>
                      ) : (
                        <Badge variant="outline">Upload</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(pair.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(pair.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
