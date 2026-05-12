import { API_CONFIG, CLAUDE_PROXY_URL } from './config';
import type { Bookmark, APIBookmarksResponse, APICategoriesResponse, APISaveResponse } from './types';

// Generic API request function
async function apiRequest<T>(endpoint: string, method: 'GET' | 'POST', data?: any): Promise<T> {
  const url = `${API_CONFIG.BASE_URL}/${endpoint}`;

  const options: RequestInit = {
    method,
    headers: API_CONFIG.HEADERS,
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return await response.json();
}

// GET all bookmarks (for duplicate check)
export async function getBookmarks(): Promise<Bookmark[]> {
  try {
    const response = await apiRequest<APIBookmarksResponse>('bookmarks', 'GET');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    throw error;
  }
}

// GET categories list
export async function getCategories(): Promise<string[]> {
  try {
    const response = await apiRequest<APICategoriesResponse>('categories', 'GET');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
}

// POST updated categories list (adds new category)
export async function saveCategories(categories: string[]): Promise<void> {
  try {
    await apiRequest<APISaveResponse>('categories', 'POST', { data: categories });
  } catch (error) {
    console.error('Error saving categories:', error);
    throw error;
  }
}

// POST new bookmark (appends to existing bookmarks)
export async function saveBookmark(bookmark: Bookmark): Promise<void> {
  try {
    // First, get all existing bookmarks
    const existingBookmarks = await getBookmarks();

    // Add new bookmark to the array
    const allBookmarks = [...existingBookmarks, bookmark];

    // POST the complete array (backend replaces entire file)
    await apiRequest<APISaveResponse>('bookmarks', 'POST', { data: allBookmarks });
  } catch (error) {
    console.error('Error saving bookmark:', error);
    throw error;
  }
}

// Check if URL is duplicate
export async function isDuplicate(url: string): Promise<boolean> {
  try {
    const bookmarks = await getBookmarks();
    return bookmarks.some(b => b.originalLink === url);
  } catch (error) {
    console.error('Error checking duplicate:', error);
    // If error, allow saving (don't block user)
    return false;
  }
}

// Call local Claude proxy to categorize a webpage.
// Always resolves — never throws. Returns { categories: [] } when proxy is unreachable.
// For tweet URLs the proxy also returns title and description.
export async function callClaudeProxy(data: {
  url: string;
  title: string;
  description: string;
  categories?: string[];
}): Promise<{ categories: string[]; title?: string; description?: string }> {
  try {
    const response = await fetch(`${CLAUDE_PROXY_URL}/categorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(30000) // 30s — tweets need more time
    });
    if (!response.ok) return { categories: [] };
    return await response.json();
  } catch {
    // Proxy unreachable (ECONNREFUSED, timeout) — graceful fallback
    return { categories: [] };
  }
}
