import type { ExtractedMetadata } from '../shared/types';

// Extract metadata from current page
function extractMetadata(): ExtractedMetadata {
  // Title extraction (priority order)
  const title =
    document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
    document.querySelector('title')?.textContent ||
    document.querySelector('h1')?.textContent ||
    document.title ||
    '';

  // Description extraction (priority order)
  const description =
    document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
    document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') ||
    document.querySelector('meta[name="description"]')?.getAttribute('content') ||
    (() => {
      // Fallback: find first paragraph with >100 chars
      const paragraphs = Array.from(document.querySelectorAll('p'));
      const longP = paragraphs.find(p => p.textContent && p.textContent.length > 100);
      return longP?.textContent || '';
    })() ||
    '';

  // Author extraction (priority order)
  const author =
    document.querySelector('meta[name="author"]')?.getAttribute('content') ||
    document.querySelector('meta[property="article:author"]')?.getAttribute('content') ||
    document.querySelector('meta[name="twitter:creator"]')?.getAttribute('content') ||
    '';

  // URL (always current page)
  const url = window.location.href;

  return {
    title: title.trim(),
    description: description.trim(),
    author: author.trim(),
    url: url
  };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'GET_METADATA') {
    const metadata = extractMetadata();
    sendResponse({ success: true, data: metadata });
  }
  return true; // Keep message channel open for async response
});
