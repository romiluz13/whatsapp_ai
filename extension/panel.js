/**
 * WhatsApp AI Co-Pilot - Sidebar Interactions
 */

// This script will be injected by content.js and will handle sidebar interactions

// Sidebar animation variables
let sidebarOpen = true;
const BACKEND_URL = 'http://localhost:3000';
let currentSelectedChatId = null; // Stores the ID of the currently selected chat
let currentSelectedChatName = null; // Stores the name of the currently selected chat
let fetchedMessagesForSelectedChat = []; // Stores messages for AI processing (role might change)

// NEW: Date filter elements
let startDateInput, endDateInput, clearDatesButton, dateFilterAreaEl;

// DOM element references for chat selection and status
let chatSelectorDropdown, whatsappStatusArea, whatsappConnectionStatus, whatsappQrCodeArea, whatsappQrCodeImg, chatSelectorArea, summarizeButton, askQuestionButton, aiQueryInput, aiChatMessagesDiv, foldButtonElement; // Removed groupInsightsSection

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  chatSelectorDropdown = document.getElementById('chat-selector');
  whatsappStatusArea = document.getElementById('whatsapp-status-area');
  whatsappConnectionStatus = document.getElementById('whatsapp-connection-status');
  whatsappQrCodeArea = document.getElementById('whatsapp-qr-code-area');
  whatsappQrCodeImg = document.getElementById('whatsapp-qr-code-img'); // This is a div now
  chatSelectorArea = document.getElementById('chat-selector-area');
  
  summarizeButton = document.getElementById('summarize-group-button');
  askQuestionButton = document.getElementById('ask-question-button');
  aiQueryInput = document.getElementById('ai-query-input');
  // groupInsightsSection = document.getElementById('group-insights-section'); // Removed
  aiChatMessagesDiv = document.getElementById('ai-chat-messages');
  // switchSideButton = document.getElementById('switch-side-button'); // Removed
  foldButtonElement = document.getElementById('fold-button');

  // NEW: Get date filter elements
  startDateInput = document.getElementById('startDate');
  endDateInput = document.getElementById('endDate');
  clearDatesButton = document.getElementById('clear-dates-button');
  dateFilterAreaEl = document.getElementById('date-filter-area');

  // NEW: Add event listener for Clear Dates button
  if (clearDatesButton) {
    clearDatesButton.addEventListener('click', () => {
        if (startDateInput) startDateInput.value = '';
        if (endDateInput) endDateInput.value = '';
        // Note: This does not automatically re-trigger a message load or AI op.
        // The next Summarize/Ask will use the now-cleared dates.
    });
  }


  // Create and show a loading indicator immediately when the panel loads
  waitForSidebarAndSetup();

  // Add event listeners for sidebar controls

  // Simplified: panel is always on the right
  function updateFoldButtonIcon(isCollapsed) {
    if (foldButtonElement) {
        const icon = foldButtonElement.querySelector('i');
        if (isCollapsed) {
            icon.className = 'fas fa-chevron-left'; // Icon to open (panel is on right)
        } else {
            icon.className = 'fas fa-chevron-right'; // Icon to close (panel is on right)
        }
    }
  }
  
  // Request initial state from content script or read from storage
  // updateFoldButtonIcon(isSidebarCollapsed); // Initial call based on persisted state


  function handleToggleSidebarVisibility() {
    sidebarOpen = !sidebarOpen;
    window.parent.postMessage({ action: 'toggleSidebarVisibility', isCollapsed: !sidebarOpen }, '*');
    // Icon update will be handled by 'updatePanelControls' message from content.js
  }

  if (foldButtonElement) {
    foldButtonElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleToggleSidebarVisibility();
    });
  }

  // Removed switchSideButton listener

  // Listen for messages from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) {
        return;
    }
    const message = event.data;
    if (message && message.action === 'updatePanelControls') {
        // let currentSidebarSide = message.side; // Side is now fixed
        let isSidebarCollapsed = message.isCollapsed;
        sidebarOpen = !isSidebarCollapsed;
        updateFoldButtonIcon(isSidebarCollapsed); // Side parameter removed
    }
  });
  
});

