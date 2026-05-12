import { signIn, getCategories, isDuplicate, saveBookmark, getSavedUrls, suggestResource } from '../shared/api'
import type { Message } from '../shared/types'

// --- Auth ---

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  if (message.type === 'AUTH_SIGN_IN') {
    const { email, password } = message.data
    signIn(email, password)
      .then(session => {
        chrome.storage.local.set({ session })
        sendResponse({ success: true, data: session })
      })
      .catch(err => sendResponse({ success: false, error: (err as Error).message }))
    return true
  }

  if (message.type === 'AUTH_SIGN_OUT') {
    chrome.storage.local.remove('session')
    sendResponse({ success: true })
    return false
  }

  if (message.type === 'AUTH_GET_SESSION') {
    chrome.storage.local.get('session').then(({ session }) => {
      sendResponse({ success: true, data: session ?? null })
    })
    return true
  }

  return false
})

// --- Data operations (require JWT) ---

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  if (message.type === 'GET_CATEGORIES') {
    chrome.storage.local.get('session').then(async ({ session }) => {
      if (!session) { sendResponse({ success: false, error: 'No autenticat' }); return }
      try {
        const cats = await getCategories(session.access_token)
        sendResponse({ success: true, data: cats })
      } catch (err: unknown) {
        sendResponse({ success: false, error: (err as Error).message })
      }
    })
    return true
  }

  if (message.type === 'CHECK_DUPLICATE') {
    chrome.storage.local.get('session').then(async ({ session }) => {
      if (!session) { sendResponse({ success: true, data: { isDuplicate: false } }); return }
      try {
        const dup = await isDuplicate(message.data.url, session.access_token)
        sendResponse({ success: true, data: { isDuplicate: dup } })
      } catch {
        sendResponse({ success: true, data: { isDuplicate: false } })
      }
    })
    return true
  }

  if (message.type === 'SAVE_BOOKMARK') {
    chrome.storage.local.get('session').then(async ({ session }) => {
      if (!session) { sendResponse({ success: false, error: 'No autenticat' }); return }
      try {
        const bk = message.data
        await saveBookmark({
          title: bk.title,
          description: bk.description ?? '',
          url: bk.originalLink,
          categories: bk.categories,
          user_id: session.user_id,
        }, session.access_token)
        sendResponse({ success: true })
      } catch (err: unknown) {
        sendResponse({ success: false, error: (err as Error).message })
      }
    })
    return true
  }

  if (message.type === 'GET_SAVED_URLS') {
    chrome.storage.local.get('session').then(async ({ session }) => {
      if (!session) { sendResponse({ success: true, data: [] }); return }
      try {
        const urls = await getSavedUrls(session.access_token)
        sendResponse({ success: true, data: urls })
      } catch {
        sendResponse({ success: true, data: [] })
      }
    })
    return true
  }

  if (message.type === 'SUGGEST_RESOURCE') {
    chrome.storage.local.get('session').then(async ({ session }) => {
      if (!session) { sendResponse({ success: false, error: 'No autenticat' }); return }
      try {
        const result = await suggestResource(message.data.url, message.data.categories, session.access_token)
        sendResponse({ success: true, data: result })
      } catch (err: unknown) {
        sendResponse({ success: false, error: (err as Error).message })
      }
    })
    return true
  }

  return false
})

console.log('FP Recursos service worker loaded')
