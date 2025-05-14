// Selector for the main chat header element we will OBSERVE for changes.
// Using specific classes from the user-provided <header> element.
// THIS IS STILL RISKY due to auto-generated classes.
const CHAT_HEADER_TO_OBSERVE_SELECTOR = 'div#main > header'; // CHANGED: More robust selector

// Selector for the element whose textContent IS the chat name/identifier, relative to the observed header.
const CHAT_TITLE_ELEMENT_SELECTOR_IN_HEADER = 'div[data-testid="conversation-header-chat-title"] span, span[dir="auto"][title]';

// For messages (we'll refine this after header works)
const MESSAGES_CONTAINER_SELECTOR = 'div[data-testid="conversation-panel-messages"]';
const MESSAGE_BUBBLE_SELECTOR = 'div[role="row"]';

// Sidebar ID constant
const SIDEBAR_ID = 'whatsapp-ai-copilot-sidebar';
let sidebarInjected = false;

let currentChatName = null;
let chatHeaderObserver = null;
let messagesObserver = null;

// Store a reference to the currently observed header element
let currentlyObservedHeaderElement = null;

// Timeouts
const CHAT_DETECTION_TIMEOUT = 5000; // 5 seconds
let chatDetectionTimer = null;

// Debug mode
const DEBUG = true;
function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

// When DOM is fully loaded, initialize the extension
document.addEventListener('DOMContentLoaded', () => {
  debugLog('WhatsApp AI Co-Pilot content script loaded! V4 DEBUG');
  setTimeout(() => {
    // Initialize the extension
    initializeExtension();
    
    // Notify background script that content script is ready
    notifyBackgroundScriptReady();
  }, 1000); // Wait 1s to ensure WhatsApp is loaded
});

// Function to notify background script that content script is ready
function notifyBackgroundScriptReady() {
  debugLog('Notifying background script that content script is ready...');
  
  try {
    chrome.runtime.sendMessage({ 
      type: 'CONTENT_SCRIPT_READY',
      url: window.location.href,
      timestamp: Date.now()
    }, response => {
      if (chrome.runtime.lastError) {
        debugLog('Error notifying background script:', chrome.runtime.lastError);
        // Retry after a short delay
        setTimeout(notifyBackgroundScriptReady, 1000);
        return;
      }
      
      debugLog('Background acknowledged content script is ready:', response);
    });
  } catch (error) {
    debugLog('Failed to notify background script:', error);
    // Retry after a short delay
    setTimeout(notifyBackgroundScriptReady, 1000);
  }
}

// Initialize extension features
function initializeExtension() {
  injectSidebar();
  initializeDOMObservers();
  
  // Run an initial check to detect current chat
  setTimeout(forceChatInfoCheck, 1500);
}

// Force a check for chat info even if no DOM change detected
function forceChatInfoCheck() {
  debugLog('Running forced chat info check...');
  const headerElement = document.querySelector(CHAT_HEADER_TO_OBSERVE_SELECTOR);
  if (headerElement) {
    extractAndNotifyChatInfo(headerElement);
  } else {
    debugLog('No chat header found in forced check');
  }
}

// Create mutation observers to detect chat changes and new messages
function initializeDOMObservers() {
  debugLog('Initializing DOM Observers V4...');
  
  // Main observer for chat header changes - this tells us when user switches chats
  observeChatHeader();
  
  // Also observe body element for high-level changes
  const bodyObserver = new MutationObserver((mutations) => {
    // Check if we need to update our chat header observer
    const headerElement = document.querySelector(CHAT_HEADER_TO_OBSERVE_SELECTOR);
    if (headerElement && headerElement !== currentlyObservedHeaderElement) {
      debugLog('Body observer detected potential chat change');
      observeChatHeader();
    }
  });
  
  bodyObserver.observe(document.body, { 
    childList: true, 
    subtree: true
  });
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle force DOM check
    if (message.type === 'FORCE_DOM_CHECK_FOR_CHAT') {
      debugLog('Received FORCE_DOM_CHECK_FOR_CHAT, checking DOM for current chat');
      forceChatInfoCheck();
      sendResponse({ success: true });
      return true;
    }
    
    // Handle PING message from background
    if (message.type === 'PING') {
      debugLog('Received PING from background, responding with READY');
      sendResponse({ status: 'READY' });
      return true;
    }
    
    // Handle EXTRACT_CHAT_INFO_FROM_DOM message from background
    if (message.type === 'EXTRACT_CHAT_INFO_FROM_DOM') {
      debugLog('Received EXTRACT_CHAT_INFO_FROM_DOM, extracting chat info from DOM');
      
      try {
        // Get chat info from DOM
        const chatInfo = getCurrentChatInfo();
        
        if (chatInfo && chatInfo.chatName) {
          debugLog('Successfully extracted chat info from DOM:', chatInfo);
          sendResponse({
            success: true,
            chatName: chatInfo.chatName,
            chatJid: chatInfo.chatJid
          });
        } else {
          debugLog('Could not extract chat info from DOM');
          sendResponse({
            success: false,
            error: 'Could not extract chat info from DOM'
          });
        }
      } catch (error) {
        console.error('[AI Co-Pilot] Error extracting chat info from DOM:', error);
        sendResponse({
          success: false,
          error: 'Error extracting chat info from DOM: ' + error.message
        });
      }
      
      return true;
    }
    
    // Handle FOCUSED_CHAT_UPDATED from background
    if (message.type === 'FOCUSED_CHAT_UPDATED') {
      debugLog('Received FOCUSED_CHAT_UPDATED:', message);
      
      // Store the updated chat info
      if (message.chat) {
        currentChatName = message.chat.name || currentChatName;
        currentChatJid = message.chat.jid || message.chat.id || currentChatJid;
        
        debugLog('Updated current chat info:', { currentChatName, currentChatJid });
        
        // Relay to iframe
        const iframe = document.getElementById('whatsapp-ai-copilot-iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'FOCUSED_CHAT_UPDATED',
            chat: message.chat
          }, '*');
          debugLog('Relayed FOCUSED_CHAT_UPDATED to iframe');
        }
      }
      
      // Send acknowledgment
      sendResponse({ ack: true });
      return true;
    }
    
    // Return true for any other message to keep the message channel open
    return true;
  });
}

