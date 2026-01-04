'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Save,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Database,
  Star,
  Loader2,
  Scan,
  ChevronDown,
  ChevronRight,
  FileText,
  Settings2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTestStore } from '@/store/test-store';
import { getTestPresets, saveTestPreset, deleteTestPreset, ensureDefaultPreset } from '@/lib/supabase';
import { scanWorkspace, fetchTemplateElements, type ScanProgress, type ScanCredentials } from '@/lib/workspace-service';
import { generateTestsFromResources } from '@/lib/test-generator-service';
import type { TestPreset, LegitoRegion, WorkspaceResources, TemplateResource, TemplateElement } from '@/types';

const regionOptions: { value: LegitoRegion; label: string; baseUrl: string }[] = [
  { value: 'emea', label: 'EMEA (Europe)', baseUrl: 'https://emea.legito.com/api/v7' },
  { value: 'us', label: 'US (United States)', baseUrl: 'https://us.legito.com/api/v7' },
  { value: 'ca', label: 'CA (Canada)', baseUrl: 'https://ca.legito.com/api/v7' },
  { value: 'apac', label: 'APAC (Asia Pacific)', baseUrl: 'https://apac.legito.com/api/v7' },
  { value: 'quarterly', label: 'Quarterly', baseUrl: 'https://quarterly.legito.com/api/v7' },
];

// Map Legito element types to display labels
const elementTypeLabels: Record<string, string> = {
  TextInput: 'Text',
  Date: 'Date',
  Switcher: 'Switch (Boolean)',
  Question: 'Question (Radio/Single)',
  Select: 'Select (Dropdown)',
  ObjectRecordsSelectbox: 'Object Select',
  ObjectRecordsQuestion: 'Object Question',
  Money: 'Money',
  Counter: 'Counter',
  Calculation: 'Calculation',
  RichText: 'Rich Text',
  Image: 'Image',
};

interface ConfiguredElement {
  id: string;
  name: string;
  type: string;
  uuid: string;
  value: string;
  options?: { uuid: string; label: string }[];
  objectId?: number;
}

const emptyPreset: Omit<TestPreset, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  region: 'emea',
  apiKey: '',
  privateKey: '',
  baseUrl: 'https://emea.legito.com/api/v7',
  timeout: 30000,
  retryCount: 0,
  parallelExecution: false,
  selectedTemplateIds: [],
  selectedObjectIds: [],
  customTests: [],
  isDefault: false,
};

