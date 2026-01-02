import { Activity, Tags, LucideIcon } from 'lucide-react';

export type AppId = 'api-tester' | 'tagger';

export interface AppDefinition {
  id: AppId;
  name: string;
  icon: LucideIcon;
  description: string;
  basePath: string;
}

export const APPS: Record<AppId, AppDefinition> = {
  'api-tester': {
    id: 'api-tester',
    name: 'API Tester',
    icon: Activity,
    description: 'Test and debug API endpoints',
    basePath: '/',
  },
  'tagger': {
    id: 'tagger',
    name: 'Tagger',
    icon: Tags,
    description: 'Sync tags between workspaces',
    basePath: '/tagger',
  },
};

export const APP_LIST = Object.values(APPS);

export function getAppFromPath(pathname: string): AppId {
  if (pathname.startsWith('/tagger')) {
    return 'tagger';
  }
  return 'api-tester';
}
