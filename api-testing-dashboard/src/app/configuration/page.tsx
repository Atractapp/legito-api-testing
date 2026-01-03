'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PresetManager } from '@/components/configuration/preset-manager';
import { WorkspaceScanner } from '@/components/configuration/workspace-scanner';
import { Database, Scan } from 'lucide-react';

export default function ConfigurationPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Configuration</h1>
        <p className="text-muted-foreground">
          Manage test presets, credentials, and workspace scanning
        </p>
      </div>

      <Tabs defaultValue="presets" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="presets" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Test Presets
          </TabsTrigger>
          <TabsTrigger value="workspaces" className="flex items-center gap-2">
            <Scan className="h-4 w-4" />
            Workspace Scanner
          </TabsTrigger>
        </TabsList>

        <TabsContent value="presets">
          <PresetManager />
        </TabsContent>

        <TabsContent value="workspaces">
          <WorkspaceScanner />
        </TabsContent>
      </Tabs>
    </div>
  );
}
