// WhatsApp AI Co-Pilot Background Service Worker
console.log('Background service worker started.');

// --- Backend Interaction ---
// The backend server at http://localhost:3000 is responsible for whatsapp-web.js client management.
// This background script acts as a client to that backend and a message bridge.

let backendGroups = []; // Stores groups fetched from the backend server
let backendClientReady = false; // Status of the backend's WhatsApp client
let lastBackendStatus = { ready: false, message: "Initializing...", qrCodeAvailable: false };
let panelReady = false; // To track if panel is ready to receive proactive updates
let lastChatName = null; // Variable to be removed if CHAT_FOCUS_CHANGED is removed

const BACKEND_URL = 'http://localhost:3000';

/**
 * Fetches the WhatsApp client status from the backend server.
 * Updates local state (`backendClientReady`, `lastBackendStatus`) and proactively
 * sends status updates to ready panel instances.
 * @returns {Promise<object>} The status object from the backend or a default error status.
 */
async function fetchWhatsAppStatusFromBackend() {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/status`);
    if (!response.ok) {
      let errorMsg = `Backend status check failed: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorData.message || errorMsg;
      } catch (e) { /* ignore parsing error */ }
      throw new Error(errorMsg);
    }
    const status = await response.json(); // Expected: { ready: boolean, message: string, qrCodeAvailable: boolean }
    console.log('[BACKGROUND.JS] Fetched status from backend (/auth/status):', status);

    backendClientReady = status.ready || false;
    lastBackendStatus = status;

    // Proactive updates to panel (panel also polls, so these are supplementary)
    if (panelReady) {
      if (status.qrCodeAvailable && !status.ready) {
        sendMessageToAllTabs({ type: 'WHATSAPP_QR_AVAILABLE' }); // Inform panel QR is available for it to fetch
      } else if (status.ready) {
        sendMessageToAllTabs({ type: 'WHATSAPP_CLIENT_READY' }); // Inform panel client is ready for it to fetch groups
      } else {
        sendMessageToAllTabs({ type: 'WHATSAPP_STATUS_UPDATE', status });
      }
    }
    return status;
  } catch (error) {
    console.error('[BACKGROUND.JS] Error fetching WhatsApp status from backend:', error);
    backendClientReady = false;
    lastBackendStatus = { ready: false, message: error.message, qrCodeAvailable: false };
    if (panelReady) {
        sendMessageToAllTabs({ type: 'WHATSAPP_BACKEND_ERROR', error: error.message });
    }
    return lastBackendStatus;
  }
}

/**
 * Fetches the list of WhatsApp groups from the backend server.
 * Caches the groups locally in `backendGroups` and `chrome.storage.local`.
 * Optionally sends a proactive update to the panel (though panel primarily fetches itself).
 * @param {boolean} [proactiveUpdate=false] - Whether to attempt a proactive update to the panel.
 * @returns {Promise<Array<object>>} An array of group objects or an empty array on error/client not ready.
 */
async function fetchGroupsFromBackend(proactiveUpdate = false) {
  if (!backendClientReady) {
    console.warn('[BACKGROUND.JS] Cannot fetch groups, backend client not ready.');
    return [];
  }
  try {
    const response = await fetch(`${BACKEND_URL}/groups`);
    if (!response.ok) {
      let errorMsg = `Backend group list fetch failed: ${response.status}`;
       try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorData.message || errorMsg;
      } catch (e) { /* ignore parsing error */ }
      throw new Error(errorMsg);
    }
    const groups = await response.json(); // Expected: [{ id: string, name: string }]
    console.log(`[BACKGROUND.JS] Fetched ${groups.length} groups from backend.`);
    backendGroups = groups;
    
    chrome.storage.local.set({ 'whatsappGroups': backendGroups }); // Cache for potential quick load

    // Panel.js fetches groups on its own. This proactive update is likely redundant.
    // if (proactiveUpdate && panelReady) {
    //   sendMessageToAllTabs({ type: 'GROUPS_UPDATED', groups: backendGroups });
    // }
    return backendGroups;
  } catch (error) {
    console.error('[BACKGROUND.JS] Error fetching groups from backend:', error);
    if (proactiveUpdate && panelReady) {
        sendMessageToAllTabs({ type: 'WHATSAPP_BACKEND_ERROR', error: `Group fetch error: ${error.message}` });
    }
    return [];
  }
}

/**
 * Starts polling the backend for WhatsApp client status periodically.
 * Calls `fetchWhatsAppStatusFromBackend` immediately and then sets an interval.
 */
function startBackendStatusPolling() {
    fetchWhatsAppStatusFromBackend(); // Initial check
    setInterval(fetchWhatsAppStatusFromBackend, 15000); // Poll every 15 seconds
}

startBackendStatusPolling();

// --- Message Handling ---
let readyTabs = new Set();

/**
 * Sends a message to all active and "ready" WhatsApp Web tabs.
 * "Ready" tabs are those whose content scripts have reported `CONTENT_SCRIPT_READY`.
 * @param {object} message - The message object to send.
 */
