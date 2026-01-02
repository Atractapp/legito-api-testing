'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Play,
  BarChart3,
  Settings,
  FileText,
  Layers,
  Activity,
  ChevronLeft,
  ChevronRight,
  Tags,
  RefreshCw,
  KeyRound,
  LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useState } from 'react';
import { AppSelector } from './app-selector';
import { getAppFromPath } from '@/lib/apps-config';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const apiTesterNavigation: NavItem[] = [
  { name: 'Test Runner', href: '/', icon: Play },
  { name: 'Results', href: '/results', icon: BarChart3 },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Coverage', href: '/coverage', icon: Layers },
  { name: 'History', href: '/history', icon: Activity },
  { name: 'Configuration', href: '/configuration', icon: Settings },
];

const taggerNavigation: NavItem[] = [
  { name: 'Tag Sync', href: '/tagger', icon: RefreshCw },
  { name: 'Workspaces', href: '/tagger/workspaces', icon: KeyRound },
  { name: 'Settings', href: '/tagger/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const currentApp = getAppFromPath(pathname);

  const navigation =
    currentApp === 'tagger' ? taggerNavigation : apiTesterNavigation;

  const isActiveLink = (href: string) => {
    if (currentApp === 'tagger') {
      if (href === '/tagger') {
        return pathname === '/tagger';
      }
      return pathname.startsWith(href);
    }
    return pathname === href;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col border-r border-border bg-card transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* App Selector */}
        <div className="border-b border-border p-3">
          <AppSelector collapsed={collapsed} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navigation.map((item) => {
            const isActive = isActiveLink(item.href);
            const Icon = item.icon;

            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  collapsed && 'justify-center px-2'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.name}>{linkContent}</div>;
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn('w-full', collapsed ? 'px-2' : 'justify-start')}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