/**
 * Updates the WhatsApp connection status display in the panel.
 * @param {string} message - The message to display.
 * @param {boolean} [isError=false] - Whether the message represents an error state.
 */
function updateWhatsappConnectionStatus(message, isError = false) {
    if (whatsappConnectionStatus) {
        whatsappConnectionStatus.textContent = message;
        whatsappConnectionStatus.className = isError ? 'status-error' : 'status-ok'; // Assuming CSS classes for styling
    }
    // const groupInsightsControls = document.getElementById('group-insights-section'); // Removed
  
    if (isError) {
      if(chatSelectorArea) chatSelectorArea.style.display = 'none';
      if(whatsappQrCodeArea) whatsappQrCodeArea.style.display = 'block';
      // if(groupInsightsControls) groupInsightsControls.style.display = 'none'; // Removed
      if(summarizeButton) summarizeButton.style.display = 'none';
      if(dateFilterAreaEl) dateFilterAreaEl.style.display = 'none'; // NEW: Hide date filter
      const chatInputArea = document.querySelector('.chat-input-area');
      if(chatInputArea) chatInputArea.style.display = 'none';
    } else {
      // Visibility handled by other functions
    }
}

/**
 * Fetches a QR code from the backend and displays it in the panel.
 * Handles errors during fetching or rendering.
 */
