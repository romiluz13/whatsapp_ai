console.log("WhatsApp AI Co-Pilot content script loaded.");

// We will add logic here to:
// 1. Inject the sidebar UI (Step 5)
// 2. Observe WhatsApp Web for new messages or chat changes (Step 6)
// 3. Communicate with the background script

const SIDEBAR_ID = 'whatsapp-ai-copilot-sidebar';
let sidebarInjected = false;

/**
 * Injects the AI Co-Pilot sidebar iframe into the WhatsApp Web page.
 * Sets up styles and basic communication listeners for the iframe.
 * Ensures it only injects once.
 */
function injectSidebar() {
    if (document.getElementById(SIDEBAR_ID) || sidebarInjected) {
        console.log("Sidebar already injected.");
        return;
    }

    console.log("Attempting to inject sidebar...");

    // Create a container for the entire sidebar
    const sidebarContainer = document.createElement('div');
    sidebarContainer.id = SIDEBAR_ID;

    // --- State Management ---
    const FIXED_PANEL_WIDTH = 375; // Fixed panel width in pixels
    let isSidebarCollapsed = localStorage.getItem('whatsappAiCopilotSidebarCollapsed') === 'true';
    // currentSidebarSide is fixed to 'right' and width is fixed, so no need for these in localStorage

    function saveSidebarState() {
        localStorage.setItem('whatsappAiCopilotSidebarCollapsed', isSidebarCollapsed);
        // No longer saving width as it's fixed
    }
    // --- End State Management ---

    // Initial setup - panel is always on the right
    sidebarContainer.style.position = 'fixed';
    sidebarContainer.style.top = '0';
    sidebarContainer.style.right = '0'; // Fixed to right
    sidebarContainer.style.left = 'auto';
    sidebarContainer.style.height = '100vh';
    sidebarContainer.style.zIndex = '1000';
    sidebarContainer.style.background = '#fff';
    sidebarContainer.style.display = 'flex';
    sidebarContainer.style.flexDirection = 'column';
    sidebarContainer.style.overflow = 'visible';
    sidebarContainer.style.boxShadow = '-2px 0 8px rgba(0,0,0,0.08)';


    // Apply width based on loaded state
    function applySidebarStyling() {
        if (isSidebarCollapsed) {
            sidebarContainer.style.width = '0px';
        } else {
            sidebarContainer.style.width = `${FIXED_PANEL_WIDTH}px`;
        }
    }
    applySidebarStyling();

    // Resizer element and its logic are removed for fixed width

    // Create an iframe to load panel.html in extension context
    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('panel.html');
    iframe.style.cssText = `
        height: 100%;
        width: 100%;
        border: none;
        background-color: white;
        flex: 1;
    `;
    iframe.id = "whatsapp-ai-copilot-iframe";
    sidebarContainer.appendChild(iframe);

    // Function to adjust WhatsApp Web layout
    function adjustWhatsAppLayout() {
        const appElement = document.getElementById('app');

        if (appElement) {
            appElement.style.transition = 'width 0.2s ease-out, margin-right 0.2s ease-out'; // Smooth transition
            if (isSidebarCollapsed) {
                appElement.style.removeProperty('width');
                appElement.style.removeProperty('margin-right');
            } else {
                appElement.style.setProperty('width', `calc(100% - ${FIXED_PANEL_WIDTH}px)`, 'important');
                appElement.style.setProperty('margin-right', `${FIXED_PANEL_WIDTH}px`, 'important');
            }
        }

        // Attempt to prevent horizontal scroll on the main document
        document.documentElement.style.overflowX = 'hidden';
        document.body.style.overflowX = 'hidden';
    }

    // Initial adjustment
    adjustWhatsAppLayout();


    // Inject into the body of the page
    document.body.appendChild(sidebarContainer);
    sidebarInjected = true;
    console.log("Sidebar container and iframe injected. Initial state:", { panelWidth: FIXED_PANEL_WIDTH, isSidebarCollapsed });

    // Send initial state to panel.js
    if (iframe.contentWindow) {
        iframe.onload = () => {
             iframe.contentWindow.postMessage({ action: 'updatePanelControls', side: 'right', isCollapsed: isSidebarCollapsed }, '*'); // Side is fixed
        };
    } else {
        setTimeout(() => {
            if (iframe.contentWindow) {
                 iframe.contentWindow.postMessage({ action: 'updatePanelControls', side: 'right', isCollapsed: isSidebarCollapsed }, '*'); // Side is fixed
            }
        }, 200);
    }


    // Resizer logic removed

    // Remove the old static style injection if it exists
    const oldStyle = document.head.querySelector('style[data-whatsapp-ai-copilot-style]');
    if (oldStyle) {
        oldStyle.remove();
    }
     // Add class to document to help with styling WhatsApp Web
    // document.documentElement.classList.add('whatsapp-ai-sidebar-active'); // This might not be needed if we directly set margins
    // Add a listener for messages from the iframe
    window.addEventListener('message', (event) => {
      // Temporarily log ALL messages to see what's coming in
      // const iframe = document.getElementById('whatsapp-ai-copilot-iframe'); // REMOVE THIS LINE - use iframe from outer scope
      console.log('[Content Script] Raw message received by window:', { data: event.data, origin: event.origin, source: event.source === iframe?.contentWindow ? 'matches_iframe' : 'does_not_match_iframe_or_iframe_undefined' });
      
      if (event.source === iframe?.contentWindow) {
        try {
          // This log is now redundant due to the one above, but keep for specific iframe source confirmation if needed later.
          // console.log('[Content Script] Message received from iframe:', event.data);
          const message = event.data;

          // Remove 'switchSidebarSide' handling as side is fixed
          // if (message && message.action === 'switchSidebarSide') { ... }

          if (message && message.action === 'toggleSidebarVisibility') {
            isSidebarCollapsed = message.isCollapsed;
            console.log('[Content Script] Toggled visibility. Collapsed:', isSidebarCollapsed);

            // Width is now fixed, so no need to manage currentSidebarWidth or lastNonCollapsedWidth for resizing.
            // applySidebarStyling will use FIXED_PANEL_WIDTH or 0px.

            applySidebarStyling();
            // updateResizerStyle(); // Resizer removed
            adjustWhatsAppLayout();
            saveSidebarState();
            iframe?.contentWindow?.postMessage({ action: 'updatePanelControls', side: 'right', isCollapsed: isSidebarCollapsed }, '*'); // Side is fixed

          } else if (message && message.type === 'SEND_TO_BACKGROUND') {
            console.log('[AI Co-Pilot] Received SEND_TO_BACKGROUND from iframe:', message.message);
            chrome.runtime.sendMessage(message.message, (response) => {
              const error = chrome.runtime.lastError;
              if (error) {
                console.warn('[AI Co-Pilot] Error sending message to background:', error);
                if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage({
                    type: 'BACKGROUND_RESPONSE',
                    error: error.message,
                    originalRequest: message.message
                    }, '*');
                }
                return;
              }
              console.log('[AI Co-Pilot] Relaying BACKGROUND_RESPONSE to iframe:', response);
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    type: 'BACKGROUND_RESPONSE',
                    response: response,
                    originalRequest: message.message
                }, '*');
              }
            });
          } else if (message && message.type) {
            // Relay other message types from iframe to background
            console.log('[AI Co-Pilot] Relaying other message type from iframe to background:', message);
            chrome.runtime.sendMessage(message, (response) => {
              const error = chrome.runtime.lastError;
              if (error) {
                console.warn('[AI Co-Pilot] Error sending relayed message to background:', error);
                if (iframe && iframe.contentWindow) {
                  iframe.contentWindow.postMessage({ type: 'BACKGROUND_RELAY_ERROR', error: error.message, originalRequest: message }, '*');
                }
                return;
              }
              if (iframe && iframe.contentWindow && response) {
                 iframe.contentWindow.postMessage({ type: 'BACKGROUND_RELAY_RESPONSE', response: response, originalRequest: message }, '*');
              }
            });
          }
        } catch (e) {
          console.error('Error processing message from iframe:', e);
        }
      }
    });

    // Add a chrome.runtime.onMessage listener that logs and relays to iframe
    // THIS LISTENER IS NOW INSIDE injectSidebar TO HAVE ACCESS TO SCOPED VARIABLES
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('[AI Co-Pilot] Content script (within injectSidebar) received message from background/action:', message);
      
      if (message.type === 'TOGGLE_PANEL_VISIBILITY_FROM_ACTION') {
        if (!sidebarInjected) { // Should not happen if this listener is inside injectSidebar and injectSidebar completed
          console.warn('[Content Script] Received TOGGLE_PANEL_VISIBILITY_FROM_ACTION but sidebar not injected. This is unexpected.');
          sendResponse({ success: false, error: 'Sidebar not injected, cannot toggle from action.' });
          return true;
        }

        console.log('[Content Script] Handling TOGGLE_PANEL_VISIBILITY_FROM_ACTION. Current collapsed state:', isSidebarCollapsed);

        isSidebarCollapsed = !isSidebarCollapsed; // Toggle the collapsed state
        console.log('[Content Script] New collapsed state:', isSidebarCollapsed);

        // Width is fixed, applySidebarStyling handles the visual width (0px or FIXED_PANEL_WIDTH)
        applySidebarStyling();
        // updateResizerStyle(); // Resizer removed
        adjustWhatsAppLayout();
        saveSidebarState();

        const panelIframe = document.getElementById('whatsapp-ai-copilot-iframe'); // iframe variable is in this scope
        if (panelIframe && panelIframe.contentWindow) {
          panelIframe.contentWindow.postMessage({ action: 'updatePanelControls', side: 'right', isCollapsed: isSidebarCollapsed }, '*');
        }
        sendResponse({ success: true, newCollapsedState: isSidebarCollapsed });
        return true;

      } else {
        // Relay other messages from background to iframe (if any)
        // Note: The 'iframe' variable here refers to the one defined at the top of injectSidebar
        if (iframe && iframe.contentWindow) {
          console.log('[AI Co-Pilot] Relaying other message from background to iframe (within injectSidebar):', message);
          iframe.contentWindow.postMessage(message, '*');
        }
        sendResponse({ ack: true, note: "Message relayed or unhandled by content script specific logic (within injectSidebar)." });
      }
      // Ensure a consistent return value for the listener if not returning true for async
      return false;
    });
}

