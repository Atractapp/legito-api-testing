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
} from 'lucide-react';
import { useAnnotatorStore, useTrainingPairs } from '@/store/annotator-store';
import { format } from 'date-fns';

export default function TrainPage() {
  const [name, setName] = useState('');
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [annotatedFile, setAnnotatedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const { uploadTrainingPair, deleteTrainingPair, loadTrainingPairs } = useAnnotatorStore();
  const { trainingPairs, loading, error } = useTrainingPairs();

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
      const result = await uploadTrainingPair({
        name,
        originalFile,
        annotatedFile,
      });

      setUploadSuccess(`Successfully uploaded! Extracted ${result.patternsExtracted?.length || 0} patterns.`);

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

      <Separator />

      {/* Training Pairs List */}
      <Card>
        <CardHeader>
          <CardTitle>Training Pairs</CardTitle>
          <CardDescription>
            Previously uploaded document pairs used for training
          </CardDescription>
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