async function fetchAndDisplayQrCode() {
    if (!whatsappQrCodeImg || !whatsappQrCodeArea || !whatsappConnectionStatus) {
        console.error("QR display elements not found.");
        return;
    }
    try {
        updateWhatsappConnectionStatus('Fetching QR code...');
        const response = await fetch(`${BACKEND_URL}/auth/qr`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to fetch QR code details.' }));
            throw new Error(errorData.error || `HTTP error ${response.status}`);
        }
        const data = await response.json();
        if (data.qrCode) {
            // Ensure qrcode.js is loaded (typically via panel-inline.js or a direct script tag in panel.html)
            if (typeof QRCode !== 'undefined') {
                whatsappQrCodeImg.innerHTML = ''; // Clear previous QR
                new QRCode(whatsappQrCodeImg, {
                    text: data.qrCode,
                    width: 180, 
                    height: 180,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
                // whatsappQrCodeImg.style.display = 'block'; // Parent div controls visibility
                updateWhatsappConnectionStatus('Scan QR code with WhatsApp.');
                whatsappQrCodeArea.style.display = 'block';
                if(chatSelectorArea) chatSelectorArea.style.display = 'none';
                // if(groupInsightsSection) groupInsightsSection.style.display = 'none'; // Removed
                if(summarizeButton) summarizeButton.style.display = 'none';
                if(dateFilterAreaEl) dateFilterAreaEl.style.display = 'none'; // NEW: Hide date filter
                const chatInputArea = document.querySelector('.chat-input-area');
                if(chatInputArea) chatInputArea.style.display = 'none';
            } else {
                whatsappQrCodeImg.innerHTML = 'QR Library not loaded.';
                updateWhatsappConnectionStatus('QR library missing. Check console.', true);
                console.error("QRCode library is not loaded. Ensure qrcode.min.js is included and loaded before this script.");
                console.log("RAW QR DATA (for manual use with a QR generator):", data.qrCode);
            }
        } else {
            updateWhatsappConnectionStatus('QR code not available from backend.', false); // Not necessarily an error if client is already auth'd
            whatsappQrCodeArea.style.display = 'none';
        }
    } catch (error) {
        console.error('Error fetching or displaying QR code:', error);
        updateWhatsappConnectionStatus(`Error fetching QR: ${error.message}`, true);
        whatsappQrCodeArea.style.display = 'none';
    }
}

/**
 * Fetches the list of WhatsApp groups from the backend and populates the selector.
 * Handles connection status and errors.
 */
async function fetchGroups() {
    if (!isBackendConnected()) { // Assumes isBackendConnected function exists
        updateWhatsappConnectionStatus('Backend not connected. Cannot fetch groups.', true);
        return;
    }
    try {
        updateWhatsappConnectionStatus('Fetching group list...');
        console.log(`[PANEL.JS] Attempting to fetch groups from ${BACKEND_URL}/groups`); // Log before fetch
        const response = await fetch(`${BACKEND_URL}/groups`);
        console.log(`[PANEL.JS] Response status from /groups: ${response.status}`); // Log response status

        if (!response.ok) {
            let errorText = `HTTP error ${response.status}`;
            try {
                const errorData = await response.json();
                errorText = errorData.error || JSON.stringify(errorData) || errorText;
            } catch (e) {
                // If response.json() fails, use the raw text
                try {
                    errorText = await response.text() || errorText;
                } catch (e2) { /* ignore further errors */ }
            }
            console.error(`[PANEL.JS] Error fetching groups. Status: ${response.status}, Message: ${errorText}`);
            throw new Error(errorText);
        }

        const groups = await response.json();
        console.log('[PANEL.JS] Fetched groups successfully. Raw data:', JSON.stringify(groups, null, 2));
        populateChatSelector(groups);

        if (groups && Array.isArray(groups) && groups.length > 0) {
            console.log('[PANEL.JS] Groups array is valid and has items. Updating UI.');
            updateWhatsappConnectionStatus('WhatsApp Connected. Select a group.');
            if(chatSelectorArea) chatSelectorArea.style.display = 'block';
            if(whatsappQrCodeArea) whatsappQrCodeArea.style.display = 'none';
        } else {
            console.log('[PANEL.JS] No groups found, groups array is empty, or not an array. Updating UI.');
            updateWhatsappConnectionStatus('WhatsApp Connected. No groups found or accessible.');
            if(chatSelectorArea) chatSelectorArea.style.display = 'block'; // Show selector even if empty
            if(whatsappQrCodeArea) whatsappQrCodeArea.style.display = 'none';
        }
        console.log('[PANEL.JS] fetchGroups: Hiding initial loading indicator.');
        hideInitialLoadingIndicator();
    } catch (error) {
        // Ensure error is an Error object with a message property
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[PANEL.JS] CATCH BLOCK - Error fetching groups:', errorMessage, error);
        updateWhatsappConnectionStatus(`Error fetching groups: ${errorMessage}`, true);
        populateChatSelector([]);
        console.log('[PANEL.JS] fetchGroups CATCH BLOCK: Hiding initial loading indicator.');
        hideInitialLoadingIndicator();
    }
}


/**
 * Populates the chat selector dropdown with the given list of groups.
 * @param {Array<Object>} groups - An array of group objects, each with id and name.
 */
function populateChatSelector(groups) {
    if (!chatSelectorDropdown) return;

    const previouslySelectedId = currentSelectedChatId;
    chatSelectorDropdown.innerHTML = ''; 

    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = groups && groups.length > 0 ? "-- Select a Group --" : "-- No Groups Available --";
    chatSelectorDropdown.appendChild(defaultOption);

    if (groups && Array.isArray(groups) && groups.length > 0) {
        groups.forEach(group => {
            if (group && group.id && group.name) { 
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name; 
                chatSelectorDropdown.appendChild(option);
            }
        });
        if (previouslySelectedId) {
            chatSelectorDropdown.value = previouslySelectedId;
            if (chatSelectorDropdown.value !== previouslySelectedId) {
                 currentSelectedChatId = ""; 
            }
        }
    }
    // Visibility of chatSelectorArea is handled by fetchGroups
}


/**
 * Waits for the main panel DOM to be ready, then initializes various UI components and listeners.
 * This function acts as the entry point for setting up the panel's dynamic behavior.
 */
function waitForSidebarAndSetup() {
    const panel = document.getElementById('ai-copilot-panel');
    if (!panel) {
        setTimeout(waitForSidebarAndSetup, 50);
        return;
    }
    showInitialLoadingIndicator();
    // setupSidebarToggle(); // Removed, handled in DOMContentLoaded
    setupChatInterface(); 
    attachLoadingIndicators(); 
    addRefreshButton(); 
    initAuthAndGroupListing(); // Sets up group selection listener
    
    checkBackendAndWhatsAppStatus(); // Initial check

    const messageList = document.querySelector('.message-list');
    if (messageList && messageList.childElementCount === 0) { // Check specific message list
        addMessageToChat('assistant', "Welcome! Connect to WhatsApp and select a group to begin.");
    }
    
    setInterval(checkBackendAndWhatsAppStatus, 15000); // Poll for status
    setTimeout(setupNewFeatureButtons, 100); // Setup AI buttons
}

// --- START: AI Interaction Functions ---

/**
 * Shows a loading state for AI features (Summarize or Ask Question).
 * Disables the button and input, and shows a spinner.
 * @param {'summarize' | 'ask'} feature - The AI feature being loaded.
 */
function showAILoading(feature) {
    if (feature === 'summarize' && summarizeButton) {
        summarizeButton.disabled = true;
        summarizeButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> מסכם...`; // Translated
    } else if (feature === 'ask' && askQuestionButton) {
        askQuestionButton.disabled = true;
        // askQuestionButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> שואל...`; // Icon only for ask button now
        if (aiQueryInput) aiQueryInput.disabled = true;
    }
}

/**
 * Hides the loading state for AI features.
 * Re-enables the button and input, and restores original button text.
 * Also re-evaluates the enabled/disabled state of AI controls based on message availability.
 * @param {'summarize' | 'ask'} feature - The AI feature that has finished loading.
 */
function hideAILoading(feature) {
    // const messagesAvailable = fetchedMessagesForSelectedChat.length > 0; // OLD
    const messagesAvailable = !!currentSelectedChatId; // NEW: Enable if a chat is selected
    const chatInputArea = document.querySelector('.chat-input-area');

    if (feature === 'summarize' && summarizeButton) {
        summarizeButton.disabled = !messagesAvailable;
        summarizeButton.innerHTML = `<i class="fas fa-file-alt"></i> סכם קבוצה`; // Translated
        summarizeButton.style.display = currentSelectedChatId ? 'flex' : 'none'; // Show summarize if group selected
    } else if (feature === 'ask' && askQuestionButton) {
        askQuestionButton.disabled = !messagesAvailable;
        // askQuestionButton.innerHTML = `<i class="fas fa-paper-plane"></i>`; // Icon is set in HTML
        if (aiQueryInput) aiQueryInput.disabled = !messagesAvailable;
    }
    
    if (chatInputArea) {
        chatInputArea.style.display = currentSelectedChatId ? 'flex' : 'none';
    }
    // Ensure summarize button is also controlled by group selection
    if(summarizeButton) {
        summarizeButton.style.display = currentSelectedChatId ? 'flex' : 'none';
        summarizeButton.disabled = !messagesAvailable;
    }
}


/**
 * Sets up event listeners for the AI feature buttons (Summarize Group, Ask Question).
 * Handles API calls to the backend for these features and updates the UI.
 */

// NEW: Validation function for DD/MM/YYYY format
function isValidDdMmYyyy(dateString) {
    if (!dateString) return true; // Allow empty (no date provided)
    const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const parts = dateString.match(regex);
    if (!parts) return false;

    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10); // Month is 1-12 from input
    const year = parseInt(parts[3], 10);

    if (year < 1000 || year > 3000 || month === 0 || month > 12) return false;

    const monthLength = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)) {
        monthLength[1] = 29; // Leap year
    }
    return day > 0 && day <= monthLength[month - 1];
}

