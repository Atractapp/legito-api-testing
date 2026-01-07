'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Upload,
  Wand2,
  Loader2,
  Download,
  Check,
  X,
  AlertCircle,
  Edit2,
  Save,
  FileText,
} from 'lucide-react';
import { useAnnotatorStore, useCurrentSession } from '@/store/annotator-store';
import { ANNOTATION_TYPE_LABELS, CONFIDENCE_THRESHOLDS, type AnnotationType } from '@/types/annotator';

function getConfidenceColor(confidence: number): string {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'text-green-600 bg-green-100';
  if (confidence >= CONFIDENCE_THRESHOLDS.medium) return 'text-yellow-600 bg-yellow-100';
  return 'text-red-600 bg-red-100';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'High';
  if (confidence >= CONFIDENCE_THRESHOLDS.medium) return 'Medium';
  return 'Low';
}

export default function AnnotatePage() {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const {
    startAnnotationSession,
    updateSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    generateAnnotatedDocument,
    clearCurrentSession,
  } = useAnnotatorStore();

  const { session, suggestions, loading, error } = useCurrentSession();

  // File dropzone
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      clearCurrentSession();
      setDownloadUrl(null);
      try {
        await startAnnotationSession(acceptedFiles[0]);
      } catch (err) {
        console.error('Failed to start session:', err);
      }
    }
  }, [startAnnotationSession, clearCurrentSession]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
  });

  const handleGenerate = async () => {
    try {
      const url = await generateAnnotatedDocument();
      setDownloadUrl(url);
    } catch (err) {
      console.error('Failed to generate document:', err);
    }
  };

  const handleEdit = (id: string, currentValue: string) => {
    setEditingId(id);
    setEditValue(currentValue);
  };

  const handleSaveEdit = (id: string) => {
    updateSuggestion(id, { editedText: editValue, isEdited: true });
    setEditingId(null);
    setEditValue('');
  };

  const acceptedCount = suggestions.filter((s) => s.isAccepted).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wand2 className="h-6 w-6" />
          Annotate Document
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload a document to get AI-powered annotation suggestions
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column - Upload & Document */}
        <div className="space-y-6">
          {/* Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Document</CardTitle>
              <CardDescription>
                Upload a Word document (.docx) to annotate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : session
                      ? 'border-green-500 bg-green-50 dark:bg-green-950'
                      : 'border-border hover:border-primary'
                }`}
              >
                <input {...getInputProps()} />
                {loading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Processing document...</p>
                  </div>
                ) : session ? (
                  <div className="flex flex-col items-center gap-2">
                    <Check className="h-10 w-10 text-green-500" />
                    <p className="font-medium">{session.inputFilename}</p>
                    <p className="text-sm text-muted-foreground">
                      Click or drop to upload a different document
                    </p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">Drop your document here</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      or click to select a file
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Document Preview (text only for simplicity) */}
          {session && (
            <Card>
              <CardHeader>
                <CardTitle>Document Preview</CardTitle>
                <CardDescription>
                  Original text content from the uploaded document
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {session.inputText}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Suggestions */}
        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {session && (
            <>
              {/* Suggestions List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Annotation Suggestions</span>
                    <Badge variant="secondary">
                      {acceptedCount} / {suggestions.length} accepted
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Review and modify the AI suggestions. Click to accept or reject.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {suggestions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No annotations suggested</p>
                      <p className="text-sm">
                        Try uploading more training pairs to improve detection
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-3 pr-4">
                        {suggestions.map((suggestion) => (
                          <div
                            key={suggestion.id}
                            className={`p-3 rounded-lg border transition-colors ${
                              suggestion.isAccepted
                                ? 'border-green-200 bg-green-50 dark:bg-green-950/30'
                                : 'border-red-200 bg-red-50 dark:bg-red-950/30'
                            }`}
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="outline">
                                {ANNOTATION_TYPE_LABELS[suggestion.type as AnnotationType]}
                              </Badge>
                              <div className="flex items-center gap-2">
                                <Badge className={getConfidenceColor(suggestion.confidence)}>
                                  {getConfidenceLabel(suggestion.confidence)} ({(suggestion.confidence * 100).toFixed(0)}%)
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => acceptSuggestion(suggestion.id)}
                                  className={suggestion.isAccepted ? 'text-green-600' : ''}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => rejectSuggestion(suggestion.id)}
                                  className={!suggestion.isAccepted ? 'text-red-600' : ''}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Content */}
                            <div className="space-y-1 text-sm">
                              <div>
                                <span className="text-muted-foreground">Original: </span>
                                <span className="font-mono bg-muted px-1 rounded">
                                  {suggestion.originalText}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Annotated: </span>
                                {editingId === suggestion.id ? (
                                  <div className="flex items-center gap-2 flex-1">
                                    <Input
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      className="h-7 text-sm font-mono"
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleSaveEdit(suggestion.id)}
                                    >
                                      <Save className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingId(null)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <span className="font-mono bg-primary/10 px-1 rounded text-primary">
                                      {suggestion.isEdited && suggestion.editedText
                                        ? suggestion.editedText
                                        : suggestion.annotatedText}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        handleEdit(
                                          suggestion.id,
                                          suggestion.isEdited && suggestion.editedText
                                            ? suggestion.editedText
                                            : suggestion.annotatedText
                                        )
                                      }
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                              {suggestion.isEdited && (
                                <Badge variant="outline" className="text-xs">
                                  Modified
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <Separator />

              {/* Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Generate Document</CardTitle>
                  <CardDescription>
                    Create the annotated document with your accepted annotations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={handleGenerate}
                    disabled={loading || acceptedCount === 0}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Generate Annotated Document ({acceptedCount} annotations)
                      </>
                    )}
                  </Button>

                  {downloadUrl && (
                    <Button variant="outline" asChild className="w-full">
                      <a href={downloadUrl} download>
                        <Download className="mr-2 h-4 w-4" />
                        Download Annotated Document
                      </a>
                    </Button>
                  )}

                  <p className="text-xs text-muted-foreground text-center">
                    Tip: After downloading, you can correct any mistakes and upload the
                    corrected version as a new training pair to improve the AI.
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
