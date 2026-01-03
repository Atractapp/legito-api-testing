'use client';

import { useState, useCallback } from 'react';
import {
  Scan,
  ChevronDown,
  ChevronRight,
  FileText,
  Database,
  Users,
  UserCircle,
  Loader2,
  Check,
  AlertCircle,
  RefreshCw,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTestStore } from '@/store/test-store';
import { scanWorkspace, type ScanProgress } from '@/lib/workspace-service';
import { generateTestsFromResources } from '@/lib/test-generator-service';
import { saveTestPreset } from '@/lib/supabase';
import type { WorkspaceResources, LegitoRegion, TestPreset } from '@/types';

const regionOptions: { value: LegitoRegion; label: string; baseUrl: string }[] = [
  { value: 'emea', label: 'EMEA (Europe)', baseUrl: 'https://emea.legito.com/api/v7' },
  { value: 'us', label: 'US (United States)', baseUrl: 'https://us.legito.com/api/v7' },
  { value: 'ca', label: 'CA (Canada)', baseUrl: 'https://ca.legito.com/api/v7' },
  { value: 'apac', label: 'APAC (Asia Pacific)', baseUrl: 'https://apac.legito.com/api/v7' },
  { value: 'quarterly', label: 'Quarterly', baseUrl: 'https://quarterly.legito.com/api/v7' },
];