function setupNewFeatureButtons() {
    if (!summarizeButton || !askQuestionButton || !aiQueryInput) {
        console.error('AI feature buttons or input not found in DOM.');
        return;
    }

    // Initial state handled by hideAILoading called after message fetch
    hideAILoading('summarize'); // Set initial state
    hideAILoading('ask');       // Set initial state

    summarizeButton.addEventListener('click', async () => {
        if (!currentSelectedChatId) {
            addMessageToChat('assistant', 'יש לבחור קבוצה לפני בקשת סיכום.', true);
            return;
        }

        const startDate = startDateInput ? startDateInput.value.trim() : null;
        const endDate = endDateInput ? endDateInput.value.trim() : null;

        if ((startDate && !isValidDdMmYyyy(startDate)) || (endDate && !isValidDdMmYyyy(endDate))) {
            addMessageToChat('assistant', 'פורמט תאריך לא תקין. אנא השתמש בפורמט DD/MM/YYYY או השאר ריק.', true); // Translated
            return;
        }
        
        // If only one date is provided, decide if that's an error or a specific behavior
        // For now, we allow one date to be set (backend handles this as open-ended range if service supports it)

        addMessageToChat('user', `מבקש סיכום עבור ${currentSelectedChatName || 'הקבוצה הנבחרת'}${startDate || endDate ? ` (תאריכים: ${startDate || ''} - ${endDate || ''})` : ''}.`);
        showAILoading('summarize');
        try {
            const response = await fetch(`${BACKEND_URL}/ai/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: currentSelectedChatId,
                    startDate: startDate || null, // Send null if empty
                    endDate: endDate || null     // Send null if empty
                })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `HTTP error ${response.status}`);
            }
            addMessageToChat('assistant', `סיכום עבור ${currentSelectedChatName}:\n${data.summary}`); // Translated
        } catch (error) {
            console.error('Error summarizing group:', error);
            addMessageToChat('assistant', `שגיאה בסיכום: ${error.message}`, true); // Translated
        } finally {
            hideAILoading('summarize');
        }
    });

    askQuestionButton.addEventListener('click', async () => {
        const question = aiQueryInput.value.trim();
        if (!question) {
            addMessageToChat('assistant', 'יש להקליד שאלה תחילה.', true); // Translated
            return;
        }
        if (!currentSelectedChatId) {
            addMessageToChat('assistant', 'יש לבחור קבוצה עם הודעות לפני שליחת שאלה.', true);
            return;
        }
        
        const startDate = startDateInput ? startDateInput.value.trim() : null;
        const endDate = endDateInput ? endDateInput.value.trim() : null;

        if ((startDate && !isValidDdMmYyyy(startDate)) || (endDate && !isValidDdMmYyyy(endDate))) {
            addMessageToChat('assistant', 'פורמט תאריך לא תקין. אנא השתמש בפורמט DD/MM/YYYY או השאר ריק.', true); // Translated
            return;
        }

        addMessageToChat('user', `שאלה: ${question}${startDate || endDate ? ` (בהקשר תאריכים: ${startDate || ''} - ${endDate || ''})` : ''}`);
        showAILoading('ask');
        
        try {
            const response = await fetch(`${BACKEND_URL}/ai/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: currentSelectedChatId,
                    question: question,
                    startDate: startDate || null, // Send null if empty
                    endDate: endDate || null     // Send null if empty
                })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `HTTP error ${response.status}`);
            }
            addMessageToChat('assistant', `תשובה:\n${data.answer}`); // Translated
            aiQueryInput.value = '';
        } catch (error) {
            console.error('Error asking question:', error);
            addMessageToChat('assistant', `שגיאה בקבלת תשובה: ${error.message}`, true); // Translated
        } finally {
            hideAILoading('ask');
        }
    });
}

