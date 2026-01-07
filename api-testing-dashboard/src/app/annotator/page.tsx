'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, GraduationCap, Wand2, Layers, ArrowRight, FileText, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useAnnotatorStore, useAnnotatorStats } from '@/store/annotator-store';
import { ANNOTATION_TYPE_LABELS, type AnnotationType } from '@/types/annotator';

export default function AnnotatorDashboard() {
  const { loadTrainingPairs, loadPatterns, loadSessions } = useAnnotatorStore();
  const stats = useAnnotatorStats();

  useEffect(() => {
    loadTrainingPairs();
    loadPatterns();
    loadSessions();
  }, [loadTrainingPairs, loadPatterns, loadSessions]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            Smart Annotator
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered document annotation learning
          </p>
        </div>
        <Button asChild>
          <Link href="/annotator/annotate">
            <Wand2 className="mr-2 h-4 w-4" />
            Annotate Document
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Training Pairs</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.trainingPairsCount}</div>
            <p className="text-xs text-muted-foreground">
              Document pairs for learning
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Patterns Learned</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.patternsCount}</div>
            <p className="text-xs text-muted-foreground">
              Annotation patterns extracted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sessionsCount}</div>
            <p className="text-xs text-muted-foreground">
              Documents annotated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.patternStats?.averageConfidence
                ? `${(stats.patternStats.averageConfidence * 100).toFixed(0)}%`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Pattern reliability score
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pattern Distribution */}
      {stats.patternStats && stats.patternsCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pattern Distribution</CardTitle>
            <CardDescription>Annotation types learned from training</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(stats.patternStats.byType) as [AnnotationType, number][])
                .filter(([, count]) => count > 0)
                .map(([type, count]) => (
                  <Badge key={type} variant="secondary" className="text-sm">
                    {ANNOTATION_TYPE_LABELS[type]}: {count}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Train Model
            </CardTitle>
            <CardDescription>
              Upload document pairs to teach the AI how to annotate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="w-full">
              <Link href="/annotator/train">
                Upload Training Pairs
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Annotate Document
            </CardTitle>
            <CardDescription>
              Upload a document and get AI-powered annotation suggestions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="w-full">
              <Link href="/annotator/annotate">
                Start Annotating
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Manage Patterns
            </CardTitle>
            <CardDescription>
              View, edit, and manage learned annotation patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="w-full">
              <Link href="/annotator/patterns">
                View Patterns
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Getting Started Guide */}
      {stats.trainingPairsCount === 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Follow these steps to start using Smart Annotator
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                1
              </div>
              <div>
                <h4 className="font-medium">Upload Training Pairs</h4>
                <p className="text-sm text-muted-foreground">
                  Upload pairs of documents: one original, one with Legito annotations.
                  The AI learns from the differences.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                2
              </div>
              <div>
                <h4 className="font-medium">Annotate New Documents</h4>
                <p className="text-sm text-muted-foreground">
                  Upload a new document and the AI will suggest annotations based on
                  what it learned.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                3
              </div>
              <div>
                <h4 className="font-medium">Correct and Improve</h4>
                <p className="text-sm text-muted-foreground">
                  Fix any mistakes in the AI output and save as a new training pair.
                  The AI continuously improves!
                </p>
              </div>
            </div>

            <Button asChild className="mt-4">
              <Link href="/annotator/train">
                <GraduationCap className="mr-2 h-4 w-4" />
                Start Training
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