// Function to observe the current chat header for changes
function observeChatHeader() {
  const chatHeaderToObserve = document.querySelector(CHAT_HEADER_TO_OBSERVE_SELECTOR);
  
  // If no chat header is found, disconnect any existing observer and retry later
  if (!chatHeaderToObserve) {
    if (chatHeaderObserver) {
      chatHeaderObserver.disconnect();
      chatHeaderObserver = null;
      currentlyObservedHeaderElement = null;
    }
    
    // Retry after a delay
    console.log('[AI Co-Pilot] No chat header found, will retry observation in 2 seconds');
    setTimeout(observeChatHeader, 2000);
    return;
  }

  // Don't re-observe the same element
  if (currentlyObservedHeaderElement === chatHeaderToObserve && chatHeaderObserver) {
    console.log('[AI Co-Pilot] Already observing this chat header');
    return;
  }

  // Disconnect any existing observer
  if (chatHeaderObserver) {
    chatHeaderObserver.disconnect();
  }
  
  // Store reference to current header
  currentlyObservedHeaderElement = chatHeaderToObserve;
  console.log('[AI Co-Pilot] Starting to observe chat header:', chatHeaderToObserve);

  // Create a new mutation observer
  chatHeaderObserver = new MutationObserver((mutationsList) => {
    console.log('[AI Co-Pilot] Chat header mutation detected');
    
    // Send current chat info on any header change
    sendCurrentChatInfoToBackground(true);
    
    // Also post to sidebar iframe directly, bypassing background
    const info = getCurrentChatInfo();
    const iframe = document.getElementById('whatsapp-ai-copilot-iframe');
    if (iframe && iframe.contentWindow && info && info.chatName) {
      iframe.contentWindow.postMessage({
        type: 'CHAT_INFO',
        chatName: info.chatName,
        chatJid: info.chatJid || null
      }, '*');
      console.log('[AI Co-Pilot] Direct iframe notification of chat info on mutation');
    }
  });

  // Observe the header with appropriate options
  chatHeaderObserver.observe(currentlyObservedHeaderElement, { 
    childList: true, 
    subtree: true, 
    characterData: true,
    attributes: true,
    attributeFilter: ['data-id', 'title']
  });
  console.log('[AI Co-Pilot] Chat header observer started');

  // Also send the initial state
  sendCurrentChatInfoToBackground(true);
  
  // Set up a periodic check to ensure we're tracking the correct header
  const headerCheckInterval = setInterval(() => {
    // Check if we're still on the same page/chat
    const currentHeader = document.querySelector(CHAT_HEADER_TO_OBSERVE_SELECTOR);
    
    // If the header no longer exists or has changed, re-observe
    if (!currentHeader || currentHeader !== currentlyObservedHeaderElement) {
      console.log('[AI Co-Pilot] Chat header changed, re-observing');
      clearInterval(headerCheckInterval);
      observeChatHeader();
    } else {
      // Periodically send updates anyway, in case WhatsApp updated without triggering mutations
      sendCurrentChatInfoToBackground(false);
    }
  }, 5000); // Check every 5 seconds
}

// Send chat info directly to panel, bypassing background script
function sendChatInfoDirectlyToPanel(chatName, chatJid = null) {
  const iframe = document.getElementById('whatsapp-ai-copilot-iframe');
  if (iframe && iframe.contentWindow) {
    debugLog('Sending chat info directly to panel:', { chatName, chatJid });
    iframe.contentWindow.postMessage({
      type: 'CHAT_INFO',
      chatName: chatName,
      chatJid: chatJid
    }, '*');
  } else {
    debugLog('Could not find iframe to send chat info directly');
  }
}

// Extract chat info from header and notify background script
function extractAndNotifyChatInfo(headerElement) {
  if (!headerElement) return;
  
  // Find the chat title element inside the header
  const chatTitleElement = headerElement.querySelector(CHAT_TITLE_ELEMENT_SELECTOR_IN_HEADER);
  
  if (!chatTitleElement) {
    debugLog('Chat title element not found within header.');
    return;
  }
  
  // Extract the chat name
  const newChatName = chatTitleElement.textContent.trim();
  
  if (!newChatName) {
    debugLog('Empty chat name extracted from header');
    return;
  }
  
  // Log every time we get chat info even if it hasn't changed
  debugLog('Initial chat (V4):', newChatName);
  
  // Only notify if the chat name has changed
  if (newChatName !== currentChatName) {
    currentChatName = newChatName;
    
    // Create a custom event to notify other scripts
    const event = new CustomEvent('chatChanged', { 
      detail: { 
        chatName: newChatName,
        timestamp: new Date().toISOString()
      } 
    });
    document.dispatchEvent(event);
    
    // Notify the background script about the chat change
    notifyBackgroundOfChatChange(newChatName);
    
    // Also directly notify the panel as a fallback
    sendChatInfoDirectlyToPanel(newChatName);
  }
}

