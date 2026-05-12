import { describe, it, expect } from 'vitest';
import type { TabItem, TabSaveStatus } from '../shared/types';
import type { Bookmark } from '../shared/types';
import { buildTabBookmark, getTabSaveSummary } from '../popup/tabsUtils';

// Save helper functions — live in extension/popup/tabsUtils.ts.

const makeTab = (overrides: Partial<TabItem> = {}): TabItem => ({
  id: 1,
  title: 'Test Page',
  url: 'https://example.com',
  favIconUrl: '',
  groupId: -1,
  alreadySaved: false,
  ...overrides,
});

describe('buildTabBookmark', () => {
  it('produces a Bookmark with id starting with ext_', () => {
    const bm = buildTabBookmark(makeTab());
    expect(bm.id).toMatch(/^ext_/);
  });

  it('sets originalLink to tab.url', () => {
    const bm = buildTabBookmark(makeTab({ url: 'https://test.com' }));
    expect(bm.originalLink).toBe('https://test.com');
  });

  it('sets categories to ["Altres"] when empty', () => {
    // buildTabBookmark doesn't know categories yet — default fallback
    const bm = buildTabBookmark(makeTab());
    expect(bm.categories).toEqual(['Altres']);
  });

  it('sets createdAt as a number', () => {
    const bm = buildTabBookmark(makeTab());
    expect(typeof bm.createdAt).toBe('number');
  });
});

describe('getTabSaveSummary', () => {
  it('counts saved and failed correctly', () => {
    const statuses = new Map<number, TabSaveStatus>([
      [1, 'saved'],
      [2, 'saved'],
      [3, 'failed'],
      [4, 'saving'],
    ]);
    const { saved, failed } = getTabSaveSummary(statuses);
    expect(saved).toBe(2);
    expect(failed).toBe(1);
  });

  it('returns zeros for empty map', () => {
    const { saved, failed } = getTabSaveSummary(new Map());
    expect(saved).toBe(0);
    expect(failed).toBe(0);
  });
});