export function PresetManager() {
  const { activePreset, setActivePreset } = useTestStore();
  const [presets, setPresets] = useState<TestPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Partial<TestPreset> | null>(null);

  // Workspace scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [resources, setResources] = useState<WorkspaceResources | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(new Set());
  const [selectedObjects, setSelectedObjects] = useState<Set<number>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['templates']));
  const [templateConfigs, setTemplateConfigs] = useState<Map<number, ConfiguredElement[]>>(new Map());
  const [editingTemplate, setEditingTemplate] = useState<TemplateResource | null>(null);
  const [isLoadingElements, setIsLoadingElements] = useState(false);
  const [fetchedElements, setFetchedElements] = useState<TemplateElement[]>([]);

  const loadPresets = useCallback(async () => {
    setIsLoading(true);
    try {
      await ensureDefaultPreset();
      const loaded = await getTestPresets();
      setPresets(loaded);

      // If no active preset, select default
      if (!activePreset && loaded.length > 0) {
        const defaultPreset = loaded.find(p => p.isDefault) || loaded[0];
        setActivePreset(defaultPreset);
        setEditingPreset(defaultPreset);
      } else if (activePreset) {
        // Refresh active preset from database
        const fresh = loaded.find(p => p.id === activePreset.id);
        if (fresh) {
          setActivePreset(fresh);
          setEditingPreset(fresh);
        }
      }
    } catch (error) {
      console.error('Error loading presets:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activePreset, setActivePreset]);

  useEffect(() => {
    loadPresets();
  }, []);

  const handleSelectPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setActivePreset(preset);
      setEditingPreset(preset);
      setIsCreating(false);
    }
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingPreset({ ...emptyPreset });
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    if (activePreset) {
      setEditingPreset(activePreset);
    }
  };

  const handleSave = async () => {
    if (!editingPreset) return;

    setIsSaving(true);
    try {
      const saved = await saveTestPreset(editingPreset as TestPreset);
      if (saved) {
        await loadPresets();
        setActivePreset(saved);
        setEditingPreset(saved);
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Error saving preset:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (presetId: string) => {
    try {
      await deleteTestPreset(presetId);
      await loadPresets();
      // If we deleted the active preset, select another
      if (activePreset?.id === presetId) {
        const remaining = presets.filter(p => p.id !== presetId);
        if (remaining.length > 0) {
          const defaultPreset = remaining.find(p => p.isDefault) || remaining[0];
          setActivePreset(defaultPreset);
          setEditingPreset(defaultPreset);
        }
      }
    } catch (error) {
      console.error('Error deleting preset:', error);
    }
  };

  const handleSetDefault = async () => {
    if (!editingPreset?.id) return;

    setIsSaving(true);
    try {
      const updated = { ...editingPreset, isDefault: true } as TestPreset;
      await saveTestPreset(updated);
      await loadPresets();
    } catch (error) {
      console.error('Error setting default:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegionChange = (region: LegitoRegion) => {
    const regionOption = regionOptions.find(r => r.value === region);
    if (editingPreset && regionOption) {
      setEditingPreset({
        ...editingPreset,
        region,
        baseUrl: regionOption.baseUrl,
      });
    }
  };

  const updateField = <K extends keyof TestPreset>(field: K, value: TestPreset[K]) => {
    if (editingPreset) {
      setEditingPreset({ ...editingPreset, [field]: value });
    }
  };

  // Workspace scanning functions
  const handleScan = useCallback(async () => {
    if (!editingPreset?.apiKey || !editingPreset?.privateKey || !editingPreset?.baseUrl) return;

    setIsScanning(true);
    setScanError(null);
    setResources(null);
    setSelectedTemplates(new Set());
    setSelectedObjects(new Set());
    setTemplateConfigs(new Map());

    try {
      const result = await scanWorkspace(
        {
          apiKey: editingPreset.apiKey,
          privateKey: editingPreset.privateKey,
          baseUrl: editingPreset.baseUrl,
          region: editingPreset.region || 'emea',
        },
        setScanProgress
      );
      setResources(result);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Failed to scan workspace');
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  }, [editingPreset?.apiKey, editingPreset?.privateKey, editingPreset?.baseUrl, editingPreset?.region]);

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

  const getTemplateElements = (templateId: number): ConfiguredElement[] => {
    return templateConfigs.get(templateId) || [];
  };

  const addElement = (templateId: number) => {
    const uuid = crypto.randomUUID();
    const newElement: ConfiguredElement = {
      id: uuid,
      name: '',
      type: 'TextInput',
      uuid: uuid,
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

  const getProgressPercent = () => {
    if (!scanProgress) return 0;
    return Math.round((scanProgress.current / scanProgress.total) * 100);
  };

  // Open element editor and fetch elements from API
  const openElementEditor = async (template: TemplateResource) => {
    setEditingTemplate(template);
    setFetchedElements([]);

    if (!editingPreset?.apiKey || !editingPreset?.privateKey || !editingPreset?.baseUrl) {
      return;
    }

    setIsLoadingElements(true);
    try {
      const credentials: ScanCredentials = {
        apiKey: editingPreset.apiKey,
        privateKey: editingPreset.privateKey,
        baseUrl: editingPreset.baseUrl,
        region: editingPreset.region || 'emea',
      };
      const elements = await fetchTemplateElements(credentials, template.id);
      setFetchedElements(elements);

      // Initialize config from fetched elements if not already configured
      const existingConfig = templateConfigs.get(template.id) || [];
      if (existingConfig.length === 0 && elements.length > 0) {
        const initialConfig: ConfiguredElement[] = elements.map(el => ({
          id: el.uuid,
          name: el.name,
          type: el.type,
          uuid: el.uuid,
          value: '',
          options: el.options,
          objectId: el.objectId,
        }));
        setTemplateConfigs(prev => {
          const next = new Map(prev);
          next.set(template.id, initialConfig);
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to fetch template elements:', error);
    } finally {
      setIsLoadingElements(false);
    }
  };

  const applyScannedResources = () => {
    if (!resources || !editingPreset) return;

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

    // Update the editing preset with generated tests
    setEditingPreset({
      ...editingPreset,
      selectedTemplateIds: Array.from(selectedTemplates).map(String),
      selectedObjectIds: Array.from(selectedObjects).map(String),
      customTests: generatedTests,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preset Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Test Presets
              </CardTitle>
              <CardDescription>
                Manage API configurations stored in Supabase
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadPresets}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Select
              value={isCreating ? '' : (editingPreset?.id || '')}
              onValueChange={handleSelectPreset}
              disabled={isCreating}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    <div className="flex items-center gap-2">
                      {preset.isDefault && <Star className="h-3 w-3 text-yellow-500" />}
                      <span>{preset.name}</span>
                      <Badge variant="outline" className="text-xs ml-2">
                        {preset.region.toUpperCase()}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={handleCreateNew} disabled={isCreating}>
              <Plus className="h-4 w-4 mr-2" />
              New Preset
            </Button>
          </div>

          {isCreating && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <Plus className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-700 dark:text-blue-300">Creating new preset</span>
              <Button variant="ghost" size="sm" onClick={handleCancelCreate} className="ml-auto">
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preset Editor */}
      {editingPreset && (
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="authentication">Auth</TabsTrigger>
            <TabsTrigger value="workspace">Workspace</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Configure preset name, region, and description</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Preset Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Production EMEA"
                    value={editingPreset.name || ''}
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Optional description"
                    value={editingPreset.description || ''}
                    onChange={(e) => updateField('description', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Select
                    value={editingPreset.region || 'emea'}
                    onValueChange={(value) => handleRegionChange(value as LegitoRegion)}
                  >
                    <SelectTrigger>
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
                  <Label htmlFor="baseUrl">API Base URL</Label>
                  <Input
                    id="baseUrl"
                    value={editingPreset.baseUrl || ''}
                    onChange={(e) => updateField('baseUrl', e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-populated based on region selection
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="authentication">
            <Card>
              <CardHeader>
                <CardTitle>API Credentials</CardTitle>
                <CardDescription>
                  Enter your Legito API credentials
                  <br />
                  <span className="text-xs">Get your keys from: My Account → Settings → Developers → API</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key (Issuer) *</Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showSecrets ? 'text' : 'password'}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={editingPreset.apiKey || ''}
                      onChange={(e) => updateField('apiKey', e.target.value)}
                      className="pr-10 font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowSecrets(!showSecrets)}
                    >
                      {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="privateKey">Private Key (Secret) *</Label>
                  <div className="relative">
                    <Input
                      id="privateKey"
                      type={showSecrets ? 'text' : 'password'}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={editingPreset.privateKey || ''}
                      onChange={(e) => updateField('privateKey', e.target.value)}
                      className="pr-10 font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowSecrets(!showSecrets)}
                    >
                      {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="rounded-lg bg-muted p-4">
                  <h4 className="text-sm font-medium mb-2">How Authentication Works</h4>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>JWT token is generated with your API key as issuer</li>
                    <li>Token is signed using your private key (HS256)</li>
                    <li>Token expires after 1 hour automatically</li>
                    <li>Sent as: Authorization: Bearer &lt;token&gt;</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workspace">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scan className="h-5 w-5" />
                  Workspace Resources
                </CardTitle>
                <CardDescription>
                  Scan your workspace to discover templates and generate custom tests
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Scan Button & Status */}
                {!resources && (
                  <>
                    {isScanning && scanProgress && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Scanning {scanProgress.step}...</span>
                          <span>{getProgressPercent()}%</span>
                        </div>
                        <Progress value={getProgressPercent()} className="h-2" />
                      </div>
                    )}

                    {scanError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Scan Failed</AlertTitle>
                        <AlertDescription>{scanError}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      onClick={handleScan}
                      disabled={!editingPreset.apiKey || !editingPreset.privateKey || isScanning}
                      className="w-full"
                    >
                      {isScanning ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <Scan className="h-4 w-4 mr-2" />
                          Scan Workspace
                        </>
                      )}
                    </Button>

                    {(!editingPreset.apiKey || !editingPreset.privateKey) && (
                      <p className="text-xs text-muted-foreground text-center">
                        Enter API credentials in the Auth tab first
                      </p>
                    )}
                  </>
                )}

                {/* Scan Results */}
                {resources && (
                  <>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">
                        Scanned {new Date(resources.scannedAt).toLocaleTimeString()}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={handleScan} disabled={isScanning}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        Rescan
                      </Button>
                    </div>

                    <ScrollArea className="h-[300px] pr-4 border rounded-lg p-2">
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
                                    {configuredElements.length} el
                                  </Badge>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openElementEditor(template)}
                                  className="h-7 px-2"
                                >
                                  <Settings2 className="h-3.5 w-3.5" />
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
                          <span className="font-medium">Objects</span>
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
                    </ScrollArea>

                    {/* Selection Summary */}
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                        <span>Selected: {selectedTemplates.size} templates, {selectedObjects.size} objects</span>
                        <span>Tests: ~{selectedTemplates.size * 2 + selectedObjects.size * 4}</span>
                      </div>

                      <Button
                        onClick={applyScannedResources}
                        disabled={selectedTemplates.size === 0 && selectedObjects.size === 0}
                        className="w-full"
                        variant="secondary"
                      >
                        Apply Selection ({selectedTemplates.size * 2 + selectedObjects.size * 4} tests)
                      </Button>
                    </div>
                  </>
                )}

                {/* Show generated tests count */}
                {editingPreset.customTests && editingPreset.customTests.length > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {editingPreset.customTests.length} custom tests configured for this preset
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced">
            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>Configure timeouts, retries, and execution options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="timeout">Request Timeout (ms)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min={1000}
                    max={120000}
                    step={1000}
                    value={editingPreset.timeout || 30000}
                    onChange={(e) => updateField('timeout', parseInt(e.target.value) || 30000)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum time to wait for API responses (1-120 seconds)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retryCount">Retry Count</Label>
                  <Input
                    id="retryCount"
                    type="number"
                    min={0}
                    max={5}
                    value={editingPreset.retryCount || 0}
                    onChange={(e) => updateField('retryCount', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of times to retry failed requests (0-5)
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Parallel Execution</Label>
                    <p className="text-xs text-muted-foreground">
                      Run multiple tests simultaneously
                    </p>
                  </div>
                  <Switch
                    checked={editingPreset.parallelExecution || false}
                    onCheckedChange={(checked) => updateField('parallelExecution', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {!isCreating && editingPreset.id && !editingPreset.isDefault && (
                    <Button variant="outline" onClick={handleSetDefault} disabled={isSaving}>
                      <Star className="h-4 w-4 mr-2" />
                      Set as Default
                    </Button>
                  )}
                  {editingPreset.isDefault && (
                    <Badge variant="secondary" className="gap-1">
                      <Star className="h-3 w-3" />
                      Default Preset
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isCreating && editingPreset.id && !editingPreset.isDefault && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Preset?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{editingPreset.name}". This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(editingPreset.id!)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Button onClick={handleSave} disabled={isSaving || !editingPreset.name || !editingPreset.apiKey || !editingPreset.privateKey}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {isCreating ? 'Create Preset' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </Tabs>
      )}

      {/* Element Editor Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Elements: {editingTemplate?.name || `Template ${editingTemplate?.id}`}</DialogTitle>
            <DialogDescription>
              {isLoadingElements
                ? 'Loading elements from API...'
                : fetchedElements.length > 0
                  ? `Found ${fetchedElements.length} elements. Set test values for each.`
                  : 'No existing documents found. Elements must be configured manually.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isLoadingElements ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {editingTemplate && getTemplateElements(editingTemplate.id).map((element) => (
                  <div key={element.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{element.name}</code>
                        <Badge variant="outline" className="text-xs">
                          {elementTypeLabels[element.type] || element.type}
                        </Badge>
                      </div>
                    </div>

                    {/* Value input based on element type */}
                    <div className="pt-1">
                      {(element.type === 'Question' || element.type === 'Select') && element.options && element.options.length > 0 ? (
                        <Select
                          value={element.value}
                          onValueChange={(value) => updateElement(editingTemplate.id, element.id, 'value', value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select an option..." />
                          </SelectTrigger>
                          <SelectContent>
                            {element.options.map((opt) => (
                              <SelectItem key={opt.uuid} value={opt.uuid}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : element.type === 'Switcher' ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={element.value === 'true'}
                            onCheckedChange={(checked) =>
                              updateElement(editingTemplate.id, element.id, 'value', String(checked))
                            }
                          />
                          <span className="text-sm text-muted-foreground">
                            {element.value === 'true' ? 'Yes' : 'No'}
                          </span>
                        </div>
                      ) : element.type === 'Date' ? (
                        <Input
                          type="date"
                          value={element.value}
                          onChange={(e) => updateElement(editingTemplate.id, element.id, 'value', e.target.value)}
                        />
                      ) : element.type === 'Money' ? (
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Amount"
                            value={element.value}
                            onChange={(e) => updateElement(editingTemplate.id, element.id, 'value', e.target.value)}
                            className="flex-1"
                          />
                          <Select defaultValue="USD">
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                              <SelectItem value="GBP">GBP</SelectItem>
                              <SelectItem value="CZK">CZK</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <Input
                          placeholder={`Enter ${element.type === 'TextInput' ? 'text' : 'value'}...`}
                          value={element.value}
                          onChange={(e) => updateElement(editingTemplate.id, element.id, 'value', e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                ))}

                {editingTemplate && getTemplateElements(editingTemplate.id).length === 0 && !isLoadingElements && (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No elements found.</p>
                    <p className="text-sm">Create a document from this template first to detect elements.</p>
                  </div>
                )}
              </>
            )}
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
