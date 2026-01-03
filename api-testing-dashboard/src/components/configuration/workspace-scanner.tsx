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
  AlertCircle,
  RefreshCw,
  Wand2,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Settings2,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTestStore } from '@/store/test-store';
import { scanWorkspace, type ScanProgress } from '@/lib/workspace-service';
import { generateTestsFromResources } from '@/lib/test-generator-service';
import { saveTestPreset } from '@/lib/supabase';
import type { WorkspaceResources, LegitoRegion, TestPreset, TemplateResource, TemplateElement } from '@/types';

const regionOptions: { value: LegitoRegion; label: string; baseUrl: string }[] = [
  { value: 'emea', label: 'EMEA (Europe)', baseUrl: 'https://emea.legito.com/api/v7' },
  { value: 'us', label: 'US (United States)', baseUrl: 'https://us.legito.com/api/v7' },
  { value: 'ca', label: 'CA (Canada)', baseUrl: 'https://ca.legito.com/api/v7' },
  { value: 'apac', label: 'APAC (Asia Pacific)', baseUrl: 'https://apac.legito.com/api/v7' },
  { value: 'quarterly', label: 'Quarterly', baseUrl: 'https://quarterly.legito.com/api/v7' },
];

const elementTypes = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean (Switch)' },
  { value: 'select', label: 'Select (Option UUID)' },
  { value: 'money', label: 'Money (Amount + Currency)' },
];

interface ConfiguredElement {
  id: string;
  name: string;
  type: string;
  value: string;
}

interface TemplateConfig {
  templateId: number;
  elements: ConfiguredElement[];
}

