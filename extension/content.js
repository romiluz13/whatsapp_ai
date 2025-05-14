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
    let currentSidebarWidth = parseInt(localStorage.getItem('whatsappAiCopilotSidebarWidth')) || 450;
    // Side is now fixed to 'right'
    // let currentSidebarSide = localStorage.getItem('whatsappAiCopilotSidebarSide') || 'right';
    const currentSidebarSide = 'right'; // Fixed
    let isSidebarCollapsed = localStorage.getItem('whatsappAiCopilotSidebarCollapsed') === 'true';
    let lastNonCollapsedWidth = currentSidebarWidth;

    const minSidebarWidth = 200;
    const maxSidebarWidth = 800;

    function saveSidebarState() {
        localStorage.setItem('whatsappAiCopilotSidebarWidth', currentSidebarWidth);
        // localStorage.setItem('whatsappAiCopilotSidebarSide', currentSidebarSide); // Side is fixed
        localStorage.setItem('whatsappAiCopilotSidebarCollapsed', isSidebarCollapsed);
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
            sidebarContainer.style.width = `${currentSidebarWidth}px`;
        }
        // Side-specific styling (left/right) is removed as it's fixed to right
    }
    applySidebarStyling();

    // Create a resizer element (always for right-side panel)
    const resizer = document.createElement('div');
    function updateResizerStyle() {
        resizer.style.position = 'absolute';
        resizer.style.top = '0';
        resizer.style.width = '5px';
        resizer.style.height = '100%';
        resizer.style.cursor = 'col-resize';
        resizer.style.background = '#e0e0e0';
        resizer.style.zIndex = '1001';
        resizer.style.borderLeft = '1px solid #c0c0c0';
        resizer.style.borderRight = '1px solid #c0c0c0';
        if (isSidebarCollapsed) {
            resizer.style.display = 'none';
        } else {
            resizer.style.display = 'block';
            resizer.style.left = '-2px'; // Fixed for right-side panel
            resizer.style.right = 'auto';
        }
    }
    updateResizerStyle();
    sidebarContainer.appendChild(resizer);

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
        const bodyStyle = document.body.style;
        const appWrapper = document.querySelector('.app-wrapper-web');

        bodyStyle.boxSizing = 'border-box'; // Ensure padding is included in width calculations correctly
        bodyStyle.transition = 'padding-right 0.2s ease-out'; // Smooth transition for body padding

        if (isSidebarCollapsed) {
            bodyStyle.paddingRight = '0px';
            if (appWrapper) {
                // Adjust appWrapper to be to the left of the (now collapsed) sidebar
                appWrapper.style.setProperty('right', '0px', 'important');
                appWrapper.style.setProperty('width', 'auto', 'important'); // Assumes appWrapper has left:0 or similar
                appWrapper.style.removeProperty('margin-right');
            }
        } else {
            bodyStyle.paddingRight = `${currentSidebarWidth}px`; // Keep for other potential elements
            if (appWrapper) {
                // Adjust appWrapper to be to the left of the visible sidebar
                // This assumes appWrapper is positioned e.g. left:0, top:0, bottom:0
                // and its width can be controlled by setting its 'right' offset.
                appWrapper.style.setProperty('right', `${currentSidebarWidth}px`, 'important');
                appWrapper.style.setProperty('width', 'auto', 'important'); // Let left:0 and new right:Wpx define width
                appWrapper.style.removeProperty('margin-right');
            }
        }
    }

    // Initial adjustment
    adjustWhatsAppLayout();


    // Inject into the body of the page
    document.body.appendChild(sidebarContainer);
    sidebarInjected = true;
    console.log("Sidebar container, resizer, and iframe injected. Initial state:", { currentSidebarWidth, currentSidebarSide, isSidebarCollapsed });

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


    // Resizer logic
    let isResizing = false;
    let initialMouseX = 0;
    let initialSidebarWidth = 0;

    resizer.addEventListener('mousedown', (e) => {
        if (isSidebarCollapsed) return; // Don't allow resizing if collapsed

        isResizing = true;
        initialMouseX = e.clientX;
        initialSidebarWidth = sidebarContainer.offsetWidth;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        const onMouseMove = (moveEvent) => {
            if (!isResizing) return;
            // Simplified for right-side panel: dragging left decreases width.
            const dx = initialMouseX - moveEvent.clientX;
            let newWidth = initialSidebarWidth + dx;


            if (newWidth < minSidebarWidth) newWidth = minSidebarWidth;
            if (newWidth > maxSidebarWidth) newWidth = maxSidebarWidth;
            
            sidebarContainer.style.width = `${newWidth}px`;
            currentSidebarWidth = newWidth;
            lastNonCollapsedWidth = newWidth; // Update for when expanding
            adjustWhatsAppLayout();
        };

        const onMouseUp = () => {
            if (!isResizing) return;
            isResizing = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            saveSidebarState();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

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
            
            // --- Add detailed logging ---
            console.log('[Content Script] State before visibility toggle logic:');
            console.log('  typeof currentSidebarWidth:', typeof currentSidebarWidth, ', value:', currentSidebarWidth);
            console.log('  typeof lastNonCollapsedWidth:', typeof lastNonCollapsedWidth, ', value:', lastNonCollapsedWidth);
            console.log('  isSidebarCollapsed:', isSidebarCollapsed);
            // --- End detailed logging ---

            if (isSidebarCollapsed) {
                // When collapsing, currentSidebarWidth holds the width *before* collapse.
                // Store it as lastNonCollapsedWidth if it's a valid width.
                if (currentSidebarWidth > 50) {
                     lastNonCollapsedWidth = currentSidebarWidth;
                }
                // currentSidebarWidth variable continues to hold the "expanded" target width.
                // applySidebarStyling will handle making it visually 0px.
            } else {
                // When expanding, restore currentSidebarWidth to the last known good non-collapsed width.
                currentSidebarWidth = (lastNonCollapsedWidth > 50) ? lastNonCollapsedWidth : (parseInt(localStorage.getItem('whatsappAiCopilotSidebarWidth')) || 450);
            }

            console.log('[Content Script] State after visibility toggle logic:');
            console.log('  new currentSidebarWidth:', currentSidebarWidth);
            console.log('  new lastNonCollapsedWidth:', lastNonCollapsedWidth);

            applySidebarStyling();
            updateResizerStyle();
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
        
        // Toggle the collapsed state
        isSidebarCollapsed = !isSidebarCollapsed;
        console.log('[Content Script] New collapsed state:', isSidebarCollapsed);

        if (isSidebarCollapsed) {
          if (currentSidebarWidth > 50) {
            lastNonCollapsedWidth = currentSidebarWidth;
          }
        } else {
          currentSidebarWidth = (lastNonCollapsedWidth > 50) ? lastNonCollapsedWidth : (parseInt(localStorage.getItem('whatsappAiCopilotSidebarWidth')) || 450);
        }
        console.log('[Content Script] New currentSidebarWidth:', currentSidebarWidth, 'New lastNonCollapsedWidth:', lastNonCollapsedWidth);

        applySidebarStyling();
        updateResizerStyle();
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