// Notify background script about chat change
function notifyBackgroundOfChatChange(chatName) {
  try {
    chrome.runtime.sendMessage({ 
      type: 'CHAT_SWITCHED_TO_NAME', // Changed message type to be more explicit
      chatName: chatName,
      timestamp: Date.now()
    }, response => {
      if (chrome.runtime.lastError) {
        debugLog('Error sending chat change to background:', chrome.runtime.lastError);
        return;
      }
      
      if (response && response.success) {
        debugLog('Background acknowledged chat change:', response);
      } else if (response && response.error) {
        debugLog('Background reported error:', response.error);
      }
    });
  } catch (error) {
    debugLog('Error sending chat focus message to background:', error);
  }
}

function injectSidebar() {
    if (document.getElementById(SIDEBAR_ID) || sidebarInjected) {
        console.log("Sidebar already injected.");
        return;
    }

    console.log("Attempting to inject sidebar...");

    // Create a container for the entire sidebar
    const sidebarContainer = document.createElement('div');
    sidebarContainer.id = SIDEBAR_ID;
    sidebarContainer.style.cssText = "position:fixed; right:0px; top:0px; height:100vh; z-index:9999; display: flex;";

    // Create an iframe to load panel.html in extension context
    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('panel.html');
    iframe.style.cssText = `
        height: 100%;
        width: 320px; /* Match --sidebar-width in panel.css */
        border: none;
        transition: width 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        background-color: white;
        box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
    `;
    iframe.id = "whatsapp-ai-copilot-iframe";
    
    // Add the iframe to the container
    sidebarContainer.appendChild(iframe);
    
    // Add custom styling for WhatsApp Web integration
    const style = document.createElement('style');
    style.textContent = `
        /* Define sidebar variables */
        :root {
            --sidebar-width: 320px;
            --sidebar-collapsed-width: 60px;
            --primary-color: #00a884;
            --primary-light: #e9ffef;
            --primary-dark: #006451;
            --transition-speed: 0.3s;
        }
        
        /* Adjust WhatsApp Web layout to make room for our sidebar */
        body.whatsapp-ai-sidebar-active {
            --app-width: calc(100% - var(--sidebar-width)) !important;
        }
        
        body.whatsapp-ai-sidebar-collapsed {
            --app-width: calc(100% - var(--sidebar-collapsed-width)) !important;
        }
        
        /* Apply the width adjustment to the app */
        body.whatsapp-ai-sidebar-active #app,
        body.whatsapp-ai-sidebar-active .app-wrapper-web {
            width: var(--app-width) !important;
            transition: width var(--transition-speed) cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
        }
        
        /* Fix for multiple elements to ensure proper transition */
        body.whatsapp-ai-sidebar-active .two, 
        body.whatsapp-ai-sidebar-active ._3WByx, 
        body.whatsapp-ai-sidebar-active ._1XkO3 {
            transition: width var(--transition-speed) cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
        }
        
        /* Ensure WhatsApp is aware of our sidebar by shifting its position */
        body.whatsapp-ai-sidebar-active #app {
            position: absolute;
            left: 0;
        }
        
        /* Fix for icons and popups */
        .card-icon {
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            background-color: rgba(0, 168, 132, 0.1) !important;
            color: #00a884 !important;
            width: 50px !important;
            height: 50px !important;
            border-radius: 50% !important;
            margin: 0 auto 8px auto !important;
            font-size: 20px !important;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1) !important;
        }
        
        /* Fix for Font Awesome icons */
        .fa, .fas, .far, .fal, .fab {
            display: inline-block !important;
            opacity: 1 !important;
            visibility: visible !important;
        }
        
        /* Visual improvements for card elements */
        .card-title {
            font-weight: bold !important;
            font-size: 15px !important;
            color: #333 !important;
            text-align: center !important;
        }
        
        .feature-card {
            min-height: 100px !important;
            padding: 15px !important;
            margin-bottom: 10px !important;
            border-radius: 12px !important;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05) !important;
            transition: transform 0.2s, box-shadow 0.2s !important;
        }
        
        .feature-card:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1) !important;
        }
        
        /* Smooth transition for the entire UI */
        #whatsapp-ai-copilot-sidebar {
            transition: all var(--transition-speed) cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
        }
        
        /* Hide sidebar toggle button when collapsed */
        #ai-copilot-panel.collapsed ~ #sidebar-toggle {
            opacity: 1 !important;
            pointer-events: auto !important;
            background-color: var(--primary-color) !important;
            border-radius: 50% !important;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2) !important;
        }
    `;
    document.head.appendChild(style);
    
    // Add class to document to help with styling WhatsApp Web
    document.body.classList.add('whatsapp-ai-sidebar-active');
    
    // Inject into the body of the page
    document.body.appendChild(sidebarContainer);
    sidebarInjected = true;
    console.log("Sidebar container and iframe injected.");

    // Set up improved message handling from iframe to background
    window.addEventListener('message', (event) => {
      const iframe = document.getElementById('whatsapp-ai-copilot-iframe');
      
      // Only process messages from our iframe
      if (event.source === iframe?.contentWindow) {
        try {
          const message = event.data;
          
          // Handle toggle sidebar message
          if (message.action === 'toggleSidebar') {
            const isCollapsed = message.isCollapsed;
            
            // Update the iframe width
            iframe.style.width = isCollapsed ? '60px' : '320px';
            
            // Update WhatsApp Web classes
            if (isCollapsed) {
              document.body.classList.add('whatsapp-ai-sidebar-collapsed');
              document.body.classList.remove('whatsapp-ai-sidebar-active');
            } else {
              document.body.classList.remove('whatsapp-ai-sidebar-collapsed');
              document.body.classList.add('whatsapp-ai-sidebar-active');
            }
            
            return; // Don't proceed with other message handling
          }
          
          // Handle SEND_TO_BACKGROUND messages
          if (message && message.type === 'SEND_TO_BACKGROUND') {
            console.log('[AI Co-Pilot] Received SEND_TO_BACKGROUND from iframe:', message.message);
            
            // Keep track of pending requests for timeout handling
            const requestId = message.requestId || Date.now();
            const timeoutId = setTimeout(() => {
              console.warn('[AI Co-Pilot] Background request timed out:', message.message);
              iframe.contentWindow.postMessage({
                type: 'BACKGROUND_RESPONSE',
                error: 'Request timed out after 10 seconds',
                originalRequest: message.message,
                requestId: requestId,
                timedOut: true
              }, '*');
            }, 10000); // 10 second timeout
            
            // Send to background with robust error handling
            chrome.runtime.sendMessage(message.message, (response) => {
              // Clear the timeout since we got a response
              clearTimeout(timeoutId);
              
              const error = chrome.runtime.lastError;
              if (error) {
                console.warn('[AI Co-Pilot] Error sending message to background:', error);
                
                // Special handling for GET_FOCUSED_CHAT - provide fallback
                if (message.message.type === 'GET_FOCUSED_CHAT') {
                  // Try to get chat info directly from DOM as fallback
                  const info = getCurrentChatInfo();
                  if (info && info.chatName) {
                    console.log('[AI Co-Pilot] Using DOM fallback for chat info:', info);
                    iframe.contentWindow.postMessage({
                      type: 'CHAT_INFO',
                      chatName: info.chatName,
                      chatJid: info.chatJid,
                      requestId: requestId,
                      fromDOMFallback: true
                    }, '*');
                    return;
                  }
                }
                
                // Send error back to iframe
                iframe.contentWindow.postMessage({
                  type: 'BACKGROUND_RESPONSE',
                  error: error.message,
                  originalRequest: message.message,
                  requestId: requestId
                }, '*');
                return;
              }
              
              // Special handling for GET_FOCUSED_CHAT
              if (message.message.type === 'GET_FOCUSED_CHAT') {
                if (response && response.chat) {
                  iframe.contentWindow.postMessage({
                    type: 'CHAT_INFO',
                    chatName: response.chat.name,
                    chatJid: response.chat.jid || response.chat.id,
                    requestId: requestId
                  }, '*');
                } else {
                  // Fallback to DOM extraction if background returns no chat
                  const info = getCurrentChatInfo();
                  if (info && info.chatName) {
                    console.log('[AI Co-Pilot] Using DOM fallback for chat info:', info);
                    iframe.contentWindow.postMessage({
                      type: 'CHAT_INFO',
                      chatName: info.chatName,
                      chatJid: info.chatJid,
                      requestId: requestId,
                      fromDOMFallback: true
                    }, '*');
                  } else {
                    iframe.contentWindow.postMessage({
                      type: 'CHAT_INFO',
                      error: 'No chat info available',
                      requestId: requestId
                    }, '*');
                  }
                }
              } else {
                // For other message types, forward the response
                console.log('[AI Co-Pilot] Relaying background response to iframe:', response);
                iframe.contentWindow.postMessage({
                  type: 'BACKGROUND_RESPONSE',
                  response: response,
                  originalRequest: message.message,
                  requestId: requestId
                }, '*');
              }
            });
          } else if (message && message.type) {
            // Other message types from iframe that may need to be relayed
            console.log('[AI Co-Pilot] Relaying message from iframe to background:', message);
            
            // For non-SEND_TO_BACKGROUND messages, just relay them
            chrome.runtime.sendMessage(message, (response) => {
              const error = chrome.runtime.lastError;
              if (error) {
                console.warn('[AI Co-Pilot] Error relaying message to background:', error);
                return;
              }
              
              // If there's a response to relay back, do so
              if (response) {
                iframe.contentWindow.postMessage({
                  type: 'BACKGROUND_RESPONSE',
                  response: response,
                  originalRequest: message
                }, '*');
              }
            });
          }
        } catch (e) {
          console.error('[AI Co-Pilot] Error processing message from iframe:', e);
        }
      }
    });
    
    // Let the iframe know when chat info changes
    const sendToIframe = (message) => {
        if (iframe.contentWindow) {
            iframe.contentWindow.postMessage(message, '*');
        }
    };
    
    // When the chat changes, notify the iframe
    document.addEventListener('chatChanged', (e) => {
        sendToIframe({
            type: 'CHAT_INFO',
            chatName: e.detail.chatName,
            chatJid: e.detail.chatJid
        });
    });

    // When the iframe loads, send it the current chat info
    iframe.onload = function() {
        console.log("Iframe loaded, sending initial chat info if available");
        
        // Send an initial message to let the iframe know the content script is ready
        if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'CONTENT_SCRIPT_READY',
                timestamp: Date.now()
            }, '*');
        }
        
        // First try to get the current chat name from the DOM directly
        const headerElement = document.querySelector(CHAT_HEADER_TO_OBSERVE_SELECTOR);
        if (headerElement) {
            const chatTitleElement = headerElement.querySelector(CHAT_TITLE_ELEMENT_SELECTOR_IN_HEADER);
            if (chatTitleElement) {
                const chatName = chatTitleElement.textContent.trim();
                if (chatName) {
                    currentChatName = chatName;
                    debugLog('Found current chat name from DOM:', chatName);
                    
                    // Send directly to iframe
                    sendChatInfoDirectlyToPanel(chatName);
                    
                    // Also notify background
                    notifyBackgroundOfChatChange(chatName);
                }
            }
        }
        
        // As a fallback, use any stored chat info
        if (currentChatName) {
            // Also try to get the chat JID from the background
            chrome.runtime.sendMessage({ type: "GET_FOCUSED_CHAT" }, (response) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    console.warn("Error getting chat info for initial load:", error);
                    // Still send the chat name even if we can't get the JID
                    sendChatInfoDirectlyToPanel(currentChatName);
                    return;
                }
                
                if (response && response.chat) {
                    console.log("Sending initial chat info to iframe:", response.chat);
                    sendChatInfoDirectlyToPanel(response.chat.name, response.chat.id || response.chat.jid);
                } else {
                    // If we have name but no JID, still send partial info
                    console.log("Sending partial initial chat info to iframe:", { name: currentChatName });
                    sendChatInfoDirectlyToPanel(currentChatName);
                }
            });
        } else {
            // If we still don't have a chat name, force a DOM check
            forceChatInfoCheck();
        }
        
        // Set up a retry mechanism if all else fails
        setTimeout(() => {
            if (!currentChatName) {
                debugLog('No chat name detected after timeout, forcing another check');
                forceChatInfoCheck();
            }
        }, 2000);
    };
}