// --- END: AI Interaction Functions ---

/**
 * Checks the backend server connection status and then the WhatsApp client status.
 * Updates the UI accordingly, fetching QR code or groups as needed.
 * This function is polled periodically.
 */
async function checkBackendAndWhatsAppStatus() {
    // console.log('[PANEL.JS] Checking backend and WhatsApp status...');
    const backendOk = await checkBackendConnection();
    if (backendOk) {
        try {
            const response = await fetch(`${BACKEND_URL}/auth/status`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to get WhatsApp status details.' }));
                throw new Error(errorData.message || `HTTP error ${response.status}`);
            }
            const status = await response.json();
            updateWhatsappConnectionStatus(status.message, !status.ready && !status.qrCodeAvailable);

            if (status.ready) {
                if(whatsappQrCodeArea) whatsappQrCodeArea.style.display = 'none';
                fetchGroups();
            } else if (status.qrCodeAvailable) {
                if(chatSelectorArea) chatSelectorArea.style.display = 'none';
                // if(groupInsightsSection) groupInsightsSection.style.display = 'none'; // Removed
                if(summarizeButton) summarizeButton.style.display = 'none';
                if(dateFilterAreaEl) dateFilterAreaEl.style.display = 'none'; // Ensure date filter is hidden
                const chatInputArea = document.querySelector('.chat-input-area');
                if(chatInputArea) chatInputArea.style.display = 'none';
                fetchAndDisplayQrCode();
            } else {
                // This case implies not ready and no QR, so hide most controls
                if(whatsappQrCodeArea) whatsappQrCodeArea.style.display = 'none';
                if(chatSelectorArea) chatSelectorArea.style.display = 'none';
                // if(groupInsightsSection) groupInsightsSection.style.display = 'none'; // Removed
                if(summarizeButton) summarizeButton.style.display = 'none';
                if(dateFilterAreaEl) dateFilterAreaEl.style.display = 'none';
                const chatInputArea = document.querySelector('.chat-input-area');
                if(chatInputArea) chatInputArea.style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking WhatsApp status:', error);
            updateWhatsappConnectionStatus(`Error checking WhatsApp: ${error.message}`, true);
            if(whatsappQrCodeArea) whatsappQrCodeArea.style.display = 'none';
            if(chatSelectorArea) chatSelectorArea.style.display = 'none';
            // if(groupInsightsSection) groupInsightsSection.style.display = 'none'; // Removed
            if(summarizeButton) summarizeButton.style.display = 'none';
            if(dateFilterAreaEl) dateFilterAreaEl.style.display = 'none'; // NEW: Hide date filter
            const chatInputArea = document.querySelector('.chat-input-area');
            if(chatInputArea) chatInputArea.style.display = 'none';
        }
    } else {
        updateWhatsappConnectionStatus('Backend not connected. Cannot check WhatsApp status.', true);
        if(whatsappQrCodeArea) whatsappQrCodeArea.style.display = 'none';
        if(chatSelectorArea) chatSelectorArea.style.display = 'none';
        // if(groupInsightsSection) groupInsightsSection.style.display = 'none'; // Removed
        if(summarizeButton) summarizeButton.style.display = 'none';
        if(dateFilterAreaEl) dateFilterAreaEl.style.display = 'none'; // NEW: Hide date filter
        const chatInputArea = document.querySelector('.chat-input-area');
        if(chatInputArea) chatInputArea.style.display = 'none';
    }
    hideInitialLoadingIndicator(); 
}


/**
 * Initializes the authentication flow and group listing functionality.
 * Sets up an event listener for the group selector dropdown to fetch messages
 * for the selected group.
 */
function initAuthAndGroupListing() {
    // console.log('[PANEL.JS] Initializing Auth and Group Listing (New Flow)...');
    // checkBackendAndWhatsAppStatus(); // Called by waitForSidebarAndSetup

    if (chatSelectorDropdown) {
        chatSelectorDropdown.addEventListener('change', async () => { 
            currentSelectedChatId = chatSelectorDropdown.value;
            const selectedOption = chatSelectorDropdown.options[chatSelectorDropdown.selectedIndex];
            currentSelectedChatName = selectedOption ? selectedOption.text.split(' (')[0] : null; // Keep name for display
            
            // const groupInsightsControls = document.getElementById('group-insights-section'); // Removed
            const chatInputArea = document.querySelector('.chat-input-area');


            if (currentSelectedChatId) {
                console.log(`[PANEL.JS] Group selected: ${currentSelectedChatName} (ID: ${currentSelectedChatId})`);
                showStatus(`טוען הודעות עבור ${currentSelectedChatName}...`); // Translated
                fetchedMessagesForSelectedChat = [];
                
                // Show summarize button, date filter, and chat input area
                if(summarizeButton) summarizeButton.style.display = 'flex'; else console.warn("Summarize button not found for display styling");
                if(dateFilterAreaEl) dateFilterAreaEl.style.display = 'block'; // Ensure date filter is shown
                if(chatInputArea) chatInputArea.style.display = 'flex'; else console.warn("Chat input area not found for display styling");

                // fetchedMessagesForSelectedChat is no longer populated here directly for AI ops.
                // The AI buttons will now trigger fetches with date ranges.
                // We still call hideAILoading to correctly set button states based on chat selection.
                hideAILoading('summarize');
                hideAILoading('ask');

                // The message fetching logic below is now primarily for display/context,
                // not directly for AI operations which will re-fetch with dates.
                // However, keeping it can be useful for general context or if other features use it.
                // For this iteration, we'll keep it, but AI ops will ignore fetchedMessagesForSelectedChat.
                try {
                    const messageCount = 1000;
                    const response = await fetch(`${BACKEND_URL}/groups/${currentSelectedChatId}/messages?count=${messageCount}`);
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch messages.' }));
                        throw new Error(errorData.error || `HTTP error ${response.status}`);
                    }
                    const messages = await response.json();
                    fetchedMessagesForSelectedChat = messages;
                    console.log(`[PANEL.JS] Fetched ${fetchedMessagesForSelectedChat.length} messages for ${currentSelectedChatName}`);
                    showStatus(`${fetchedMessagesForSelectedChat.length} הודעות נטענו עבור ${currentSelectedChatName}. מוכן לפעולות AI.`); // Translated
                    
                    // Re-evaluate button states now that messages are fetched (or not)
                    hideAILoading('summarize'); // Will enable/disable based on fetchedMessagesForSelectedChat
                    hideAILoading('ask');       // Will enable/disable based on fetchedMessagesForSelectedChat

                } catch (error) {
                    console.error('[PANEL.JS] Error fetching messages:', error);
                    showStatus(`שגיאה בטעינת הודעות: ${error.message}`, true); // Translated
                    fetchedMessagesForSelectedChat = [];
                    hideAILoading('summarize'); // Will disable buttons
                    hideAILoading('ask');
                }
            } else { // No group selected
                currentSelectedChatName = null;
                fetchedMessagesForSelectedChat = [];
                if(summarizeButton) summarizeButton.style.display = 'none';
                if(dateFilterAreaEl) dateFilterAreaEl.style.display = 'none'; // Ensure date filter is hidden
                if(chatInputArea) chatInputArea.style.display = 'none';
                showStatus('לא נבחרה קבוצה.'); // Translated
                // Also update AI button states when no group is selected
                hideAILoading('summarize');
                hideAILoading('ask');
            }
        });
    }
}


