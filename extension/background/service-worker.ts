import { getCategories, saveCategories, saveBookmark, isDuplicate } from '../shared/api';
import type { Bookmark, Message } from '../shared/types';

// Cache categories to reduce API calls
let categoriesCache: string[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get categories with caching
async function getCachedCategories(): Promise<string[]> {
  const now = Date.now();

  if (categoriesCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return categoriesCache;
  }

  try {
    const categories = await getCategories();
    categoriesCache = categories;
    cacheTimestamp = now;
    return categories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    // Return cached data if available, even if expired
    return categoriesCache || ['Altres'];
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {

  if (message.type === 'CHECK_DUPLICATE') {
    // Check if URL already exists
    isDuplicate(message.data.url)
      .then(isDupe => {
        sendResponse({ success: true, data: { isDuplicate: isDupe } });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async
  }

  if (message.type === 'SAVE_BOOKMARK') {
    // The popup already calls Claude and sets categories before sending this message.
    // Save the bookmark as-is — do NOT call Claude again (would overwrite popup's result).
    const bookmark: Bookmark = message.data;
    saveBookmark(bookmark)
      .then(() => {
        categoriesCache = null;
        sendResponse({ success: true });
      })
      .catch((error: Error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async
  }

  if (message.type === 'ADD_CATEGORY') {
    // Add new category to the list
    const newCategory: string = message.data.category;
    getCachedCategories()
      .then(currentCategories => {
        // Check if category already exists
        if (currentCategories.includes(newCategory)) {
          sendResponse({ success: false, error: 'Aquesta categoria ja existeix' });
          return;
        }
        // Add new category and save
        const updatedCategories = [...currentCategories, newCategory];
        return saveCategories(updatedCategories).then(() => {
          // Update cache with new category
          categoriesCache = updatedCategories;
          cacheTimestamp = Date.now();
          sendResponse({ success: true, data: updatedCategories });
        });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async
  }

  return false;
});

// Export function for popup to get categories
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  if (message.type === 'GET_CATEGORIES') {
    getCachedCategories()
      .then(categories => {
        sendResponse({ success: true, data: categories });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  return false;
});

console.log('AI Bookmark Manager service worker loaded');