// Function to extract the JID from data attributes or other properties
function extractJidFromDom() {
  try {
    // Try multiple methods of extracting JID
    
    // Method 1: Look for data-jid on conversation elements
    const headerConversation = document.querySelector('header [data-jid]');
    if (headerConversation && headerConversation.getAttribute('data-jid')) {
      console.log('[AI Co-Pilot] Found JID from header data-jid attribute:', headerConversation.getAttribute('data-jid'));
      return headerConversation.getAttribute('data-jid');
    }
    
    // Method 2: Look for data-id on main conversation header
    const mainHeader = document.querySelector('#main header [data-id]');
    if (mainHeader && mainHeader.getAttribute('data-id')) {
      console.log('[AI Co-Pilot] Found JID from main header data-id attribute:', mainHeader.getAttribute('data-id'));
      return mainHeader.getAttribute('data-id');
    }
    
    // Method 3: Check for data-testid="conversation-header" and nearby elements with data-id
    const conversationHeader = document.querySelector('div[data-testid="conversation-header"]');
    if (conversationHeader) {
      const jidElement = conversationHeader.querySelector('[data-jid], [data-id]');
      if (jidElement) {
        const jid = jidElement.getAttribute('data-jid') || jidElement.getAttribute('data-id');
        if (jid) {
          console.log('[AI Co-Pilot] Found JID from conversation header:', jid);
          return jid;
        }
      }
    }
    
    // Method 4: Look for data attributes in container elements (slower but more thorough)
    const containers = document.querySelectorAll('#main [data-jid], #main [data-id]');
    for (const container of containers) {
      const jid = container.getAttribute('data-jid') || container.getAttribute('data-id');
      if (jid && (jid.includes('@c.us') || jid.includes('@g.us'))) {
        console.log('[AI Co-Pilot] Found JID from container search:', jid);
        return jid;
      }
    }
    
    // Method 5: Try to extract from chat info panel
    const chatInfoElements = document.querySelectorAll('[data-testid="chat-info-drawer"] [data-testid="drawer-right-body"] span');
    for (const element of chatInfoElements) {
      const text = element.textContent;
      // Phone numbers in WhatsApp are often displayed with the country code
      if (text && /^\+\d{6,15}$/.test(text.replace(/\s+/g, ''))) {
        // Convert phone number to JID format (e.g., +1234567890 -> 1234567890@c.us)
        const phoneNumber = text.replace(/\D/g, '');
        const jid = `${phoneNumber}@c.us`;
        console.log('[AI Co-Pilot] Found JID from chat info panel (phone):', jid);
        return jid;
      }
    }
    
    // Method 6: Try to derive from chat title/name by extracting numbers
    // This is less reliable but worth a try if we're desperate
    const chatName = currentChatName || 
      (document.querySelector(CHAT_TITLE_ELEMENT_SELECTOR_IN_HEADER)?.textContent.trim());
    
    if (chatName) {
      // Check if the chat name looks like a phone number (digits with optional + and spaces)
      // but be careful not to match names that just happen to contain numbers
      const phoneNumberMatches = chatName.match(/^(?:\+\d{1,3})?\s*\d[\d\s]{8,20}$/);
      if (phoneNumberMatches) {
        // Strip out non-digits
        const phoneNumber = chatName.replace(/\D/g, '');
        if (phoneNumber.length >= 8) { // Basic sanity check for length
          const jid = `${phoneNumber}@c.us`;
          console.log('[AI Co-Pilot] Derived JID from chat name (looks like phone):', jid);
          return jid;
        }
      }
    }
    
    // Method 7: Try more aggressive selector for group chats
    const groupInfoElement = document.querySelector('[data-testid="group-info-drawer"]');
    if (groupInfoElement) {
      // This is a group chat
      const groupElements = document.querySelectorAll('[data-testid="group-info-drawer"] [data-testid]');
      for (const element of groupElements) {
        const dataId = element.getAttribute('data-testid');
        if (dataId && dataId.includes('group-')) {
          const potentialId = dataId.split('-').pop();
          if (potentialId && potentialId.length > 5) {
            const jid = `${potentialId}@g.us`;
            console.log('[AI Co-Pilot] Derived possible group JID:', jid);
            return jid;
          }
        }
      }
    }
    
    // Method 8: Look for chat list elements with the active class
    const activeListItem = document.querySelector('div[aria-selected="true"][data-testid="cell-frame-container"]');
    if (activeListItem) {
      // Look for parent elements with data-id
      let currentElement = activeListItem;
      let searchAttempts = 0; // Limit search depth to avoid infinite loops
      
      while (currentElement && !currentElement.getAttribute('data-id') && searchAttempts < 10) {
        currentElement = currentElement.parentElement;
        searchAttempts++;
      }
      
      if (currentElement && currentElement.getAttribute('data-id')) {
        const jid = currentElement.getAttribute('data-id');
        console.log('[AI Co-Pilot] Found JID from active list item:', jid);
        return jid;
      }
    }
    
    console.log('[AI Co-Pilot] Could not extract JID from DOM');
    return null;
  } catch (err) {
    console.error('[AI Co-Pilot] Error extracting JID:', err);
    return null;
  }
}