export function WorkspaceScanner() {
  const { setActivePreset } = useTestStore();

  // Credentials form
  const [apiKey, setApiKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [region, setRegion] = useState<LegitoRegion>('emea');
  const [presetName, setPresetName] = useState('');

  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [resources, setResources] = useState<WorkspaceResources | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Selection state
  const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(new Set());
  const [selectedObjects, setSelectedObjects] = useState<Set<number>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['templates']));

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  const baseUrl = regionOptions.find(r => r.value === region)?.baseUrl || '';

  const handleScan = useCallback(async () => {
    if (!apiKey || !privateKey) return;

    setIsScanning(true);
    setScanError(null);
    setResources(null);
    setSelectedTemplates(new Set());
    setSelectedObjects(new Set());

    try {
      const result = await scanWorkspace(
        { apiKey, privateKey, baseUrl, region },
        setScanProgress
      );
      setResources(result);

      // Auto-select first template and object
      if (result.templates.length > 0) {
        setSelectedTemplates(new Set([result.templates[0].id]));
      }
      if (result.objects.length > 0) {
        setSelectedObjects(new Set([result.objects[0].id]));
      }

      // Default preset name
      if (!presetName) {
        setPresetName(`${region.toUpperCase()} Workspace`);
      }
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Failed to scan workspace');
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  }, [apiKey, privateKey, baseUrl, region, presetName]);

  const toggleTemplate = (id: number) => {
    setSelectedTemplates(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleObject = (id: number) => {
    setSelectedObjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleGeneratePreset = async () => {
    if (!resources || !presetName) return;

    setIsSaving(true);
    try {
      // Generate tests from selected resources
      const generatedTests = generateTestsFromResources(resources, {
        selectedTemplateIds: Array.from(selectedTemplates),
        selectedObjectIds: Array.from(selectedObjects),
        generateDocumentTests: selectedTemplates.size > 0,
        generateObjectTests: selectedObjects.size > 0,
      });

      // Create preset
      const preset: Omit<TestPreset, 'id' | 'createdAt' | 'updatedAt'> = {
        name: presetName,
        description: `Generated from workspace scan on ${new Date().toLocaleDateString()}`,
        region,
        apiKey,
        privateKey,
        baseUrl,
        timeout: 30000,
        retryCount: 0,
        parallelExecution: false,
        selectedTemplateIds: Array.from(selectedTemplates).map(String),
        selectedObjectIds: Array.from(selectedObjects).map(String),
        customTests: generatedTests,
        isDefault: false,
      };

      const saved = await saveTestPreset(preset as TestPreset);
      if (saved) {
        setActivePreset(saved);
        // Reset form
        setResources(null);
        setApiKey('');
        setPrivateKey('');
        setPresetName('');
      }
    } catch (error) {
      console.error('Error saving preset:', error);
      setScanError('Failed to save preset');
    } finally {
      setIsSaving(false);
    }
  };

  const getProgressPercent = () => {
    if (!scanProgress) return 0;
    return Math.round((scanProgress.current / scanProgress.total) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Credentials Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            Scan Workspace
          </CardTitle>
          <CardDescription>
            Enter your API credentials to scan your Legito workspace and discover resources
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="scan-apiKey">API Key</Label>
              <Input
                id="scan-apiKey"
                type="password"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isScanning}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scan-privateKey">Private Key</Label>
              <Input
                id="scan-privateKey"
                type="password"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                disabled={isScanning}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="scan-region">Region</Label>
              <Select
                value={region}
                onValueChange={(value) => setRegion(value as LegitoRegion)}
                disabled={isScanning}
              >
                <SelectTrigger id="scan-region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {regionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scan-presetName">Preset Name</Label>
              <Input
                id="scan-presetName"
                placeholder="e.g., My Workspace"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                disabled={isScanning}
              />
            </div>
          </div>

          {/* Scan Progress */}
          {isScanning && scanProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Scanning {scanProgress.step}...</span>
                <span>{getProgressPercent()}%</span>
              </div>
              <Progress value={getProgressPercent()} className="h-2" />
            </div>
          )}

          {/* Error Alert */}
          {scanError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Scan Failed</AlertTitle>
              <AlertDescription>{scanError}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleScan}
            disabled={!apiKey || !privateKey || isScanning}
            className="w-full"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scanning...
              </>
            ) : resources ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Rescan Workspace
              </>
            ) : (
              <>
                <Scan className="h-4 w-4 mr-2" />
                Scan Workspace
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Scan Results */}
      {resources && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Found Resources</CardTitle>
                <CardDescription>
                  Select resources to include in your test preset
                </CardDescription>
              </div>
              <Badge variant="secondary">
                Scanned {new Date(resources.scannedAt).toLocaleTimeString()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {/* Templates */}
              <Collapsible
                open={expandedSections.has('templates')}
                onOpenChange={() => toggleSection('templates')}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded-lg px-2">
                  {expandedSections.has('templates') ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Templates</span>
                  <Badge variant="outline" className="ml-auto">
                    {resources.templates.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-10 space-y-1">
                  {resources.templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded cursor-pointer"
                      onClick={() => toggleTemplate(template.id)}
                    >
                      <Checkbox
                        checked={selectedTemplates.has(template.id)}
                        onCheckedChange={() => toggleTemplate(template.id)}
                      />
                      <span className="text-sm">{template.name}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {template.elements.length} elements
                      </Badge>
                    </div>
                  ))}
                  {resources.templates.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No templates found</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Objects */}
              <Collapsible
                open={expandedSections.has('objects')}
                onOpenChange={() => toggleSection('objects')}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded-lg px-2">
                  {expandedSections.has('objects') ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Database className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Smart Records Objects</span>
                  <Badge variant="outline" className="ml-auto">
                    {resources.objects.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-10 space-y-1">
                  {resources.objects.map((object) => (
                    <div
                      key={object.id}
                      className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded cursor-pointer"
                      onClick={() => toggleObject(object.id)}
                    >
                      <Checkbox
                        checked={selectedObjects.has(object.id)}
                        onCheckedChange={() => toggleObject(object.id)}
                      />
                      <span className="text-sm">{object.name}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {object.properties.length} props
                      </Badge>
                    </div>
                  ))}
                  {resources.objects.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No objects found</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Documents */}
              <Collapsible
                open={expandedSections.has('documents')}
                onOpenChange={() => toggleSection('documents')}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded-lg px-2">
                  {expandedSections.has('documents') ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <FileText className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium">Recent Documents</span>
                  <Badge variant="outline" className="ml-auto">
                    {resources.documents.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-10 space-y-1">
                  {resources.documents.slice(0, 10).map((doc) => (
                    <div key={doc.id} className="text-sm py-1 px-2 text-muted-foreground">
                      {doc.name}
                    </div>
                  ))}
                  {resources.documents.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No documents found</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Users */}
              <Collapsible
                open={expandedSections.has('users')}
                onOpenChange={() => toggleSection('users')}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded-lg px-2">
                  {expandedSections.has('users') ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <UserCircle className="h-4 w-4 text-purple-500" />
                  <span className="font-medium">Users</span>
                  <Badge variant="outline" className="ml-auto">
                    {resources.users.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-10 space-y-1">
                  {resources.users.slice(0, 10).map((user) => (
                    <div key={user.id} className="text-sm py-1 px-2 text-muted-foreground">
                      {user.email}
                    </div>
                  ))}
                  {resources.users.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No users found</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* User Groups */}
              <Collapsible
                open={expandedSections.has('userGroups')}
                onOpenChange={() => toggleSection('userGroups')}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded-lg px-2">
                  {expandedSections.has('userGroups') ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Users className="h-4 w-4 text-orange-500" />
                  <span className="font-medium">User Groups</span>
                  <Badge variant="outline" className="ml-auto">
                    {resources.userGroups.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-10 space-y-1">
                  {resources.userGroups.map((group) => (
                    <div key={group.id} className="text-sm py-1 px-2 text-muted-foreground">
                      {group.name}
                    </div>
                  ))}
                  {resources.userGroups.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No user groups found</p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </ScrollArea>

            {/* Selection Summary */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  Selected: {selectedTemplates.size} templates, {selectedObjects.size} objects
                </div>
                <div className="text-sm text-muted-foreground">
                  Tests to generate: {selectedTemplates.size * 2 + selectedObjects.size * 4}
                </div>
              </div>

              <Button
                onClick={handleGeneratePreset}
                disabled={
                  isSaving ||
                  (selectedTemplates.size === 0 && selectedObjects.size === 0) ||
                  !presetName
                }
                className="w-full"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Preset...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generate Preset with {selectedTemplates.size * 2 + selectedObjects.size * 4} Tests
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
