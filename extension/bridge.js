// Bridge for messaging between the panel script and content script
window.postMessageToExtension = function(message) {
    try {
        window.postMessage({
            source: 'panel-script',
            message: message
        }, '*');
    } catch (error) {
        console.error('Error in postMessageToExtension:', error);
    }
};

// Override chrome.runtime.sendMessage in the page context
window.chromeRuntimeSendMessage = function(message, callback) {
    try {
        // Generate a random ID for this message to track the response
        const messageId = 'msg_' + Math.random().toString(36).substr(2, 9);
        
        // Store the callback
        window.pendingCallbacks = window.pendingCallbacks || {};
        window.pendingCallbacks[messageId] = callback;
        
        // Post the message to the content script with the ID
        window.postMessage({
            source: 'panel-script',
            message: {
                ...message,
                _messageId: messageId
            }
        }, '*');
        
        // Listen for the response
        const responseHandler = function(event) {
            try {
                if (event.source !== window) return;
                if (event.data.source === 'content-script' && 
                    event.data.destination === 'panel' && 
                    event.data.messageId === messageId) {
                    // Execute the callback with the response
                    if (typeof window.pendingCallbacks[messageId] === 'function') {
                        try {
                            window.pendingCallbacks[messageId](event.data.response);
                        } catch (callbackError) {
                            console.error('Error executing callback:', callbackError);
                        }
                        delete window.pendingCallbacks[messageId];
                    }
                    // Remove this specific response handler
                    window.removeEventListener('message', responseHandler);
                }
            } catch (handlerError) {
                console.error('Error in message response handler:', handlerError);
                window.removeEventListener('message', responseHandler);
            }
        };
        
        window.addEventListener('message', responseHandler);
        
        // Set a timeout to clean up if no response is received
        setTimeout(() => {
            if (window.pendingCallbacks[messageId]) {
                delete window.pendingCallbacks[messageId];
                window.removeEventListener('message', responseHandler);
                if (typeof callback === 'function') {
                    try {
                        callback({ error: 'Timeout waiting for response' });
                    } catch (timeoutError) {
                        console.error('Error executing timeout callback:', timeoutError);
                    }
                }
            }
        }, 10000); // 10 second timeout
    } catch (error) {
        console.error('Error in chromeRuntimeSendMessage:', error);
        if (typeof callback === 'function') {
            try {
                callback({ error: 'Error sending message: ' + error.message });
            } catch (callbackError) {
                console.error('Error executing error callback:', callbackError);
            }
        }
    }
};

// Safely override event handlers to prevent interference with WhatsApp
document.addEventListener('DOMContentLoaded', function() {
    // Create a global error handler for our extension to avoid affecting WhatsApp
    window.addEventListener('error', function(event) {
        // Only handle errors coming from our extension files
        if (event.filename && (
            event.filename.includes('panel.js') || 
            event.filename.includes('bridge.js') || 
            event.filename.includes('content.js')
        )) {
            console.error('WhatsApp AI Extension error:', event.error);
            event.preventDefault();
            event.stopPropagation();
            return true; // Prevent default error handler
        }
    }, true);
}); 