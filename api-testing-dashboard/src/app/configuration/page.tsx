'use client';

import { ConfigurationPanel } from '@/components/configuration/config-form';

export default function ConfigurationPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Configuration</h1>
        <p className="text-muted-foreground">
          Manage API configurations, authentication, and test settings
        </p>
      </div>

      <ConfigurationPanel />
    </div>
  );
}