// Function to get current chat info from DOM
function getCurrentChatInfo() {
  try {
    // Find the chat header element
    const chatHeaderElement = document.querySelector(CHAT_HEADER_TO_OBSERVE_SELECTOR);
    
    if (!chatHeaderElement) {
      console.log('[AI Co-Pilot] Chat header element not found');
      return null;
    }
    
    // Get the chat title
    const chatTitleElement = chatHeaderElement.querySelector(CHAT_TITLE_ELEMENT_SELECTOR_IN_HEADER);
    
    if (!chatTitleElement) {
      console.log('[AI Co-Pilot] Chat title element not found');
      return null;
    }
    
    const chatName = chatTitleElement.textContent.trim();
    
    if (!chatName) {
      console.log('[AI Co-Pilot] Chat name is empty');
      return null;
    }
    
    // Try to get the chat JID
    const chatJid = extractJidFromDom();
    
    console.log(`[AI Co-Pilot] Extracted chat info: { chatName: "${chatName}", chatJid: "${chatJid || 'null'}" }`);
    
    return {
      chatName,
      chatJid
    };
  } catch (err) {
    console.error('[AI Co-Pilot] Error getting current chat info:', err);
    return null;
  }
}

function sendCurrentChatInfoToBackground(force = false) {
  const info = getCurrentChatInfo();
  
  // Always log when we attempt to send chat info
  console.log('[AI Co-Pilot] Attempting to send chat info to background:', info);
  
  if (!info || !info.chatName) {
    console.log('[AI Co-Pilot] No valid chat info to send');
    return;
  }

  // If we either have a new chat name OR we're forcing an update OR we now have a JID we didn't have before
  if (force || 
      info.chatName !== currentChatName || 
      info.chatJid !== currentChatJid ||
      (info.chatJid && !currentChatJid)) {
    
    // Update our cached values
    currentChatName = info.chatName;
    currentChatJid = info.chatJid;
    
    // Send to background script
    try {
      chrome.runtime.sendMessage({ 
        type: 'CHAT_SWITCHED_TO_NAME', 
        chatName: info.chatName,
        chatJid: info.chatJid
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[AI Co-Pilot] Error sending chat info to background:', chrome.runtime.lastError);
        } else if (response && response.success) {
          console.log('[AI Co-Pilot] Successfully sent chat info to background, response:', response);
          
          // Now update the iframe as well
          const iframe = document.getElementById('whatsapp-ai-copilot-iframe');
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              type: 'CHAT_SWITCHED_TO_NAME',
              chatName: info.chatName,
              chatJid: info.chatJid
            }, '*');
            console.log('[AI Co-Pilot] Chat info relayed to iframe');
          } else {
            console.log('[AI Co-Pilot] Iframe not found or not ready to receive messages');
          }
        } else {
          console.warn('[AI Co-Pilot] Background response indicates failure:', response);
        }
      });
    } catch (error) {
      console.error('[AI Co-Pilot] Error communicating with background script:', error);
    }
  } else {
    console.log('[AI Co-Pilot] No change in chat info, not sending update');
  }
}