// Ensure injection happens after the page is fully loaded
// or when WhatsApp Web dynamically loads its UI.

// Simple approach: try to inject when the script runs and on DOMContentLoaded
if (document.readyState === "complete" || document.readyState === "interactive") {
    injectSidebar();
} else {
    document.addEventListener("DOMContentLoaded", injectSidebar);
}

// Add MutationObserver for more reliable injection
const PANE_SIDE_SELECTOR = '#pane-side'; // More specific selector for the chat list pane

const appObserver = new MutationObserver((mutations, observer) => {
    if (document.querySelector(PANE_SIDE_SELECTOR) && !document.getElementById(SIDEBAR_ID)) {
        console.log("WhatsApp main chat UI detected (#pane-side), injecting sidebar...");
        injectSidebar();
        
        // Attempt to disconnect observer after successful injection,
        // but with a small delay to ensure everything is settled.
        setTimeout(() => {
            if (document.getElementById(SIDEBAR_ID)) {
                console.log("Sidebar injected, disconnecting observer.");
                observer.disconnect();
            } else {
                console.warn("Sidebar injection might have failed after #pane-side detection.");
                // Optionally, try one more time or log an error
                // injectSidebar();
            }
        }, 500); // Increased delay for stability
    }
});

// Start observing the document body for when WhatsApp Web loads its UI
// Observe for changes deeper in the tree as #pane-side might be added later.
appObserver.observe(document.documentElement, { childList: true, subtree: true });