export function WorkspaceScanner() {
  const { setActivePreset } = useTestStore();

  // Credentials form
  const [apiKey, setApiKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [region, setRegion] = useState<LegitoRegion>('emea');
  const [presetName, setPresetName] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);

  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [resources, setResources] = useState<WorkspaceResources | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Selection state
  const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(new Set());
  const [selectedObjects, setSelectedObjects] = useState<Set<number>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['templates']));

  // Element configuration
  const [templateConfigs, setTemplateConfigs] = useState<Map<number, ConfiguredElement[]>>(new Map());
  const [editingTemplate, setEditingTemplate] = useState<TemplateResource | null>(null);

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
    setTemplateConfigs(new Map());

    try {
      const result = await scanWorkspace(
        { apiKey, privateKey, baseUrl, region },
        setScanProgress
      );
      setResources(result);

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

  const openElementEditor = (template: TemplateResource) => {
    setEditingTemplate(template);
  };

  const getTemplateElements = (templateId: number): ConfiguredElement[] => {
    return templateConfigs.get(templateId) || [];
  };

  const addElement = (templateId: number) => {
    const newElement: ConfiguredElement = {
      id: crypto.randomUUID(),
      name: '',
      type: 'text',
      value: '',
    };
    setTemplateConfigs(prev => {
      const next = new Map(prev);
      const existing = next.get(templateId) || [];
      next.set(templateId, [...existing, newElement]);
      return next;
    });
  };

  const updateElement = (templateId: number, elementId: string, field: keyof ConfiguredElement, value: string) => {
    setTemplateConfigs(prev => {
      const next = new Map(prev);
      const elements = next.get(templateId) || [];
      const updated = elements.map(el =>
        el.id === elementId ? { ...el, [field]: value } : el
      );
      next.set(templateId, updated);
      return next;
    });
  };

  const removeElement = (templateId: number, elementId: string) => {
    setTemplateConfigs(prev => {
      const next = new Map(prev);
      const elements = next.get(templateId) || [];
      next.set(templateId, elements.filter(el => el.id !== elementId));
      return next;
    });
  };

  const handleGeneratePreset = async () => {
    if (!resources || !presetName) return;

    setIsSaving(true);
    try {
      // Build template resources with configured elements
      const configuredTemplates: TemplateResource[] = resources.templates
        .filter(t => selectedTemplates.has(t.id))
        .map(t => ({
          ...t,
          elements: (templateConfigs.get(t.id) || []).map(el => ({
            id: 0,
            name: el.name,
            type: el.type,
            uuid: el.id,
          })),
        }));

      const configuredResources: WorkspaceResources = {
        ...resources,
        templates: configuredTemplates,
        objects: resources.objects.filter(o => selectedObjects.has(o.id)),
      };

      // Generate tests from selected resources
      const generatedTests = generateTestsFromResources(configuredResources, {
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
        setTemplateConfigs(new Map());
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
              <div className="relative">
                <Input
                  id="scan-apiKey"
                  type={showSecrets ? 'text' : 'password'}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isScanning}
                  className="font-mono text-sm pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowSecrets(!showSecrets)}
                  disabled={isScanning}
                >
                  {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scan-privateKey">Private Key</Label>
              <div className="relative">
                <Input
                  id="scan-privateKey"
                  type={showSecrets ? 'text' : 'password'}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  disabled={isScanning}
                  className="font-mono text-sm pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowSecrets(!showSecrets)}
                  disabled={isScanning}
                >
                  {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
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
                  Select resources and configure elements for document creation tests
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
                  {resources.templates.map((template) => {
                    const configuredElements = getTemplateElements(template.id);
                    return (
                      <div
                        key={template.id}
                        className="flex items-center gap-2 py-2 px-2 hover:bg-muted/50 rounded"
                      >
                        <Checkbox
                          checked={selectedTemplates.has(template.id)}
                          onCheckedChange={() => toggleTemplate(template.id)}
                        />
                        <span className="text-sm flex-1 truncate">{template.name || `Template ${template.id}`}</span>
                        {configuredElements.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {configuredElements.length} elements
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openElementEditor(template)}
                          className="h-7 px-2"
                        >
                          <Settings2 className="h-3.5 w-3.5 mr-1" />
                          Configure
                        </Button>
                      </div>
                    );
                  })}
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
                    </div>
                  ))}
                  {resources.objects.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No objects found</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Documents (info only) */}
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
                  {resources.documents.slice(0, 5).map((doc) => (
                    <div key={doc.id} className="text-sm py-1 px-2 text-muted-foreground truncate">
                      {doc.name}
                    </div>
                  ))}
                  {resources.documents.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No documents found</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Users (info only) */}
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
                  {resources.users.slice(0, 5).map((user) => (
                    <div key={user.id} className="text-sm py-1 px-2 text-muted-foreground">
                      {user.email}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              {/* User Groups (info only) */}
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
                  Tests to generate: ~{selectedTemplates.size * 2 + selectedObjects.size * 4}
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
                    Generate Preset
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Element Editor Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Elements: {editingTemplate?.name || `Template ${editingTemplate?.id}`}</DialogTitle>
            <DialogDescription>
              Add element names and test values for document creation. Element names must match your template exactly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {editingTemplate && getTemplateElements(editingTemplate.id).map((element) => (
              <div key={element.id} className="flex items-start gap-2 p-3 border rounded-lg">
                <div className="flex-1 grid gap-2 md:grid-cols-3">
                  <div>
                    <Label className="text-xs">Element Name</Label>
                    <Input
                      placeholder="e.g., doc-name"
                      value={element.name}
                      onChange={(e) => updateElement(editingTemplate.id, element.id, 'name', e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={element.type}
                      onValueChange={(value) => updateElement(editingTemplate.id, element.id, 'type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {elementTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Test Value</Label>
                    <Input
                      placeholder={
                        element.type === 'date' ? 'YYYY-MM-DD' :
                        element.type === 'boolean' ? 'true/false' :
                        element.type === 'money' ? '1000' :
                        'Value...'
                      }
                      value={element.value}
                      onChange={(e) => updateElement(editingTemplate.id, element.id, 'value', e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeElement(editingTemplate.id, element.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {editingTemplate && getTemplateElements(editingTemplate.id).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No elements configured yet.</p>
                <p className="text-sm">Add elements to test document creation.</p>
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => editingTemplate && addElement(editingTemplate.id)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Element
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
