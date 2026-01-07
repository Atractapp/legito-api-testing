import { Activity, Tags, Plug, Sparkles, LucideIcon } from 'lucide-react';

export type AppId = 'api-tester' | 'tagger' | 'mcp' | 'annotator';

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
  'mcp': {
    id: 'mcp',
    name: 'MCP Server',
    icon: Plug,
    description: 'MCP interface for AI assistants',
    basePath: '/mcp',
  },
  'annotator': {
    id: 'annotator',
    name: 'Smart Annotator',
    icon: Sparkles,
    description: 'AI-powered document annotation learning',
    basePath: '/annotator',
  },
};

export const APP_LIST = Object.values(APPS);

export function getAppFromPath(pathname: string): AppId {
  if (pathname.startsWith('/tagger')) {
    return 'tagger';
  }
  if (pathname.startsWith('/mcp')) {
    return 'mcp';
  }
  if (pathname.startsWith('/annotator')) {
    return 'annotator';
  }
  return 'api-tester';
}