let backendConnected = false; 

/**
 * Checks the connection to the backend server by hitting the /health endpoint.
 * Updates the debug connection info in the panel footer.
 * @returns {Promise<boolean>} True if backend is connected, false otherwise.
 */
async function checkBackendConnection() {
  const debugInfo = document.getElementById('debug-connection-info');
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    if (response.ok) {
      // const data = await response.json(); // Not strictly needed if only checking status
      if (debugInfo) {
        debugInfo.textContent = `Backend: Connected`;
        debugInfo.style.color = 'green';
      }
      backendConnected = true;
      return true;
    } else {
      if (debugInfo) {
        debugInfo.textContent = `Backend: Failed (Status ${response.status})`;
        debugInfo.style.color = 'red';
      }
      backendConnected = false;
      return false;
    }
  } catch (error) {
    if (debugInfo) {
        debugInfo.textContent = `Backend: Error (${error.message.substring(0,20)}...)`;
        debugInfo.style.color = 'red';
    }
    backendConnected = false;
    return false;
  }
}
/**
 * Returns the current connection state to the backend.
 * @returns {boolean} True if backend is considered connected, false otherwise.
 */
function isBackendConnected() { return backendConnected; }


/**
 * Shows an initial loading indicator overlay on the panel.
 */
function showInitialLoadingIndicator() {
  if (document.querySelector('.initial-loading-indicator')) return;
  const indicator = document.createElement('div');
  indicator.className = 'initial-loading-indicator';
  indicator.innerHTML = `<div class="spinner"></div><p>Initializing WhatsApp Insights AI...</p>`;
  document.body.appendChild(indicator);
  // CSS for .initial-loading-indicator and .spinner should be in panel.css
} 