// Add direct handler for manual chat selection
window.addEventListener('message', (event) => {
  const iframe = document.getElementById('whatsapp-ai-copilot-iframe');
  
  // Only process messages from our iframe
  if (event.source === iframe?.contentWindow) {
    try {
      const message = event.data;
      
      // Handle manual chat selection
      if (message && message.type === 'MANUAL_CHAT_SELECTED' && message.chatName) {
        console.log('[AI Co-Pilot] Received manual chat selection:', message.chatName, 'JID:', message.chatJid || 'None');
        
        // Set as current chat
        currentChatName = message.chatName;
        currentChatJid = message.chatJid || null;
        
        // Notify background script
        try {
          chrome.runtime.sendMessage({
            type: 'CHAT_SWITCHED_TO_NAME',
            chatName: message.chatName,
            chatJid: message.chatJid || null
          }, response => {
            console.log('[AI Co-Pilot] Background acknowledged manual chat selection:', response);
            
            // Once background confirms, send back to iframe with acknowledgment
            if (iframe?.contentWindow) {
              iframe.contentWindow.postMessage({
                type: 'CHAT_INFO',
                chatName: message.chatName,
                chatJid: message.chatJid || null,
                source: 'manual_selection'
              }, '*');
            }
          });
        } catch (error) {
          console.error('[AI Co-Pilot] Error sending manual chat selection to background:', error);
        }
      }
      
      // Handle REQUEST_DOM_CHAT_INFO message (fallback method)
      if (message && message.type === 'REQUEST_DOM_CHAT_INFO') {
        console.log('[AI Co-Pilot] Received REQUEST_DOM_CHAT_INFO from panel');
        
        // Extract chat info directly from DOM
        const info = getCurrentChatInfo();
        
        if (info && info.chatName) {
          console.log('[AI Co-Pilot] Providing DOM-based chat info:', info);
          
          // Store locally
          currentChatName = info.chatName;
          currentChatJid = info.chatJid;
          
          // Send directly to iframe
          iframe.contentWindow.postMessage({
            type: 'CHAT_INFO',
            chatName: info.chatName,
            chatJid: info.chatJid,
            source: 'dom'
          }, '*');
          
          // Also send to background
          try {
            chrome.runtime.sendMessage({
              type: 'CHAT_SWITCHED_TO_NAME',
              chatName: info.chatName,
              chatJid: info.chatJid
            });
          } catch (e) {
            console.error('[AI Co-Pilot] Error sending DOM chat info to background:', e);
          }
        } else {
          console.log('[AI Co-Pilot] Could not extract chat info from DOM');
          
          // Send failure message back to iframe
          iframe.contentWindow.postMessage({
            type: 'CHAT_INFO_FAILED',
            reason: 'Could not extract chat from DOM',
            requestId: message.requestId
          }, '*');
        }
      }
    } catch (error) {
      console.error('[AI Co-Pilot] Error processing message from iframe:', error);
    }
  }
});

