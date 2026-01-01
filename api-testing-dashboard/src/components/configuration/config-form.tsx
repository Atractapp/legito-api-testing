'use client';

import { useState } from 'react';
import { Save, Plus, Trash2, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { useTestStore } from '@/store/test-store';
import { cn } from '@/lib/utils';
import type { TestConfiguration } from '@/types';

export function ConfigurationPanel() {
  const { configuration, setConfiguration, saveConfiguration, savedConfigurations, deleteConfiguration, loadConfiguration } =
    useTestStore();
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newConfigName, setNewConfigName] = useState('');

  const handleSave = () => {
    saveConfiguration({
      ...configuration,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCreateNew = () => {
    if (!newConfigName.trim()) return;
    const newConfig: TestConfiguration = {
      ...configuration,
      id: `config-${Date.now()}`,
      name: newConfigName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveConfiguration(newConfig);
    loadConfiguration(newConfig.id);
    setNewConfigName('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Profiles</CardTitle>
          <CardDescription>
            Manage multiple API configurations for different environments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={configuration.id} onValueChange={loadConfiguration}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select configuration" />
              </SelectTrigger>
              <SelectContent>
                {savedConfigurations.map((config) => (
                  <SelectItem key={config.id} value={config.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          config.environment === 'production'
                            ? 'bg-red-500'
                            : config.environment === 'staging'
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        )}
                      />
                      {config.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>

            {configuration.id !== 'default' && (
              <Button
                variant="destructive"
                size="icon"
                onClick={() => {
                  deleteConfiguration(configuration.id);
                  loadConfiguration('default');
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <Separator />

          <div className="flex items-center gap-2">
            <Input
              placeholder="New configuration name"
              value={newConfigName}
              onChange={(e) => setNewConfigName(e.target.value)}
            />
            <Button onClick={handleCreateNew} disabled={!newConfigName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Create New
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="authentication">Authentication</TabsTrigger>
          <TabsTrigger value="test-data">Test Data</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure the basic API settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Configuration Name</Label>
                <Input
                  id="name"
                  value={configuration.name}
                  onChange={(e) => setConfiguration({ name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseUrl">API Base URL</Label>
                <Input
                  id="baseUrl"
                  placeholder="https://api.example.com"
                  value={configuration.baseUrl}
                  onChange={(e) => setConfiguration({ baseUrl: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="environment">Environment</Label>
                <Select
                  value={configuration.environment}
                  onValueChange={(value: TestConfiguration['environment']) =>
                    setConfiguration({ environment: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Development
                      </div>
                    </SelectItem>
                    <SelectItem value="staging">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-yellow-500" />
                        Staging
                      </div>
                    </SelectItem>
                    <SelectItem value="production">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        Production
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="authentication">
          <Card>
            <CardHeader>
              <CardTitle>Legito API Authentication</CardTitle>
              <CardDescription>
                Enter your Legito API credentials. JWT tokens are generated automatically.
                <br />
                <span className="text-xs">Get your keys from: My Account &gt; Settings &gt; Developers &gt; API</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key (Issuer)</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="apiKey"
                      type={showToken ? 'text' : 'password'}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={configuration.apiKey || ''}
                      onChange={(e) => setConfiguration({ apiKey: e.target.value })}
                      className="pr-10 font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Used as the &quot;iss&quot; claim in the JWT token
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="privateKey">Private Key (Secret)</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="privateKey"
                      type={showToken ? 'text' : 'password'}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={configuration.privateKey || ''}
                      onChange={(e) => setConfiguration({ privateKey: e.target.value })}
                      className="pr-10 font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Used to sign the JWT token with HS256 algorithm
                </p>
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

              <div className="space-y-2">
                <Label>Custom Headers (Optional)</Label>
                <Textarea
                  placeholder='{"Content-Type": "application/json"}'
                  value={JSON.stringify(configuration.headers, null, 2)}
                  onChange={(e) => {
                    try {
                      const headers = JSON.parse(e.target.value);
                      setConfiguration({ headers });
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  className="font-mono text-sm"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test-data">
          <Card>
            <CardHeader>
              <CardTitle>Test Data</CardTitle>
              <CardDescription>Configure test record IDs and data sources</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Template IDs</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {configuration.templateIds.map((id, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {id}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() =>
                          setConfiguration({
                            templateIds: configuration.templateIds.filter((_, i) => i !== index),
                          })
                        }
                      >
                        x
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter template ID"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        if (input.value.trim()) {
                          setConfiguration({
                            templateIds: [...configuration.templateIds, input.value.trim()],
                          });
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      const input = (e.target as HTMLElement)
                        .previousElementSibling as HTMLInputElement;
                      if (input?.value.trim()) {
                        setConfiguration({
                          templateIds: [...configuration.templateIds, input.value.trim()],
                        });
                        input.value = '';
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Document IDs</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {configuration.documentIds.map((id, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {id}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() =>
                          setConfiguration({
                            documentIds: configuration.documentIds.filter((_, i) => i !== index),
                          })
                        }
                      >
                        x
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter document ID"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        if (input.value.trim()) {
                          setConfiguration({
                            documentIds: [...configuration.documentIds, input.value.trim()],
                          });
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      const input = (e.target as HTMLElement)
                        .previousElementSibling as HTMLInputElement;
                      if (input?.value.trim()) {
                        setConfiguration({
                          documentIds: [...configuration.documentIds, input.value.trim()],
                        });
                        input.value = '';
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
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
                  value={configuration.timeout}
                  onChange={(e) => setConfiguration({ timeout: parseInt(e.target.value) || 30000 })}
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
                  value={configuration.retryCount}
                  onChange={(e) => setConfiguration({ retryCount: parseInt(e.target.value) || 0 })}
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
                  checked={configuration.parallelExecution}
                  onCheckedChange={(checked) => setConfiguration({ parallelExecution: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
