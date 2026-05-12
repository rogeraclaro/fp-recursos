/**
 * Resolves final save categories using a 3-tier fallback:
 * 1. Claude's categories filtered against the known whitelist (if non-empty)
 * 2. User's selected categories (if non-empty and Claude returned nothing valid)
 * 3. 'Altres' (universal fallback)
 */
export function resolveSaveCategories(
  aiCategories: string[],
  knownCategories: string[],
  selectedCategories: string[]
): string[] {
  const valid = aiCategories.filter(c => knownCategories.includes(c));
  if (valid.length > 0) return valid;
  if (selectedCategories.length > 0) return selectedCategories;
  return ['Altres'];
}
