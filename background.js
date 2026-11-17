/**
 * IRCTC Tatkal Booking Assistant - Background Service Worker
 * Handles message routing between popup and content scripts,
 * manages extension state, and coordinates booking assistance.
 */

// ── Extension State ──────────────────────────────────────────────────────────
const extensionState = {
  isActive: false,
  currentPage: 'unknown',
  lastError: null,
  assistantRunning: false,
};

// ── Installation Handler ─────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[IRCTC Assistant] Extension installed. Initializing default settings.');

    chrome.storage.local.set({
      settings: {
        isEnabled: true,
        autoFillOnLoad: false,
        showNotifications: true,
      },
      passengers: [],
      groups: [],
      journeyConfig: null,
      activeGroupId: null,
    });
  }
});

// ── Helper: Find IRCTC or Test Tab ───────────────────────────────────────────
/**
 * Find the first open IRCTC tab or local mock test tab.
 * @returns {Promise<chrome.tabs.Tab|null>} The matching tab, or null.
 */
async function findIRCTCTab() {
  try {
    const urls = [
      'https://www.irctc.co.in/*',
      'http://localhost/*',
      'http://127.0.0.1/*',
    ];
    for (const urlPattern of urls) {
      const tabs = await chrome.tabs.query({ url: urlPattern });
      if (tabs.length > 0) {
        // Prefer active tab if it matches
        const active = tabs.find((t) => t.active);
        return active || tabs[0];
      }
    }
    return null;
  } catch (err) {
    console.error('[IRCTC Assistant] Error finding tab:', err);
    return null;
  }
}

/**
 * Send a message to the content script on the active IRCTC or mock tab.
 * @param {Object} message - The message to send.
 * @returns {Promise<*>} The response from the content script.
 */
async function sendToContentScript(message) {
  const tab = await findIRCTCTab();
  if (!tab) {
    throw new Error('No IRCTC or mock test tab found. Please open IRCTC or the test page first.');
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, message);
    return response;
  } catch (err) {
    if (err.message && err.message.includes('Receiving end does not exist')) {
      console.log('[IRCTC Assistant] Content script not connected, auto-injecting into tab:', tab.id);
      try {
        if (chrome.scripting && chrome.scripting.executeScript) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['storage.js', 'utils.js', 'content.js'],
          });
          await new Promise((r) => setTimeout(r, 400));
          return await chrome.tabs.sendMessage(tab.id, message);
        }
      } catch (injErr) {
        console.error('[IRCTC Assistant] Script auto-injection failed:', injErr);
      }
    }
    console.error('[IRCTC Assistant] Error sending message to content script:', err);
    throw new Error('Please refresh your IRCTC tab (press F5) so the assistant can reconnect to the page.');
  }
}

// ── Message Handler ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((err) => sendResponse({ success: false, error: err.message }));

  return true;
});

async function handleMessage(message, sender) {
  const { action, data } = message;

  switch (action) {
    case 'GET_STATUS': {
      let pageState = 'unknown';
      try {
        const response = await sendToContentScript({ action: 'GET_PAGE_STATE' });
        if (response && response.pageState) {
          pageState = response.pageState;
          extensionState.currentPage = pageState;
        }
      } catch (err) {
        // Tab might not be open yet
      }

      return {
        success: true,
        state: {
          ...extensionState,
          currentPage: pageState,
        },
      };
    }

    case 'SELECT_TRAIN': {
      try {
        const response = await sendToContentScript({ action: 'SELECT_TRAIN', data });
        return { success: true, ...response };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    case 'START_AUTOPILOT': {
      extensionState.isActive = true;
      extensionState.assistantRunning = true;
      extensionState.autoPilot = true;
      extensionState.lastError = null;

      try {
        const response = await sendToContentScript({ action: 'START_AUTOPILOT', data });
        return { success: true, ...response };
      } catch (err) {
        extensionState.lastError = err.message;
        return { success: false, error: err.message };
      }
    }

    case 'START_AUTOFILL': {
      extensionState.isActive = true;
      extensionState.assistantRunning = true;
      extensionState.lastError = null;

      try {
        const response = await sendToContentScript({ action: 'START_AUTOFILL', data });
        return { success: true, ...response };
      } catch (err) {
        extensionState.lastError = err.message;
        extensionState.isActive = false;
        extensionState.assistantRunning = false;
        return { success: false, error: err.message };
      }
    }

    case 'STOP_AUTOFILL': {
      extensionState.isActive = false;
      extensionState.assistantRunning = false;

      try {
        const response = await sendToContentScript({ action: 'STOP_AUTOFILL' });
        return { success: true, ...response };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    case 'VALIDATE_FORM': {
      try {
        const response = await sendToContentScript({ action: 'VALIDATE_FORM' });
        return { success: true, ...response };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    case 'GET_PAGE_STATE': {
      try {
        const response = await sendToContentScript({ action: 'GET_PAGE_STATE' });
        if (response && response.pageState) {
          extensionState.currentPage = response.pageState;
        }
        return { success: true, ...response };
      } catch (err) {
        return { success: true, pageState: 'unknown', error: err.message };
      }
    }

    case 'FILL_JOURNEY': {
      try {
        const response = await sendToContentScript({ action: 'FILL_JOURNEY', data });
        return { success: true, ...response };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    case 'FILL_PASSENGERS': {
      try {
        const response = await sendToContentScript({ action: 'FILL_PASSENGERS', data });
        return { success: true, ...response };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    case 'PAGE_STATE_UPDATE': {
      if (data && data.pageState) {
        extensionState.currentPage = data.pageState;
        if (data.pageState === 'payment') {
          extensionState.isActive = false;
          extensionState.assistantRunning = false;
        }
      }
      return { success: true };
    }

    default: {
      return { success: false, error: `Unknown action: ${action}` };
    }
  }
}

// ── Tab Update Listener ──────────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === 'complete' &&
    tab.url &&
    (tab.url.includes('irctc.co.in') || tab.url.includes('localhost') || tab.url.includes('127.0.0.1'))
  ) {
    extensionState.currentPage = 'unknown';
  }
});

console.log('[IRCTC Assistant] Background service worker loaded.');
