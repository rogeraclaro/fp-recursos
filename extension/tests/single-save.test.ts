import { describe, it, expect } from 'vitest';
import { resolveSaveCategories } from '../popup/singleSaveUtils';

describe('resolveSaveCategories', () => {
  it('returns Claude valid categories when they are in the whitelist', () => {
    const result = resolveSaveCategories(
      ['Tech', 'Science'],
      ['Tech', 'Science', 'Art'],
      []
    );
    expect(result).toEqual(['Tech', 'Science']);
  });

  it('falls back to user selection when Claude categories are not in whitelist', () => {
    const result = resolveSaveCategories(
      ['Unknown'],
      ['Tech'],
      ['Art']
    );
    expect(result).toEqual(['Art']);
  });

  it('falls back to user selection when Claude returns empty categories', () => {
    const result = resolveSaveCategories(
      [],
      ['Tech'],
      ['Art']
    );
    expect(result).toEqual(['Art']);
  });

  it('falls back to Altres when Claude invalid and user selected nothing', () => {
    const result = resolveSaveCategories(
      ['Unknown'],
      ['Tech'],
      []
    );
    expect(result).toEqual(['Altres']);
  });

  it('falls back to Altres when everything is empty', () => {
    const result = resolveSaveCategories([], [], []);
    expect(result).toEqual(['Altres']);
  });

  it('only passes Claude categories that are in the whitelist (filters partial match)', () => {
    const result = resolveSaveCategories(
      ['Tech', 'Unknown'],
      ['Tech'],
      ['Art']
    );
    expect(result).toEqual(['Tech']);
  });
});