/**
 * Safely send a message to the background script with improved error handling
 * and fallback mechanisms if the extension context is invalidated
 */
function safelySendMessageToBackground(message, callback) {
  // Always relay message to iframe as fallback
  const iframe = document.getElementById('whatsapp-ai-copilot-iframe');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({
      type: 'CONTENT_DIRECT',
      originalType: message.type,
      message: message,
      timestamp: Date.now()
    }, '*');
  }
  
  // Track if we're in fallback mode (extension context invalidated)
  const inFallbackMode = localStorage.getItem('whatsapp_ai_extension_context_invalidated') === 'true';
  
  if (inFallbackMode) {
    console.log('[AI Co-Pilot] In fallback mode - not attempting to use chrome.runtime APIs');
    if (typeof callback === 'function') {
      callback({ error: 'Extension in fallback mode', fallback: true });
    }
    return false;
  }
  
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          console.warn(
            `[AI Co-Pilot] Error sending message to background script:`,
            errorMsg,
            'Message:', message
          );
          
          // If context invalidated, enter fallback mode
          if (errorMsg.includes('context invalidated')) {
            console.log('[AI Co-Pilot] Extension context invalidated - entering fallback mode');
            
            // Set flag for fallback mode
            localStorage.setItem('whatsapp_ai_extension_context_invalidated', 'true');
            
            // Show message to the user inside the iframe
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({
                type: 'EXTENSION_ERROR',
                error: 'Extension context invalidated',
                message: 'The extension has been updated or reloaded. Please refresh the page to continue using the extension.',
                suggestRefresh: true
              }, '*');
            }
            
            // Add a visual indicator directly to the page
            addExtensionErrorIndicator();
          }
          
          if (typeof callback === 'function') {
            callback({ error: errorMsg });
          }
          return;
        }
        
        // Success - pass response to callback
        if (typeof callback === 'function') {
          callback(response);
        }
      });
      return true;
    } catch (e) {
      console.error('[AI Co-Pilot] Failed to send message to background script:', e, 'Message:', message);
      
      // Enter fallback mode
      localStorage.setItem('whatsapp_ai_extension_context_invalidated', 'true');
      
      if (typeof callback === 'function') {
        callback({ error: e.message });
      }
      return false;
    }
  } else {
    console.warn('[AI Co-Pilot] Chrome runtime not available');
    if (typeof callback === 'function') {
      callback({ error: 'Chrome runtime not available' });
    }
    return false;
  }
}

/**
 * Add a visual indicator for extension errors
 */