// Fallback/Retry mechanism using the more specific selector
const injectionInterval = setInterval(() => {
    if (document.body && !document.getElementById(SIDEBAR_ID) && document.querySelector(PANE_SIDE_SELECTOR)) {
        console.log("WhatsApp #pane-side element found via interval, attempting to inject sidebar.");
        injectSidebar();
    }
    // Clear interval if sidebar is found, regardless of how it was injected
    if(document.getElementById(SIDEBAR_ID)){
        console.log("Sidebar found, clearing injection interval.");
        clearInterval(injectionInterval);
        // Also disconnect observer if it's still running and sidebar is now present
        if (appObserver) appObserver.disconnect();
    }
}, 1500); // Try every 1.5 seconds

// Clear interval and observer after some time to prevent indefinite running
setTimeout(() => {
    if (injectionInterval) clearInterval(injectionInterval);
    if (appObserver) appObserver.disconnect();
    console.log("Stopped injection attempts after timeout.");
}, 30000); // Stop after 30 seconds


// Notify background that content script is ready (for robust handshake)
try {
  chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[AI Co-Pilot] Error sending CONTENT_SCRIPT_READY:', chrome.runtime.lastError.message);
    } else {
      console.log('[AI Co-Pilot] Sent CONTENT_SCRIPT_READY to background');
    }
  });
} catch (e) {
  console.error('[AI Co-Pilot] Exception sending CONTENT_SCRIPT_READY:', e);
} 

// Add a chrome.runtime.onMessage listener that logs and relays to iframe
