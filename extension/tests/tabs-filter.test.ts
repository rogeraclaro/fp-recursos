import { describe, it, expect } from 'vitest';
import type { TabItem } from '../shared/types';
import { filterTabsByGroup, hasGroups } from '../popup/tabsUtils';

// Pure filter functions — extracted from popup logic, tested here in isolation.

const makeTabs = (): TabItem[] => [
  { id: 1, title: 'Work A', url: 'https://work.example.com', favIconUrl: '', groupId: 10, groupColor: 'blue', groupTitle: 'Work', alreadySaved: false },
  { id: 2, title: 'Work B', url: 'https://work2.example.com', favIconUrl: '', groupId: 10, groupColor: 'blue', groupTitle: 'Work', alreadySaved: false },
  { id: 3, title: 'Research', url: 'https://research.example.com', favIconUrl: '', groupId: 20, groupColor: 'green', groupTitle: 'Research', alreadySaved: false },
  { id: 4, title: 'Ungrouped', url: 'https://other.example.com', favIconUrl: '', groupId: -1, alreadySaved: false },
];

describe('filterTabsByGroup', () => {
  it('returns all tabs for filter=all', () => {
    expect(filterTabsByGroup(makeTabs(), 'all')).toHaveLength(4);
  });

  it('returns only ungrouped tabs for filter=ungrouped', () => {
    const result = filterTabsByGroup(makeTabs(), 'ungrouped');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(4);
  });

  it('returns only tabs matching a specific groupId', () => {
    const result = filterTabsByGroup(makeTabs(), 10);
    expect(result).toHaveLength(2);
    expect(result.every(t => t.groupId === 10)).toBe(true);
  });
});

describe('hasGroups', () => {
  it('returns true when at least one tab has a groupId !== -1', () => {
    expect(hasGroups(makeTabs())).toBe(true);
  });

  it('returns false when all tabs are ungrouped', () => {
    const all = makeTabs().map(t => ({ ...t, groupId: -1 }));
    expect(hasGroups(all)).toBe(false);
  });
});