/**
 * Hides the initial loading indicator overlay from the panel.
 */
function hideInitialLoadingIndicator() {
  const indicator = document.querySelector('.initial-loading-indicator');
  if (indicator) indicator.remove();
}

/**
 * Displays a status message in the AI interaction area.
 * Messages auto-hide after a few seconds unless they are errors.
 * @param {string} message - The status message to display.
 * @param {boolean} [isError=false] - Whether the message represents an error.
 */
function showStatus(message, isError = false) {
  const statusElement = document.getElementById('ai-status-message');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `status-message ${isError ? 'status-error' : 'status-ok'}`;
    statusElement.style.display = 'block';
    if (!isError) {
      setTimeout(() => { statusElement.style.display = 'none'; }, 4000);
    }
  } else {
    console.log(`Status (${isError ? 'Error' : 'Info'}): ${message}`);
  }
}

/**
 * Adds a message to the AI chat display area in the panel.
 * @param {'user' | 'assistant'} sender - The sender of the message.
 * @param {string} text - The content of the message.
 * @param {boolean} [isError=false] - If the message (usually from assistant) is an error message.
 */
function addMessageToChat(sender, text, isError = false) {
  if (!aiChatMessagesDiv) {
    console.error("Chat message display area not found");
    return;
  }

  const messageItem = document.createElement('div');
  messageItem.classList.add('message', sender === 'user' ? 'user-message' : 'assistant-message');
  if (isError) messageItem.classList.add('error-message');

  const senderNameStrong = document.createElement('strong');
  senderNameStrong.textContent = sender === 'user' ? 'You:' : 'AI Assistant:';
  
  const messageContentDiv = document.createElement('div'); // Changed from 'p' to 'div'
  messageContentDiv.classList.add('message-content'); // Add a class for specific styling
  // To render HTML (formerly Markdown), we'll use innerHTML.
  // WARNING: This assumes the AI-generated content is trusted or will be sanitized.
  // For a production app, use a sanitizer library like DOMPurify.
  messageContentDiv.innerHTML = text;


  messageItem.appendChild(senderNameStrong);
  messageItem.appendChild(messageContentDiv); // Changed from messageTextP
  aiChatMessagesDiv.appendChild(messageItem);
  aiChatMessagesDiv.scrollTop = aiChatMessagesDiv.scrollHeight; 
}

