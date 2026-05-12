import type { TabItem, TabSaveStatus, TabGroupColor } from '../shared/types';
import type { Bookmark } from '../shared/types';

// ---- Filter helpers ----

export function filterTabsByGroup(
  tabs: TabItem[],
  filter: 'all' | 'ungrouped' | number
): TabItem[] {
  if (filter === 'all') return tabs;
  if (filter === 'ungrouped') return tabs.filter(t => t.groupId === -1);
  return tabs.filter(t => t.groupId === filter);
}

export function hasGroups(tabs: TabItem[]): boolean {
  return tabs.some(t => t.groupId !== -1);
}

// ---- Selection helpers ----

export function toggleTabSelection(selectedIds: Set<number>, id: number): Set<number> {
  const next = new Set(selectedIds);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export function selectAllVisible(visibleIds: number[], selectedIds: Set<number>): Set<number> {
  return new Set([...selectedIds, ...visibleIds]);
}

export function deselectAllVisible(visibleIds: number[], selectedIds: Set<number>): Set<number> {
  const next = new Set(selectedIds);
  visibleIds.forEach(id => next.delete(id));
  return next;
}

export function getSelectionCount(selectedIds: Set<number>): number {
  return selectedIds.size;
}

// ---- Save helpers ----

export function resolveAuthorFromUrl(url: string): string {
  if (/github\.com/i.test(url)) return 'github';
  if (/twitter\.com|x\.com/i.test(url)) return 'twitter';
  return 'web';
}

export function buildTabBookmark(tab: TabItem): Bookmark {
  return {
    id: `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: tab.title,
    description: '',
    author: resolveAuthorFromUrl(tab.url),
    originalLink: tab.url,
    externalLinks: [],
    categories: ['Altres'], // overwritten with Claude's categories in the save loop
    createdAt: Date.now(),
  };
}

export function getTabSaveSummary(
  statuses: Map<number, TabSaveStatus>
): { saved: number; failed: number } {
  let saved = 0;
  let failed = 0;
  for (const status of statuses.values()) {
    if (status === 'saved') saved++;
    if (status === 'failed') failed++;
  }
  return { saved, failed };
}

// ---- Favicon helper ----

export function getFaviconUrl(pageUrl: string, size = 16): string {
  // Requires "favicon" permission in manifest.json
  // chrome.runtime.id is only available in extension context;
  // in tests this will be undefined — getFaviconUrl is tested only in the extension.
  return `chrome-extension://${
    typeof chrome !== 'undefined' ? chrome.runtime.id : '__runtime_id__'
  }/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
}

// ---- Group color map ----

export const GROUP_COLOR_MAP: Record<TabGroupColor, string> = {
  grey:   'border-l-gray-400',
  blue:   'border-l-blue-500',
  red:    'border-l-red-500',
  yellow: 'border-l-yellow-400',
  green:  'border-l-green-500',
  pink:   'border-l-pink-400',
  purple: 'border-l-purple-500',
  cyan:   'border-l-cyan-400',
  orange: 'border-l-orange-500',
};
