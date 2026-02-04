'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, X, Edit2, Save, XCircle } from 'lucide-react';
import type { PatternSuggestion, AnnotationType } from '@/types/annotator';
import { ANNOTATION_TYPE_LABELS } from '@/types/annotator';

interface PatternSuggestionCardProps {
  pattern: PatternSuggestion;
  onAccept: () => void;
  onReject: () => void;
  onUpdate: (updates: Partial<PatternSuggestion>) => void;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

export function PatternSuggestionCard({
  pattern,
  onAccept,
  onReject,
  onUpdate,
}: PatternSuggestionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(
    pattern.editedAnnotatedText || pattern.annotatedText
  );

  const handleSaveEdit = () => {
    onUpdate({ editedAnnotatedText: editValue });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValue(pattern.editedAnnotatedText || pattern.annotatedText);
    setIsEditing(false);
  };

  const displayAnnotatedText = pattern.isEdited && pattern.editedAnnotatedText
    ? pattern.editedAnnotatedText
    : pattern.annotatedText;

  return (
    <Card
      className={`transition-all ${
        pattern.isAccepted
          ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30'
          : 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30 opacity-60'
      }`}
    >
      <CardContent className="p-4">
        {/* Header: Type badge + Confidence + Accept/Reject buttons */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {ANNOTATION_TYPE_LABELS[pattern.annotationType] || pattern.annotationType}
            </Badge>
            <Badge className={getConfidenceColor(pattern.confidence)}>
              {getConfidenceLabel(pattern.confidence)} ({Math.round(pattern.confidence * 100)}%)
            </Badge>
            {pattern.isEdited && (
              <Badge variant="secondary" className="text-xs">
                Modified
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={pattern.isAccepted ? 'default' : 'outline'}
              size="sm"
              onClick={onAccept}
              className={pattern.isAccepted ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant={!pattern.isAccepted ? 'default' : 'outline'}
              size="sm"
              onClick={onReject}
              className={!pattern.isAccepted ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Original text display */}
        <div className="text-sm font-mono bg-muted/50 rounded p-2 mb-3 overflow-x-auto">
          <span className="text-muted-foreground mr-2">Original:</span>
          <span className="bg-yellow-200 dark:bg-yellow-800 px-1 font-semibold">
            {pattern.originalText}
          </span>
        </div>

        {/* Annotation transformation line with edit capability */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Becomes:</span>
          {isEditing ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-8 text-sm font-mono flex-1"
                autoFocus
              />
              <Button variant="ghost" size="sm" onClick={handleSaveEdit}>
                <Save className="h-4 w-4 text-green-600" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                <XCircle className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <code className="text-sm bg-primary/10 text-primary px-2 py-1 rounded flex-1">
                {displayAnnotatedText}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                disabled={!pattern.isAccepted}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default PatternSuggestionCard;
