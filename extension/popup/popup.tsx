import { useState, useEffect } from 'react';
import type { ExtractedMetadata, Bookmark, TabItem, TabSaveStatus, TabGroupColor, TabGroupInfo } from '../shared/types';
import { UI_STRINGS, ERRORS } from '../shared/config';
import { getBookmarks, getCategories, callClaudeProxy } from '../shared/api';
import { resolveSaveCategories } from './singleSaveUtils';
import {
  filterTabsByGroup,
  hasGroups,
  toggleTabSelection,
  selectAllVisible,
  deselectAllVisible,
  getSelectionCount,
  getFaviconUrl,
  GROUP_COLOR_MAP,
  buildTabBookmark,
  getTabSaveSummary,
  resolveAuthorFromUrl,
} from './tabsUtils';

type ViewState = 'loading' | 'form' | 'duplicate' | 'success' | 'error' | 'tabs' | 'tabs-categorizing' | 'tabs-review' | 'tabs-saving' | 'tabs-summary';
type CatStatus = 'pending' | 'categorizing' | 'done' | 'failed';

export default function Popup() {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [metadata, setMetadata] = useState<ExtractedMetadata | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // Tabs feature state
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [groupFilter, setGroupFilter] = useState<'all' | 'ungrouped' | number>('all');
  const [selectedTabIds, setSelectedTabIds] = useState<Set<number>>(new Set());
  const [tabStatuses, setTabStatuses] = useState<Map<number, TabSaveStatus>>(new Map());
  const [tabSaveResults, setTabSaveResults] = useState<Map<number, { title: string; categories: string[] }>>(new Map());
  const [showConfirm, setShowConfirm] = useState(false);
  // Categorization step state
  const [tabCatStatuses, setTabCatStatuses] = useState<Map<number, CatStatus>>(new Map());
  const [tabReviewCategories, setTabReviewCategories] = useState<Map<number, string[]>>(new Map());
  const [tabReviewMeta, setTabReviewMeta] = useState<Map<number, { title: string; description: string }>>(new Map());

  // Load tabs on mount — restore single-page form if was active
  useEffect(() => {
    chrome.storage.session.get(['singlePageMode', 'formState']).then(({ singlePageMode, formState }) => {
      if (singlePageMode) {
        if (formState) {
          const fs = formState as { title: string; description: string; selectedCategories: string[]; metadata: ExtractedMetadata; categories: string[] };
          setTitle(fs.title);
          setDescription(fs.description);
          setSelectedCategories(fs.selectedCategories);
          setMetadata(fs.metadata);
          setCategories(fs.categories);
          setViewState('form');
        } else {
          loadData();
        }
      } else {
        loadTabsData();
      }
    }).catch(() => loadTabsData());
  }, []);

  // Save form state to session whenever it changes (so it survives tab switches)
  useEffect(() => {
    if (viewState !== 'form' || !metadata) return;
    chrome.storage.session.set({
      formState: { title, description, selectedCategories, metadata, categories }
    });
  }, [title, description, selectedCategories, viewState, metadata, categories]);

  async function loadTabsData() {
    try {
      const allChromeTabs = await chrome.tabs.query({ currentWindow: true });
      const allGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      const groupMap = new Map(allGroups.map(g => [g.id, g]));
      const savedBookmarks = await getBookmarks();
      const savedUrls = new Set(savedBookmarks.map(b => b.originalLink));

      const tabItems: TabItem[] = allChromeTabs
        .filter(t => t.id != null && t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'))
        .map(t => {
          const group = t.groupId !== -1 ? groupMap.get(t.groupId) : undefined;
          return {
            id: t.id!,
            title: t.title || t.url!,
            url: t.url!,
            favIconUrl: t.favIconUrl || '',
            groupId: t.groupId ?? -1,
            groupColor: group?.color as TabGroupColor | undefined,
            groupTitle: group?.title,
            alreadySaved: savedUrls.has(t.url!),
          };
        });

      setTabs(tabItems);

      // Load categories so handleBulkSave can pass them to the proxy
      try {
        const cats = await getCategories();
        if (cats.length > 0) setCategories(cats);
      } catch {
        // Non-fatal — proxy will do best-effort without category list
      }

      setViewState('tabs');
    } catch (err) {
      console.error('Error loading tabs:', err);
      setError(ERRORS.UNKNOWN);
      setViewState('error');
    }
  }

  async function loadData() {
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.id) {
        throw new Error('No active tab');
      }

      // Try to get metadata from content script
      let metadataResponse;
      try {
        metadataResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_METADATA' });
      } catch {
        // Content script not loaded - inject it first
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });
        // Wait a bit for script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        // Try again
        metadataResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_METADATA' });
      }

      if (!metadataResponse || !metadataResponse.success) {
        throw new Error('Failed to extract metadata');
      }

      const extractedMetadata: ExtractedMetadata = metadataResponse.data;
      setMetadata(extractedMetadata);
      setTitle(extractedMetadata.title);
      setDescription(extractedMetadata.description);

      // Check duplicate + fetch categories in parallel (both are fast API calls)
      const [duplicateResponse, categoriesResponse] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'CHECK_DUPLICATE', data: { url: extractedMetadata.url } }),
        chrome.runtime.sendMessage({ type: 'GET_CATEGORIES' }),
      ]);

      if (duplicateResponse.success && duplicateResponse.data.isDuplicate) {
        setViewState('duplicate');
        return;
      }

      const resolvedCats: string[] = categoriesResponse.success ? categoriesResponse.data : ['Altres'];
      setCategories(resolvedCats);

      // Call Claude for AI-suggested categories (never throws — returns { categories: [] } on failure)
      const aiResult = await callClaudeProxy({
        url: extractedMetadata.url,
        title: extractedMetadata.title,
        description: extractedMetadata.description,
        categories: resolvedCats,
      });

      const valid = aiResult.categories.filter(c => resolvedCats.includes(c));
      if (valid.length > 0) {
        setSelectedCategories(valid);
      }
      if (aiResult.title) setTitle(aiResult.title);
      if (aiResult.description) setDescription(aiResult.description);

      setViewState('form');
    } catch (err) {
      console.error('Error loading data:', err);
      setError(ERRORS.UNKNOWN);
      setViewState('error');
    }
  }

  function toggleCategory(category: string) {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  }

  async function handleAddCategory() {
    const trimmedName = newCategoryName.trim();

    if (!trimmedName) {
      setError(ERRORS.CATEGORY_EMPTY);
      return;
    }

    if (categories.includes(trimmedName)) {
      setError(ERRORS.CATEGORY_EXISTS);
      return;
    }

    setIsAddingCategory(true);
    setError('');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ADD_CATEGORY',
        data: { category: trimmedName }
      });

      if (response.success) {
        setCategories(response.data);
        setSelectedCategories(prev => [...prev, trimmedName]);
        setNewCategoryName('');
      } else {
        setError(response.error || ERRORS.API_ERROR);
      }
    } catch (err: any) {
      setError(err.message || ERRORS.API_ERROR);
    } finally {
      setIsAddingCategory(false);
    }
  }

  async function handleSave() {
    // Validation
    if (!title.trim()) {
      setError(ERRORS.NO_TITLE);
      return;
    }

    if (title.length > 80) {
      setError(ERRORS.TITLE_TOO_LONG);
      return;
    }

    if (!metadata) {
      setError(ERRORS.UNKNOWN);
      return;
    }

    setViewState('loading');

    try {
      // Check for duplicate
      const duplicateResponse = await chrome.runtime.sendMessage({
        type: 'CHECK_DUPLICATE',
        data: { url: metadata.url }
      });

      if (duplicateResponse.success && duplicateResponse.data.isDuplicate) {
        setViewState('duplicate');
        return;
      }

      const finalCategories = resolveSaveCategories([], categories, selectedCategories);
      const finalTitle = title.trim();
      const finalDescription = description.trim();

      // Create bookmark object
      const bookmark: Bookmark = {
        id: `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: finalTitle,
        description: finalDescription,
        author: metadata.author || resolveAuthorFromUrl(metadata.url),
        originalLink: metadata.url,
        externalLinks: [],
        categories: finalCategories,
        createdAt: Date.now()
      };

      // Save via background
      const saveResponse = await chrome.runtime.sendMessage({
        type: 'SAVE_BOOKMARK',
        data: bookmark
      });

      if (!saveResponse.success) {
        throw new Error(saveResponse.error || ERRORS.API_ERROR);
      }

      chrome.storage.session.remove(['singlePageMode', 'formState']);
      setViewState('success');

      // Auto-close after 1 second
      setTimeout(() => {
        window.close();
      }, 1000);

    } catch (err: any) {
      console.error('Error saving bookmark:', err);
      setError(err.message || ERRORS.API_ERROR);
      setViewState('error');
    }
  }

  function handleCancel() {
    chrome.storage.session.remove(['singlePageMode', 'formState']);
    window.close();
  }

  function handleRetry() {
    setError('');
    setViewState('form');
  }

  async function handleBulkCategorize() {
    const tabsToProcess = tabs.filter(t => selectedTabIds.has(t.id));

    const initCat = new Map<number, CatStatus>(tabsToProcess.map(t => [t.id, 'pending']));
    setTabCatStatuses(initCat);
    setViewState('tabs-categorizing');

    const reviewCats = new Map<number, string[]>();
    const reviewMeta = new Map<number, { title: string; description: string }>();

    for (const tab of tabsToProcess) {
      setTabCatStatuses(prev => new Map(prev).set(tab.id, 'categorizing'));

      try {
        let tabDescription = '';
        try {
          const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              if (document.querySelector('[data-testid="tweetText"]')) {
                const el = document.querySelector('[data-testid="tweetText"]');
                return (el as HTMLElement | null)?.innerText ?? '';
              }
              const metaDesc = (document.querySelector('meta[name="description"]') as HTMLMetaElement | null)?.content;
              const ogDesc = (document.querySelector('meta[property="og:description"]') as HTMLMetaElement | null)?.content;
              const h1 = (document.querySelector('h1') as HTMLElement | null)?.innerText;
              const firstP = (document.querySelector('article p, main p, p') as HTMLElement | null)?.innerText;
              return [metaDesc, ogDesc, h1, firstP].filter(Boolean).join(' ').slice(0, 500);
            },
          });
          tabDescription = result ?? '';
        } catch { /* not scriptable */ }

        const aiResult = await callClaudeProxy({
          url: tab.url,
          title: tab.title,
          description: tabDescription,
          categories,
        });

        const valid = aiResult.categories.filter(c => categories.includes(c));
        reviewCats.set(tab.id, valid.length > 0 ? valid : ['Altres']);
        reviewMeta.set(tab.id, {
          title: aiResult.title || tab.title,
          description: aiResult.description || '',
        });
        setTabCatStatuses(prev => new Map(prev).set(tab.id, 'done'));
      } catch {
        reviewCats.set(tab.id, ['Altres']);
        reviewMeta.set(tab.id, { title: tab.title, description: '' });
        setTabCatStatuses(prev => new Map(prev).set(tab.id, 'failed'));
      }
    }

    setTabReviewCategories(reviewCats);
    setTabReviewMeta(reviewMeta);
    setViewState('tabs-review');
  }

  async function handleBulkSave(tabIdsToSave?: Set<number>) {
    const idsToProcess = tabIdsToSave ?? selectedTabIds;
    const tabsToProcess = tabs.filter(t => idsToProcess.has(t.id));

    const init = new Map<number, TabSaveStatus>(tabsToProcess.map(t => [t.id, 'pending']));
    setTabStatuses(prev => new Map([...prev, ...init]));
    setViewState('tabs-saving');

    for (const tab of tabsToProcess) {
      setTabStatuses(prev => new Map(prev).set(tab.id, 'saving'));

      try {
        const base = buildTabBookmark(tab);

        const tweetHandleMatch = tab.url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\//i);
        const tweetDisplayMatch = tab.title.match(/^(.+?)\s+on\s+(?:X|Twitter):/i);
        const tweetAuthor = tweetHandleMatch
          ? tweetDisplayMatch
            ? `${tweetDisplayMatch[1]} (@${tweetHandleMatch[1]})`
            : `@${tweetHandleMatch[1]}`
          : null;

        const finalCategories = tabReviewCategories.get(tab.id) ?? ['Altres'];
        const meta = tabReviewMeta.get(tab.id);

        const bookmark = {
          ...base,
          title: meta?.title || base.title,
          description: meta?.description || base.description,
          author: tweetAuthor || base.author,
          categories: finalCategories,
        };

        const saveResp = await chrome.runtime.sendMessage({
          type: 'SAVE_BOOKMARK',
          data: bookmark,
        });

        if (!saveResp.success) throw new Error(saveResp.error || 'Save failed');

        setTabStatuses(prev => new Map(prev).set(tab.id, 'saved'));
        setTabSaveResults(prev => new Map(prev).set(tab.id, {
          title: bookmark.title,
          categories: bookmark.categories,
        }));
      } catch {
        setTabStatuses(prev => new Map(prev).set(tab.id, 'failed'));
      }
    }

    setViewState('tabs-summary');
  }

  // Loading state
  if (viewState === 'loading') {
    return (
      <div className="p-6 text-center">
        <div className="bg-yellow-400 border-2 border-black p-4 mb-4">
          <h1 className="text-xl font-bold uppercase">{UI_STRINGS.TITLE}</h1>
        </div>
        <p className="font-mono text-sm">{UI_STRINGS.LOADING}</p>
      </div>
    );
  }

  // Duplicate warning
  if (viewState === 'duplicate') {
    return (
      <div className="p-6">
        <div className="bg-red-500 border-2 border-black p-4 mb-4 text-white">
          <h1 className="text-xl font-bold uppercase">⚠️ {UI_STRINGS.DUPLICATE_WARNING}</h1>
        </div>
        <p className="font-mono text-sm mb-6">{UI_STRINGS.DUPLICATE_MESSAGE}</p>
        <div className="flex justify-end">
          <button onClick={handleCancel} className="btn-secondary">
            {UI_STRINGS.CLOSE}
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (viewState === 'success') {
    return (
      <div className="p-6">
        <div className="bg-green-400 border-2 border-black p-4 text-black">
          <h1 className="text-xl font-bold uppercase">✅ {UI_STRINGS.SUCCESS}</h1>
        </div>
      </div>
    );
  }

  // Error state
  if (viewState === 'error') {
    return (
      <div className="p-6">
        <div className="bg-red-500 border-2 border-black p-4 mb-4 text-white">
          <h1 className="text-xl font-bold uppercase">❌ Error al guardar</h1>
        </div>
        <p className="font-mono text-sm mb-6">{error}</p>
        <div className="flex justify-end gap-3">
          <button onClick={handleCancel} className="btn-secondary">
            {UI_STRINGS.CLOSE}
          </button>
          <button onClick={handleRetry} className="btn-primary">
            {UI_STRINGS.RETRY}
          </button>
        </div>
      </div>
    );
  }

  // Tabs view
  if (viewState === 'tabs') {
    const visibleTabs = filterTabsByGroup(tabs, groupFilter);
    const selectableTabs = visibleTabs.filter(t => !t.alreadySaved);
    const visibleSelectableIds = selectableTabs.map(t => t.id);
    const allVisibleSelected = visibleSelectableIds.length > 0 &&
      visibleSelectableIds.every(id => selectedTabIds.has(id));
    const groups: TabGroupInfo[] = [...new Map(
      tabs.filter(t => t.groupId !== -1 && t.groupTitle)
        .map(t => [t.groupId, { id: t.groupId, title: t.groupTitle!, color: t.groupColor! }])
    ).values()];
    const totalSelected = getSelectionCount(selectedTabIds);

    return (
      <div className="w-[400px] flex flex-col max-h-[580px]">
        {/* Header */}
        <div className="bg-yellow-400 border-b-2 border-black p-3 flex items-center justify-between flex-shrink-0">
          <h1 className="text-lg font-bold uppercase">🔖 {UI_STRINGS.TABS_HEADING}</h1>
          <button
            className="text-xs underline font-mono hover:no-underline"
            onClick={() => { chrome.storage.session.set({ singlePageMode: true }); loadData(); setViewState('loading'); }}
          >
            {UI_STRINGS.TABS_SAVE_THIS_PAGE}
          </button>
        </div>

        {/* Group filter bar — hidden when no groups */}
        {hasGroups(tabs) && (
          <div className="border-b-2 border-black p-2 flex gap-1 flex-wrap flex-shrink-0 bg-white">
            {(['all', 'ungrouped'] as const).map(f => (
              <button
                key={f}
                onClick={() => setGroupFilter(f)}
                className={`text-xs px-2 py-1 border-2 border-black font-bold ${
                  groupFilter === f ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
                }`}
              >
                {f === 'all' ? UI_STRINGS.TABS_FILTER_ALL : UI_STRINGS.TABS_FILTER_UNGROUPED}
              </button>
            ))}
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setGroupFilter(g.id)}
                className={`text-xs px-2 py-1 border-2 border-black font-bold ${
                  groupFilter === g.id ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
                }`}
              >
                {g.title}
              </button>
            ))}
          </div>
        )}

        {/* Select-all header */}
        <div className="border-b border-gray-300 px-3 py-1 flex items-center gap-2 flex-shrink-0 bg-gray-50">
          <input
            type="checkbox"
            className="checkbox-input"
            checked={allVisibleSelected}
            onChange={() => {
              if (allVisibleSelected) {
                setSelectedTabIds(prev => deselectAllVisible(visibleSelectableIds, prev));
              } else {
                setSelectedTabIds(prev => selectAllVisible(visibleSelectableIds, prev));
              }
            }}
          />
          <span className="text-xs font-bold">
            {allVisibleSelected ? UI_STRINGS.TABS_DESELECT_ALL : UI_STRINGS.TABS_SELECT_ALL}
          </span>
        </div>

        {/* Tab list */}
        <div className="flex-1 overflow-y-auto">
          {visibleTabs.length === 0 ? (
            <p className="p-4 text-center text-sm font-mono text-gray-500">{UI_STRINGS.TABS_EMPTY}</p>
          ) : (
            visibleTabs.map(tab => {
              const borderClass = tab.groupColor ? `border-l-4 ${GROUP_COLOR_MAP[tab.groupColor]}` : '';
              return (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-3 py-2 border-b border-gray-200 ${
                    tab.alreadySaved ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                  } ${borderClass}`}
                >
                  <input
                    type="checkbox"
                    className="checkbox-input flex-shrink-0"
                    checked={selectedTabIds.has(tab.id)}
                    disabled={tab.alreadySaved}
                    onChange={() => {
                      if (!tab.alreadySaved) {
                        setSelectedTabIds(prev => toggleTabSelection(prev, tab.id));
                      }
                    }}
                  />
                  <img
                    src={getFaviconUrl(tab.url)}
                    width={16}
                    height={16}
                    alt=""
                    className="flex-shrink-0"
                    onError={(e) => {
                      // Fallback: letter avatar
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = 'none';
                      const sibling = target.nextSibling as HTMLElement | null;
                      if (sibling) sibling.style.display = 'flex';
                    }}
                  />
                  <span
                    style={{ display: 'none' }}
                    className="w-4 h-4 flex-shrink-0 bg-gray-300 text-xs flex items-center justify-center font-bold"
                  >
                    {(tab.title || '?')[0].toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs truncate">{tab.title}</p>
                    <p className="text-xs text-gray-500 font-mono truncate">{tab.url}</p>
                  </div>
                  {tab.alreadySaved && (
                    <span className="text-xs text-green-700 font-bold flex-shrink-0">
                      {UI_STRINGS.TABS_ALREADY_SAVED_BADGE}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer: save button */}
        <div className="border-t-2 border-black p-3 flex-shrink-0 bg-white">
          {showConfirm ? (
            <div className="space-y-2">
              <p className="text-sm font-bold">{UI_STRINGS.TABS_CONFIRM_TITLE}</p>
              <p className="text-xs font-mono">{UI_STRINGS.TABS_CONFIRM_MESSAGE(totalSelected)}</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowConfirm(false)} className="btn-secondary text-sm">
                  {UI_STRINGS.TABS_CONFIRM_CANCEL}
                </button>
                <button
                  onClick={() => { setShowConfirm(false); handleBulkCategorize(); }}
                  className="btn-primary text-sm"
                >
                  {UI_STRINGS.TABS_CONFIRM_YES}
                </button>
              </div>
            </div>
          ) : (
            <button
              disabled={totalSelected === 0}
              onClick={() => setShowConfirm(true)}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {UI_STRINGS.TABS_SAVE_BUTTON(totalSelected)}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Tabs categorizing — Claude assigns categories, user waits
  if (viewState === 'tabs-categorizing') {
    const catTabs = tabs.filter(t => selectedTabIds.has(t.id));
    return (
      <div className="w-[400px] flex flex-col max-h-[580px]">
        <div className="bg-yellow-400 border-b-2 border-black p-3 flex-shrink-0">
          <h1 className="text-lg font-bold uppercase">🤖 {UI_STRINGS.TABS_CATEGORIZING_HEADING}</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {catTabs.map(tab => {
            const status = tabCatStatuses.get(tab.id) ?? 'pending';
            const icon = status === 'categorizing'
              ? <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              : <span className={`font-bold text-sm flex-shrink-0 ${status === 'done' ? 'text-green-700' : status === 'failed' ? 'text-red-600' : 'text-gray-400'}`}>
                  {status === 'pending' ? '○' : status === 'done' ? '✓' : '✗'}
                </span>;
            return (
              <div key={tab.id} className="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
                {icon}
                <img src={getFaviconUrl(tab.url)} width={16} height={16} alt="" className="flex-shrink-0" />
                <p className="font-bold text-xs truncate flex-1">{tab.title}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Tabs review — user edits AI-suggested categories before saving
  if (viewState === 'tabs-review') {
    const reviewTabs = tabs.filter(t => selectedTabIds.has(t.id));
    return (
      <div className="w-[400px] flex flex-col max-h-[580px]">
        <div className="bg-yellow-400 border-b-2 border-black p-3 flex-shrink-0">
          <h1 className="text-lg font-bold uppercase">🏷️ {UI_STRINGS.TABS_REVIEW_HEADING}</h1>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
          {reviewTabs.map(tab => {
            const tabCats = tabReviewCategories.get(tab.id) ?? [];
            const available = categories.filter(c => !tabCats.includes(c));
            return (
              <div key={tab.id} className="px-3 py-2 space-y-1">
                <div className="flex items-center gap-2">
                  <img src={getFaviconUrl(tab.url)} width={14} height={14} alt="" className="flex-shrink-0" />
                  <p className="font-bold text-xs truncate flex-1">{tab.title}</p>
                  <button
                    title={UI_STRINGS.TABS_REVIEW_OPEN_TAB}
                    className="text-xs text-gray-400 hover:text-black flex-shrink-0 leading-none"
                    onClick={() => chrome.tabs.update(tab.id, { active: true })}
                  >↗</button>
                </div>
                <div className="flex flex-wrap gap-1 items-center">
                  {tabCats.length === 0 && (
                    <span className="text-xs text-gray-400 font-mono">{UI_STRINGS.TABS_REVIEW_NO_CATEGORIES}</span>
                  )}
                  {tabCats.map(cat => (
                    <span key={cat} className="flex items-center gap-1 text-xs font-mono bg-yellow-100 border border-yellow-400 px-1 rounded">
                      {cat}
                      <button
                        className="text-gray-500 hover:text-red-600 font-bold leading-none"
                        onClick={() => setTabReviewCategories(prev => {
                          const next = new Map(prev);
                          next.set(tab.id, (next.get(tab.id) ?? []).filter(c => c !== cat));
                          return next;
                        })}
                      >×</button>
                    </span>
                  ))}
                  {available.length > 0 && (
                    <select
                      className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white"
                      value=""
                      onChange={e => {
                        const val = e.target.value;
                        if (!val) return;
                        setTabReviewCategories(prev => {
                          const next = new Map(prev);
                          next.set(tab.id, [...(next.get(tab.id) ?? []), val]);
                          return next;
                        });
                      }}
                    >
                      <option value="">{UI_STRINGS.TABS_REVIEW_ADD_PLACEHOLDER}</option>
                      {available.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t-2 border-black p-3 flex gap-2 justify-end flex-shrink-0 bg-white">
          <button onClick={() => setViewState('tabs')} className="btn-secondary text-sm">
            {UI_STRINGS.TABS_CONFIRM_CANCEL}
          </button>
          <button onClick={() => handleBulkSave()} className="btn-primary text-sm">
            {UI_STRINGS.TABS_REVIEW_SAVE_BUTTON(reviewTabs.length)}
          </button>
        </div>
      </div>
    );
  }

  // Tabs saving — bulk save in progress
  if (viewState === 'tabs-saving') {
    const savingTabs = tabs.filter(t => tabStatuses.has(t.id));
    return (
      <div className="w-[400px] flex flex-col max-h-[580px]">
        <div className="bg-yellow-400 border-b-2 border-black p-3 flex-shrink-0">
          <h1 className="text-lg font-bold uppercase">⏳ {UI_STRINGS.TABS_SAVING_HEADING}</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {savingTabs.map(tab => {
            const status = tabStatuses.get(tab.id) ?? 'pending';
            const statusColor =
              status === 'saved'  ? 'text-green-700' :
              status === 'failed' ? 'text-red-600'   :
              status === 'saving' ? 'text-blue-600'  :
                                     'text-gray-400';
            const statusIcon = status === 'saving'
              ? <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              : <span className={`font-bold text-sm flex-shrink-0 ${statusColor}`}>
                  {status === 'pending' ? '○' : status === 'saved' ? '✓' : '✗'}
                </span>;
            return (
              <div key={tab.id} className="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
                {statusIcon}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs truncate">{tab.title}</p>
                  <p className="text-xs text-gray-500 font-mono truncate">{tab.url}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Tabs summary — all done
  if (viewState === 'tabs-summary') {
    const { saved, failed } = getTabSaveSummary(tabStatuses);
    const savedTabs = tabs.filter(t => tabStatuses.get(t.id) === 'saved');
    const failedTabs = tabs.filter(t => tabStatuses.get(t.id) === 'failed');
    const failedIds = new Set(failedTabs.map(t => t.id));

    return (
      <div className="w-[400px] flex flex-col max-h-[580px]">
        <div className="bg-yellow-400 border-b-2 border-black p-3 flex-shrink-0">
          <h1 className="text-lg font-bold uppercase">🔖 {UI_STRINGS.TABS_SUMMARY_HEADING}</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Saved list with categories */}
          {savedTabs.length > 0 && (
            <div className="p-3 space-y-2">
              <p className="font-bold text-xs text-green-700 uppercase">{UI_STRINGS.TABS_SUMMARY_SAVED(saved)}</p>
              {savedTabs.map(t => {
                const result = tabSaveResults.get(t.id);
                return (
                  <div key={t.id} className="border border-gray-200 rounded p-2 space-y-1">
                    <p className="font-bold text-xs truncate">{result?.title || t.title}</p>
                    <div className="flex flex-wrap gap-1">
                      {(result?.categories ?? []).map(cat => (
                        <span key={cat} className="text-xs font-mono bg-yellow-100 border border-yellow-400 px-1 rounded">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Failed list */}
          {failedTabs.length > 0 && (
            <div className="px-3 pb-3 space-y-1">
              <p className="font-bold text-xs text-red-600 uppercase">{UI_STRINGS.TABS_SUMMARY_FAILED(failed)}</p>
              {failedTabs.map(t => (
                <p key={t.id} className="text-xs font-mono text-red-700 truncate">{t.url}</p>
              ))}
            </div>
          )}
        </div>
        <div className="border-t-2 border-black p-3 flex gap-2 justify-end flex-shrink-0">
          {failed > 0 && (
            <button
              onClick={() => handleBulkSave(failedIds)}
              className="btn-secondary text-sm"
            >
              {UI_STRINGS.TABS_RETRY_FAILED(failed)}
            </button>
          )}
          <button
            onClick={() => window.close()}
            className="btn-primary text-sm"
          >
            {UI_STRINGS.TABS_CLOSE}
          </button>
        </div>
      </div>
    );
  }

  // Form view
  return (
    <div className="w-[400px]">
      {/* Header */}
      <div className="bg-yellow-400 border-b-2 border-black p-4">
        <h1 className="text-xl font-bold uppercase">🔖 {UI_STRINGS.TITLE}</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Title */}
        <div>
          <label className="block font-bold text-sm mb-1">📄 {UI_STRINGS.LABEL_TITLE}</label>
          <input
            type="text"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block font-bold text-sm mb-1">📝 {UI_STRINGS.LABEL_DESCRIPTION}</label>
          <textarea
            className="textarea"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Author (read-only) */}
        <div>
          <label className="block font-bold text-sm mb-1">👤 {UI_STRINGS.LABEL_AUTHOR}</label>
          <p className="text-gray-500 text-sm font-mono">{metadata?.author || (metadata?.url ? resolveAuthorFromUrl(metadata.url) : 'web')}</p>
        </div>

        {/* URL (read-only, truncated) */}
        <div>
          <label className="block font-bold text-sm mb-1">🔗 {UI_STRINGS.LABEL_URL}</label>
          <p className="text-gray-500 text-xs font-mono truncate">{metadata?.url}</p>
        </div>

        {/* Categories */}
        <div>
          <label className="block font-bold text-sm mb-2">🏷️ {UI_STRINGS.LABEL_CATEGORIES}</label>
          <div className="border-2 border-black p-3 bg-gray-50 max-h-40 overflow-y-auto">
            <div className="grid grid-cols-2 gap-1">
              {categories.map(cat => (
                <label key={cat} className="checkbox-label">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={selectedCategories.includes(cat)}
                    onChange={() => toggleCategory(cat)}
                  />
                  <span>{cat}</span>
                </label>
              ))}
            </div>
            {/* Add new category */}
            <div className="flex gap-2 mt-2 pt-2 border-t border-gray-300">
              <input
                type="text"
                className="input flex-1 text-sm"
                placeholder={UI_STRINGS.NEW_CATEGORY_PLACEHOLDER}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                disabled={isAddingCategory}
              />
              <button
                onClick={handleAddCategory}
                disabled={isAddingCategory}
                className="btn-secondary text-sm px-3"
              >
                {isAddingCategory ? '...' : UI_STRINGS.ADD_CATEGORY}
              </button>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-100 border-2 border-red-500 p-2 text-red-700 text-sm font-mono">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-between gap-3 pt-2 border-t-2 border-black">
          <button onClick={handleCancel} className="btn-secondary">
            {UI_STRINGS.CANCEL}
          </button>
          <button onClick={handleSave} className="btn-primary">
            ✓ {UI_STRINGS.SAVE}
          </button>
        </div>
      </div>
    </div>
  );
}
