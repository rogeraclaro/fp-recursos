// Bookmark interface (matches webapp)
export interface Bookmark {
  id: string;
  title: string;
  description: string;
  author: string;
  originalLink: string;
  externalLinks: string[];
  categories: string[];
  createdAt: number;
}

// Metadata extracted from webpage
export interface ExtractedMetadata {
  title: string;
  description: string;
  author: string;
  url: string;
}

// Message types for Chrome messaging
export interface Message {
  type: 'GET_METADATA' | 'SAVE_BOOKMARK' | 'CHECK_DUPLICATE' | 'GET_CATEGORIES' | 'ADD_CATEGORY';
  data?: any;
}

export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// API Response types
export interface APIBookmarksResponse {
  data: Bookmark[];
}

export interface APICategoriesResponse {
  data: string[];
}

export interface APISaveResponse {
  success: boolean;
}

// --- Tabs Feature Types ---

// Chrome tab group colors as returned by chrome.tabGroups API
export type TabGroupColor =
  | 'grey' | 'blue' | 'red' | 'yellow' | 'green'
  | 'pink' | 'purple' | 'cyan' | 'orange';

// Merged tab object: chrome.tabs.Tab + resolved group metadata + duplicate flag
export interface TabItem {
  id: number;            // chrome.tabs.Tab.id — non-null (filtered in loadTabsData)
  title: string;
  url: string;
  favIconUrl: string;    // may be empty; use getFaviconUrl() from popup for display
  groupId: number;       // chrome.tabs.TAB_ID_NONE (-1) if ungrouped
  groupColor?: TabGroupColor;  // from chrome.tabGroups — for colored left border
  groupTitle?: string;         // from chrome.tabGroups — for filter button label
  alreadySaved: boolean; // true = show '✓ saved' badge, not selectable
}

// Per-tab processing state during bulk save
export type TabSaveStatus = 'pending' | 'saving' | 'saved' | 'failed';

// Group summary used for filter buttons
export interface TabGroupInfo {
  id: number;
  title: string;
  color: TabGroupColor;
}
