'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APPS, APP_LIST, getAppFromPath, type AppId } from '@/lib/apps-config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AppSelectorProps {
  collapsed?: boolean;
  className?: string;
}

export function AppSelector({ collapsed = false, className }: AppSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentApp = getAppFromPath(pathname);
  const selectedApp = APPS[currentApp];
  const Icon = selectedApp.icon;

  const handleAppChange = (appId: string) => {
    const app = APPS[appId as AppId];
    if (app) {
      router.push(app.basePath);
    }
  };

  if (collapsed) {
    return (
      <div className={cn('flex justify-center', className)}>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    );
  }

  return (
    <Select value={currentApp} onValueChange={handleAppChange}>
      <SelectTrigger
        className={cn(
          'w-full bg-card/50 border-border/50 hover:bg-accent/50 hover:border-border',
          'transition-all duration-200',
          'focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
          className
        )}
      >
        <SelectValue>
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium">{selectedApp.name}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        className="w-[--radix-select-trigger-width] min-w-[220px]"
      >
        <div className="px-2 py-1.5 border-b border-border/50 mb-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Switch Application
          </p>
        </div>
        {APP_LIST.map((app) => {
          const AppIcon = app.icon;
          const isSelected = app.id === currentApp;
          return (
            <SelectItem
              key={app.id}
              value={app.id}
              className={cn(
                'cursor-pointer py-2.5 px-2 rounded-md',
                'focus:bg-accent',
                isSelected && 'bg-primary/5'
              )}
            >
              <div className="flex items-center gap-3 w-full">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg border',
                    'bg-gradient-to-br',
                    app.id === 'api-tester'
                      ? 'from-blue-500/20 to-cyan-500/20 border-blue-500/20'
                      : 'from-purple-500/20 to-pink-500/20 border-purple-500/20'
                  )}
                >
                  <AppIcon
                    className={cn(
                      'h-4 w-4',
                      app.id === 'api-tester' ? 'text-blue-500' : 'text-purple-500'
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{app.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {app.description}
                  </p>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