// Minimal placeholder functions to avoid errors if called
/**
 * Placeholder for any specific setup required for the chat interface beyond
 * what's handled by `addMessageToChat` and AI feature buttons.
 * Currently, primary chat display is managed by `addMessageToChat`.
 */
function setupChatInterface() {
    // console.log("setupChatInterface called. Primary chat display is #ai-chat-messages.");
    // If specific setup for a chat input form (other than Q&A) is needed, add here.
    // For now, the main message display is handled by addMessageToChat.
}

/**
 * Placeholder for attaching global loading indicators if needed.
 * Specific feature loading (Summarize, Ask) is handled by `showAILoading`/`hideAILoading`.
 */
function attachLoadingIndicators() {
    // console.log("attachLoadingIndicators called. Specific feature loading handled by showAILoading/hideAILoading.");
    // This function could manage global loading indicators if any were designed.
}

/**
 * Adds an event listener to the refresh button in the panel footer.
 * Clicking the button re-initiates the backend and WhatsApp status check.
 */
function addRefreshButton() {
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            console.log("Refresh button clicked. Re-checking status.");
            showInitialLoadingIndicator(); // Show loading while refresh happens
            checkBackendAndWhatsAppStatus();
            // hideInitialLoadingIndicator will be called by checkBackendAndWhatsAppStatus
        });
    }
}