function addExtensionErrorIndicator() {
  const existingIndicator = document.getElementById('whatsapp-ai-extension-error');
  if (existingIndicator) return;
  
  const indicator = document.createElement('div');
  indicator.id = 'whatsapp-ai-extension-error';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: #f44336;
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    z-index: 10000;
    font-family: sans-serif;
    font-size: 14px;
    box-shadow: 0 3px 10px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    gap: 10px;
  `;
  
  indicator.innerHTML = `
    <span>⚠️ WhatsApp AI extension needs to be reloaded</span>
    <button id="whatsapp-ai-reload-btn" style="background: white; color: #f44336; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Refresh Page</button>
  `;
  
  document.body.appendChild(indicator);
  
  // Add click handler for reload button
  document.getElementById('whatsapp-ai-reload-btn').addEventListener('click', () => {
    // Clear the fallback mode flag
    localStorage.removeItem('whatsapp_ai_extension_context_invalidated');
    // Reload the page
    window.location.reload();
  });
}

// Check if we're in fallback mode on script load
window.addEventListener('load', () => {
  if (localStorage.getItem('whatsapp_ai_extension_context_invalidated') === 'true') {
    console.log('[AI Co-Pilot] Started in fallback mode due to previous extension context invalidation');
    addExtensionErrorIndicator();
    
    // If user navigates or refreshes, clear the fallback mode flag
    window.addEventListener('beforeunload', () => {
      localStorage.removeItem('whatsapp_ai_extension_context_invalidated');
    });
  }
});

// Direct DOM-based chat info extraction that doesn't rely on background script
function getDirectChatInfo() {
  try {
    // Get chat name from header
    const headerTitle = document.querySelector('div#main > header span[dir="auto"]');
    const chatName = headerTitle ? headerTitle.textContent.trim() : null;
    
    // Try to get JID from multiple sources
    let chatJid = null;
    
    // Method 1: Look for data attributes directly on elements
    const dataIdElements = document.querySelectorAll('[data-id]');
    for (const el of dataIdElements) {
      const id = el.getAttribute('data-id');
      if (id && (id.includes('@c.us') || id.includes('@g.us'))) {
        chatJid = id;
        break;
      }
    }
    
    // Method 2: Look for conversation info elements
    if (!chatJid) {
      const conversationElements = document.querySelectorAll('div#main [data-testid="conversation-info-header"] span');
      for (const el of conversationElements) {
        // Look for phone number patterns
        const text = el.textContent;
        if (/^\+?\d{6,15}$/.test(text.replace(/\D/g, ''))) {
          const phoneNumber = text.replace(/\D/g, '');
          chatJid = `${phoneNumber}@c.us`;
          break;
        }
      }
    }
    
    return { chatName, chatJid };
  } catch (error) {
    console.error('[AI Co-Pilot] Error extracting chat info directly:', error);
    return { chatName: null, chatJid: null };
  }
}

// Add handlers for direct message requests from the iframe
window.addEventListener('message', (event) => {
  const iframe = document.getElementById('whatsapp-ai-copilot-iframe');
  if (event.source === iframe?.contentWindow) {
    try {
      const message = event.data;
      
      // Handle direct request for chat info without using background
      if (message.type === 'REQUEST_DIRECT_CHAT_INFO') {
        console.log('[AI Co-Pilot] Received direct chat info request from iframe');
        const chatInfo = getDirectChatInfo();
        
        iframe.contentWindow.postMessage({
          type: 'DIRECT_CHAT_INFO',
          chatName: chatInfo.chatName,
          chatJid: chatInfo.chatJid,
          fromDirectRequest: true,
          timestamp: Date.now()
        }, '*');
      }
      
      // Handle page refresh request
      if (message.type === 'REFRESH_PAGE') {
        console.log('[AI Co-Pilot] Received page refresh request from iframe');
        // Clear any fallback mode flags
        localStorage.removeItem('whatsapp_ai_extension_context_invalidated');
        // Reload the page
        window.location.reload();
      }
    } catch (error) {
      console.error('[AI Co-Pilot] Error processing message from iframe:', error);
    }
  }
});

// Add event listener for messages from the iframe to content script
window.addEventListener('message', function(event) {
  // Check if the message is from our iframe
  if (event.source !== document.getElementById('whatsapp-ai-copilot-iframe')?.contentWindow) {
    return;
  }
  
  debugLog('Content script received message from iframe:', event.data);
  
  // Insert text into WhatsApp input field
  if (event.data.type === 'INSERT_TEXT') {
    insertTextIntoWhatsAppInput(event.data.text, event.data.autoSend);
    return;
  }
  
  // Handle other message types
  // ... existing code ...
});

// Function to insert text into WhatsApp input field
function insertTextIntoWhatsAppInput(text, autoSend = false) {
  if (!text) return false;
  
  try {
    debugLog('Attempting to insert text into WhatsApp input:', text);
    
    // Try multiple selectors to find the input field since WhatsApp's selectors can change
    const selectors = [
      '[contenteditable="true"][data-tab="10"]',
      'div[contenteditable="true"][spellcheck="true"]',
      'div[role="textbox"][contenteditable="true"]',
      'div[data-testid="conversation-compose-box-input"]',
      'div.selectable-text[contenteditable="true"]'
    ];
    
    let inputField = null;
    for (const selector of selectors) {
      inputField = document.querySelector(selector);
      if (inputField) break;
    }
    
    if (!inputField) {
      debugLog('Could not find WhatsApp input field');
      return false;
    }
    
    // Focus the input field
    inputField.focus();
    
    // Set the text content
    inputField.textContent = text;
    
    // Dispatch input event to trigger WhatsApp's handling
    inputField.dispatchEvent(new Event('input', { bubbles: true }));
    
    // If autoSend is true, try to send the message
    if (autoSend) {
      // Try to find the send button with various fallback selectors
      const sendButtonSelectors = [
        'button[data-testid="compose-btn-send"]',
        'button[data-icon="send"]',
        'span[data-testid="send"]',
        'span[data-icon="send"]',
        'button.compose-btn-send'
      ];
      
      let sendButton = null;
      for (const selector of sendButtonSelectors) {
        sendButton = document.querySelector(selector);
        if (sendButton) break;
      }
      
      if (sendButton) {
        sendButton.click();
      } else {
        // Try simulating Enter key press as fallback
        inputField.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          keyCode: 13 // Enter key
        }));
      }
    }
    
    return true;
  } catch (error) {
    debugLog('Error inserting text into WhatsApp:', error);
    return false;
  }
} 