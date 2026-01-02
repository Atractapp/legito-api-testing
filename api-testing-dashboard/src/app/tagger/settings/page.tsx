'use client';

import { Settings, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTaggerStore, useTaggerSettings } from '@/store/tagger-store';
import type { DuplicateMatchStrategy } from '@/types/tagger';

export default function TaggerSettingsPage() {
  const settings = useTaggerSettings();
  const { updateSettings, reset } = useTaggerStore();

  const handleStrategyChange = (value: string) => {
    updateSettings({ duplicateStrategy: value as DuplicateMatchStrategy });
  };

  const handleConcurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 10) {
      updateSettings({ concurrency: value });
    }
  };

  const handleDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0 && value <= 5000) {
      updateSettings({ delayMs: value });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure tag synchronization behavior
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Sync Settings</h3>
            <p className="text-sm text-muted-foreground">
              Configure how tags are matched and copied
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="duplicate-strategy">Duplicate Detection Strategy</Label>
            <Select
              value={settings.duplicateStrategy}
              onValueChange={handleStrategyChange}
            >
              <SelectTrigger id="duplicate-strategy" className="w-full">
                <SelectValue placeholder="Select strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-exact">
                  Exact Match (case-sensitive)
                </SelectItem>
                <SelectItem value="name-case-insensitive">
                  Case Insensitive (recommended)
                </SelectItem>
                <SelectItem value="name-normalized">
                  Normalized (trim + lowercase)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Determines how existing tags in the target workspace are matched
              against source tags
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="concurrency">Concurrency</Label>
              <Input
                id="concurrency"
                type="number"
                min={1}
                max={10}
                value={settings.concurrency}
                onChange={handleConcurrencyChange}
              />
              <p className="text-xs text-muted-foreground">
                Number of tags to create simultaneously (1-10)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delay">Delay Between Batches (ms)</Label>
              <Input
                id="delay"
                type="number"
                min={0}
                max={5000}
                step={50}
                value={settings.delayMs}
                onChange={handleDelayChange}
              />
              <p className="text-xs text-muted-foreground">
                Milliseconds to wait between batches (0-5000)
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-red-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-red-500">Reset All Data</h3>
            <p className="text-sm text-muted-foreground">
              Clear all saved credentials and settings
            </p>
          </div>
          <Button
            variant="outline"
            className="text-red-500 border-red-500/50 hover:bg-red-500/10"
            onClick={() => {
              if (
                confirm(
                  'Are you sure you want to reset all Tagger data? This will clear all saved credentials.'
                )
              ) {
                reset();
              }
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </Card>
    </div>
  );
}