function sendMessageToAllTabs(message) {
  chrome.tabs.query({ url: '*://web.whatsapp.com/*' }, (tabs) => {
    if (tabs.length === 0) {
      // console.warn('No WhatsApp Web tabs found to send message:', message.type);
      return;
    }
    tabs.forEach(tab => {
      if (readyTabs.has(tab.id)) {
        chrome.tabs.sendMessage(tab.id, message)
          .catch(err => console.error(`Error sending message type ${message.type} to tab ${tab.id}:`, err.message));
      } else {
        // console.log(`Tab ${tab.id} not ready, not sending ${message.type}`);
      }
    });
  });
}

/**
 * Listener for messages sent from other parts of the extension (content scripts, panel).
 * Handles various message types to coordinate actions, fetch data, or relay information.
 * @param {object} message - The message object received.
 * @param {chrome.runtime.MessageSender} sender - Information about the sender.
 * @param {function} sendResponse - Function to call to send a response back to the sender.
 * @returns {boolean} True if `sendResponse` will be called asynchronously, false otherwise.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[BACKGROUND.JS] Message received:', message.type, 'from sender:', sender.tab ? `tab ${sender.tab.id}`: "extension");

  // Use a switch statement for clarity
  switch (message.type) {
    case 'PANEL_READY':
      panelReady = true;
      console.log('[BACKGROUND.JS] Panel is ready. Last known backend status:', lastBackendStatus);
      // Respond with the last known status. Panel will use this to decide its next steps.
      sendResponse({ 
        success: true, 
        ready: lastBackendStatus.ready, 
        message: lastBackendStatus.message,
        qrCodeAvailable: lastBackendStatus.qrCodeAvailable
      });
      // Proactively send current status to ensure panel updates if it missed polling
      if (lastBackendStatus.qrCodeAvailable && !lastBackendStatus.ready) {
        sendMessageToAllTabs({ type: 'WHATSAPP_QR_AVAILABLE' });
      } else if (lastBackendStatus.ready) {
        sendMessageToAllTabs({ type: 'WHATSAPP_CLIENT_READY' });
      }
      break;

    case 'CONTENT_SCRIPT_READY':
      if (sender.tab && sender.tab.id !== undefined) {
        readyTabs.add(sender.tab.id);
        console.log('[BACKGROUND.JS] Tab', sender.tab.id, 'reported CONTENT_SCRIPT_READY. Total ready tabs:', readyTabs.size);
        // deliverPendingMessagesToTab(sender.tab.id); // If a pending message system exists
      }
      sendResponse({ status: 'ACKNOWLEDGED' });
      break;
    
    default:
      console.log('[BACKGROUND.JS] Unhandled message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
      break;
  }
  // Return true for async responses if any path might be async and doesn't return true itself.
  // Most paths above that are async already return true.
  return false; 
});


// --- Extension Action (Toolbar Icon) Click Handler ---
console.log('[BACKGROUND.JS] Attempting to add chrome.action.onClicked listener...');
chrome.action.onClicked.addListener((tab) => {
  console.log('[BACKGROUND.JS] Extension icon clicked.');
  // We need to ensure this targets only WhatsApp Web tabs,
  // or at least that the content script on other pages handles the message gracefully.
  // For now, let's assume the content script is only injected on WA Web.
  if (tab.url && tab.url.startsWith('https://web.whatsapp.com')) {
    // --- Detailed logging for tab readiness ---
    console.log(`[BACKGROUND.JS] Action clicked for tab ID: ${tab.id}, URL: ${tab.url}`);
    console.log('[BACKGROUND.JS] Current readyTabs:', Array.from(readyTabs)); // Log content of the Set
    const isTabReady = readyTabs.has(tab.id);
    console.log(`[BACKGROUND.JS] Is this tab (${tab.id}) in readyTabs? ${isTabReady}`);
    // --- End detailed logging ---

    if (isTabReady) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL_VISIBILITY_FROM_ACTION' })
        .then(response => {
          if (chrome.runtime.lastError) {
            console.error('[BACKGROUND.JS] Error sending TOGGLE_PANEL_VISIBILITY_FROM_ACTION:', chrome.runtime.lastError.message);
          } else {
            console.log('[BACKGROUND.JS] Sent TOGGLE_PANEL_VISIBILITY_FROM_ACTION, response:', response);
          }
        })
        .catch(err => console.error('[BACKGROUND.JS] Error sending TOGGLE_PANEL_VISIBILITY_FROM_ACTION:', err.message));
    } else {
      console.warn(`[BACKGROUND.JS] WhatsApp tab (ID: ${tab.id}, URL: ${tab.url}) not in readyTabs. Current readyTabs: [${Array.from(readyTabs).join(', ')}]. Cannot send TOGGLE_PANEL_VISIBILITY_FROM_ACTION.`);
      // Optionally, try to inject content script or wait for it to become ready.
      // For now, we just log. The user might need to refresh the WA page.
    }
  } else {
    console.log('[BACKGROUND.JS] Icon clicked on a non-WhatsApp Web tab:', tab.url);
  }
});

console.log('Background service worker event listeners attached.');