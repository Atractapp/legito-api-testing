'use client';

import { useState, useMemo } from 'react';
import { Plus, FileText, Database, Users, UsersRound, Share2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  OPERATION_CATALOG,
  getOperationsByCategory,
  type OperationDefinition,
} from '@/lib/operation-catalog';
import type { ApiOperation, ConfiguredTest, WorkspaceResources } from '@/types';

interface AddTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTest: (test: ConfiguredTest) => void;
  existingTests: ConfiguredTest[];
  workspaceResources?: WorkspaceResources;
}

const categoryIcons: Record<string, React.ReactNode> = {
  Documents: <FileText className="h-4 w-4" />,
  Objects: <Database className="h-4 w-4" />,
  Users: <Users className="h-4 w-4" />,
  'User Groups': <UsersRound className="h-4 w-4" />,
  Sharing: <Share2 className="h-4 w-4" />,
  Other: <MoreHorizontal className="h-4 w-4" />,
};

export function AddTestDialog({
  open,
  onOpenChange,
  onAddTest,
  existingTests,
  workspaceResources,
}: AddTestDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Documents');
  const [selectedOperation, setSelectedOperation] = useState<ApiOperation | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedObjectId, setSelectedObjectId] = useState<string>('');
  const [selectedResultFrom, setSelectedResultFrom] = useState<string>('');

  const operationsByCategory = useMemo(() => getOperationsByCategory(), []);
  const categories = Object.keys(operationsByCategory);

  const selectedOpDef = useMemo(
    () => OPERATION_CATALOG.find(op => op.id === selectedOperation),
    [selectedOperation]
  );

  // Get tests that can be used as source for this operation
  const availableSourceTests = useMemo(() => {
    if (!selectedOpDef?.needsResultFrom) return [];

    return existingTests.filter(test =>
      selectedOpDef.needsResultFrom?.includes(test.operation)
    );
  }, [selectedOpDef, existingTests]);

  const handleAdd = () => {
    if (!selectedOperation || !selectedOpDef) return;

    const newTest: ConfiguredTest = {
      id: crypto.randomUUID(),
      name: selectedOpDef.name,
      operation: selectedOperation,
      enabled: true,
      order: existingTests.length,
      config: {},
    };

    // Add template/object selection
    if (selectedTemplateId) {
      const template = workspaceResources?.templates.find(t => t.id === Number(selectedTemplateId));
      newTest.config.templateSuiteId = Number(selectedTemplateId);
      newTest.config.templateName = template?.name;
      newTest.name = `${selectedOpDef.name}: ${template?.name || selectedTemplateId}`;
    }

    if (selectedObjectId) {
      const obj = workspaceResources?.objects.find(o => o.id === Number(selectedObjectId));
      newTest.config.objectId = Number(selectedObjectId);
      newTest.config.objectName = obj?.name;
      newTest.name = `${selectedOpDef.name}: ${obj?.name || selectedObjectId}`;
    }

    // Add source test reference
    if (selectedResultFrom) {
      newTest.config.useResultFrom = selectedResultFrom;
      const sourceTest = existingTests.find(t => t.id === selectedResultFrom);
      if (sourceTest) {
        newTest.name = `${selectedOpDef.name} (from #${existingTests.indexOf(sourceTest) + 1})`;
      }
    }

    onAddTest(newTest);
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setSelectedOperation(null);
    setSelectedTemplateId('');
    setSelectedObjectId('');
    setSelectedResultFrom('');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const canAdd = () => {
    if (!selectedOperation || !selectedOpDef) return false;

    // Check required configs
    if (selectedOpDef.requiresConfig.templateSuiteId && !selectedTemplateId) return false;
    if (selectedOpDef.requiresConfig.objectId && !selectedObjectId) return false;
    if (selectedOpDef.requiresConfig.useResultFrom && !selectedResultFrom) return false;

    return true;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Test Operation
          </DialogTitle>
          <DialogDescription>
            Select an API operation to add to your test suite
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[180px,1fr] gap-4 py-4">
          {/* Category Selection */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground uppercase">Category</Label>
            <div className="space-y-1">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    setSelectedCategory(category);
                    setSelectedOperation(null);
                  }}
                >
                  {categoryIcons[category]}
                  <span className="ml-2">{category}</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    {operationsByCategory[category].length}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Operation Selection */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase">Operation</Label>
            <ScrollArea className="h-[200px] pr-4">
              <RadioGroup
                value={selectedOperation || ''}
                onValueChange={(value) => setSelectedOperation(value as ApiOperation)}
              >
                {operationsByCategory[selectedCategory]?.map((op) => (
                  <div
                    key={op.id}
                    className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedOperation === op.id
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedOperation(op.id)}
                  >
                    <RadioGroupItem value={op.id} id={op.id} className="mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <label
                        htmlFor={op.id}
                        className="text-sm font-medium cursor-pointer flex items-center gap-2"
                      >
                        <Badge
                          variant={op.method === 'GET' ? 'secondary' : op.method === 'POST' ? 'default' : op.method === 'DELETE' ? 'destructive' : 'outline'}
                          className="text-xs"
                        >
                          {op.method}
                        </Badge>
                        {op.name}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {op.description}
                      </p>
                      {op.needsResultFrom && op.needsResultFrom.length > 0 && (
                        <p className="text-xs text-orange-600 dark:text-orange-400">
                          Requires: {op.needsResultFrom.join(' or ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </ScrollArea>

            {/* Configuration Section */}
            {selectedOpDef && (
              <>
                <Separator />
                <div className="space-y-4">
                  <Label className="text-xs text-muted-foreground uppercase">Configuration</Label>

                  {/* Template Selection */}
                  {selectedOpDef.requiresConfig.templateSuiteId && (
                    <div className="space-y-2">
                      <Label htmlFor="template">Template *</Label>
                      <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template..." />
                        </SelectTrigger>
                        <SelectContent>
                          {workspaceResources?.templates.map((template) => (
                            <SelectItem key={template.id} value={String(template.id)}>
                              {template.name || `Template ${template.id}`}
                            </SelectItem>
                          ))}
                          {(!workspaceResources?.templates || workspaceResources.templates.length === 0) && (
                            <SelectItem value="" disabled>
                              No templates found. Scan workspace first.
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Object Selection */}
                  {selectedOpDef.requiresConfig.objectId && (
                    <div className="space-y-2">
                      <Label htmlFor="object">Object *</Label>
                      <Select value={selectedObjectId} onValueChange={setSelectedObjectId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an object..." />
                        </SelectTrigger>
                        <SelectContent>
                          {workspaceResources?.objects.map((obj) => (
                            <SelectItem key={obj.id} value={String(obj.id)}>
                              {obj.name}
                            </SelectItem>
                          ))}
                          {(!workspaceResources?.objects || workspaceResources.objects.length === 0) && (
                            <SelectItem value="" disabled>
                              No objects found. Scan workspace first.
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Source Test Selection (for dependent operations) */}
                  {selectedOpDef.requiresConfig.useResultFrom && (
                    <div className="space-y-2">
                      <Label htmlFor="source">Use Result From *</Label>
                      <Select value={selectedResultFrom} onValueChange={setSelectedResultFrom}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source test..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSourceTests.map((test, index) => (
                            <SelectItem key={test.id} value={test.id}>
                              #{existingTests.indexOf(test) + 1}: {test.name}
                            </SelectItem>
                          ))}
                          {availableSourceTests.length === 0 && (
                            <SelectItem value="" disabled>
                              Add a {selectedOpDef.needsResultFrom?.join(' or ')} test first
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        This operation uses the result from a previous test
                      </p>
                    </div>
                  )}

                  {/* No config needed */}
                  {Object.keys(selectedOpDef.requiresConfig).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No additional configuration required
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!canAdd()}>
            <Plus className="h-4 w-4 mr-2" />
            Add to Suite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
