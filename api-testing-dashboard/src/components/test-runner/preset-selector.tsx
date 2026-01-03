'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, Database, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getTestPresets, ensureDefaultPreset } from '@/lib/supabase';
import type { TestPreset, LegitoRegion } from '@/types';

interface PresetSelectorProps {
  activePreset: TestPreset | null;
  onPresetChange: (preset: TestPreset) => void;
  disabled?: boolean;
}

const regionLabels: Record<LegitoRegion, string> = {
  emea: 'EMEA',
  us: 'US',
  ca: 'CA',
  apac: 'APAC',
  quarterly: 'Quarterly',
};

export function PresetSelector({ activePreset, onPresetChange, disabled }: PresetSelectorProps) {
  const [presets, setPresets] = useState<TestPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPresets() {
      setIsLoading(true);
      try {
        // Ensure default preset exists with correct credentials
        await ensureDefaultPreset();

        const loaded = await getTestPresets();
        setPresets(loaded);

        // Auto-select default preset if none active
        if (!activePreset && loaded.length > 0) {
          const defaultPreset = loaded.find(p => p.isDefault) || loaded[0];
          onPresetChange(defaultPreset);
        }
      } catch (error) {
        console.error('Error loading presets:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadPresets();
  }, [activePreset, onPresetChange]);

  if (isLoading) {
    return (
      <Button variant="outline" disabled className="w-[240px] justify-between">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading presets...
      </Button>
    );
  }

  if (presets.length === 0) {
    return (
      <Button variant="outline" disabled className="w-[240px] justify-between">
        <Database className="h-4 w-4 mr-2" />
        No presets available
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="w-[280px] justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <Database className="h-4 w-4 shrink-0" />
            <span className="truncate">{activePreset?.name || 'Select preset'}</span>
            {activePreset && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {regionLabels[activePreset.region]}
              </Badge>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        <DropdownMenuLabel>Test Presets</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {presets.map((preset) => (
          <DropdownMenuItem
            key={preset.id}
            onClick={() => onPresetChange(preset)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                preset.isDefault ? "bg-green-500" : "bg-muted-foreground"
              )} />
              <span className="truncate">{preset.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {regionLabels[preset.region]}
              </Badge>
              {activePreset?.id === preset.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
