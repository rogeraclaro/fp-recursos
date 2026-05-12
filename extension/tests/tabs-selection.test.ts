import { describe, it, expect } from 'vitest';
import { toggleTabSelection, selectAllVisible, deselectAllVisible, getSelectionCount } from '../popup/tabsUtils';

// Selection helper functions — live in extension/popup/tabsUtils.ts.

describe('toggleTabSelection', () => {
  it('adds id when not present', () => {
    const result = toggleTabSelection(new Set([1, 2]), 3);
    expect(result.has(3)).toBe(true);
    expect(result.size).toBe(3);
  });

  it('removes id when already present', () => {
    const result = toggleTabSelection(new Set([1, 2, 3]), 2);
    expect(result.has(2)).toBe(false);
    expect(result.size).toBe(2);
  });

  it('returns a new Set (no mutation)', () => {
    const original = new Set([1]);
    const result = toggleTabSelection(original, 2);
    expect(result).not.toBe(original);
  });
});

describe('selectAllVisible', () => {
  it('adds all visible ids to selection', () => {
    const result = selectAllVisible([3, 4], new Set([1, 2]));
    expect([...result]).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    expect(result.size).toBe(4);
  });
});

describe('deselectAllVisible', () => {
  it('removes only visible ids from selection', () => {
    const result = deselectAllVisible([3, 4], new Set([1, 2, 3, 4]));
    expect(result.has(3)).toBe(false);
    expect(result.has(4)).toBe(false);
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(true);
  });
});

describe('getSelectionCount', () => {
  it('returns the size of the set', () => {
    expect(getSelectionCount(new Set([1, 2, 3]))).toBe(3);
    expect(getSelectionCount(new Set())).toBe(0);
  });
});
