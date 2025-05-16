import { Client, LocalAuth, Message, Chat, GroupChat } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

let client: Client;
let qrCodeData: string | null = null;
let clientReady = false;
let clientStatusMessage = "Initializing...";

/**
 * Initializes the WhatsApp client using `whatsapp-web.js`.
 * Sets up event listeners for QR codes, authentication, readiness, and disconnection.
 * Implements a retry mechanism for initialization failures.
 * @param {number} [retries=3] - The number of retries for initialization.
 * @returns {Promise<Client>} A promise that resolves with the initialized client instance.
 * @throws Will throw an error if initialization fails after all retries.
 */
const initializeWhatsAppClient = async (retries = 3): Promise<Client> => {
    console.log('Initializing WhatsApp client...');
    const newClient = new Client({
        authStrategy: new LocalAuth({
            dataPath: ".wwebjs_auth"
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ],
            timeout: 120000
        },
        webVersionCache: {
            type: 'none'
        },
        restartOnAuthFail: true
    });

    newClient.on('qr', (qr: string) => {
        console.log('QR Code Received, scan it with your phone (also available at GET /auth/qr):');
        qrcode.generate(qr, { small: true });
        qrCodeData = qr;
        clientStatusMessage = "QR code received. Please scan.";
        clientReady = false; // Not ready until authenticated
    });

    newClient.on('loading_screen', (percent: string, message: string) => {
        console.log('LOADING SCREEN', percent, message);
        clientStatusMessage = `Loading: ${percent}% - ${message}`;
    });

    newClient.on('authenticated', () => {
        console.log('Client is authenticated!');
        clientStatusMessage = "Authenticated successfully.";
        qrCodeData = null; // Clear QR code once authenticated
    });

    newClient.on('auth_failure', (msg: string) => {
        console.error('Authentication failure:', msg);
        clientStatusMessage = `Authentication failure: ${msg}. Consider deleting .wwebjs_auth folder and restarting.`;
        clientReady = false;
        // Potentially trigger re-initialization or clear session data
        // For now, we rely on restartOnAuthFail or manual restart
    });

    newClient.on('ready', () => {
        console.log('WhatsApp client is ready!');
        clientReady = true;
        clientStatusMessage = "Client is ready and connected to WhatsApp.";
    });

    newClient.on('disconnected', (reason: string) => {
        console.log('Client was logged out or disconnected:', reason);
        clientReady = false;
        qrCodeData = null; // QR might be needed again
        clientStatusMessage = `Client disconnected: ${reason}. Attempting to reconnect...`;
        // whatsapp-web.js might handle reconnection automatically.
        // If not, a more robust retry/re-initiation logic might be needed here.
        // For now, we'll let it try to reconnect or require a server restart if it fails persistently.
    });

    try {
        console.log('Attempting to initialize WhatsApp client instance...');
        await newClient.initialize();
        client = newClient; // Assign to the outer scope client variable
        return newClient;
    } catch (err: any) {
        console.error("Client initialization error:", err);
        clientStatusMessage = `Client initialization error: ${err?.message || 'Unknown error'}`;
        if (retries > 0) {
            console.log(`Initialization failed. Retrying in 10 seconds... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            return initializeWhatsAppClient(retries - 1);
        } else {
            console.error("Maximum retries reached. Could not initialize WhatsApp client.");
            // Keep clientStatusMessage as is, indicating the final error.
            throw err; // Propagate the error to be handled by the caller
        }
    }
};

/**
 * Retrieves the initialized WhatsApp client instance.
 * @returns {Client} The WhatsApp client instance.
 * @throws Will throw an error if the client is not initialized.
 */
const getClient = (): Client => {
    if (!client) {
        throw new Error("WhatsApp client is not initialized.");
    }
    return client;
};

/**
 * Gets the current QR code data for authentication.
 * @returns {string | null} The QR code string, or null if not available.
 */
const getQrCode = (): string | null => qrCodeData;

/**
 * Checks if the WhatsApp client is ready and connected.
 * @returns {boolean} True if the client is ready, false otherwise.
 */
const isClientReady = (): boolean => clientReady;

/**
 * Gets the current status message of the WhatsApp client.
 * @returns {string} The client status message.
 */
const getClientStatusMessage = (): string => clientStatusMessage;

/**
 * Fetches a list of all groups the client is a part of.
 * @returns {Promise<Array<{id: string, name: string}>>} A promise that resolves to an array of group objects, each with an id and name.
 * @throws Will throw an error if the client is not ready.
 */
const getGroups = async (): Promise<{ id: string; name: string }[]> => {
    if (!isClientReady()) {
        throw new Error("WhatsApp client not ready.");
    }
    console.log('[WHATSAPP.SERVICE] getGroups: Entered function.'); // Added log
    const currentClient = getClient();
    try {
        console.log('[WHATSAPP.SERVICE] getGroups: Calling currentClient.getChats()...'); // Added log
        const chats = await currentClient.getChats();
        console.log(`[WHATSAPP.SERVICE] getGroups: currentClient.getChats() resolved. Found ${chats.length} chats.`); // Added log
        
        const groupChats = chats.filter(chat => chat.isGroup);
        console.log(`[WHATSAPP.SERVICE] getGroups: Filtered to ${groupChats.length} group chats.`); // Added log
        
        const result = groupChats.map(chat => ({
            id: chat.id._serialized,
            name: chat.name || chat.id.user,
        }));
        console.log('[WHATSAPP.SERVICE] getGroups: Mapped group chats. Returning result.'); // Added log
        return result;
    } catch (error) {
        console.error('[WHATSAPP.SERVICE] getGroups: Error during getChats or processing:', error); // Added log
        throw error; // Re-throw the error to be caught by the route handler
    }
};

/**
 * Fetches a specified number of recent messages from a given group.
 * @param {string} groupId - The ID of the group to fetch messages from.
 * @param {number} [messageCount=1000] - The number of messages to fetch if no date range is specified, or the initial batch size if dates are specified.
 * @param {string} [startDate] - Optional start date string (e.g., "YYYY-MM-DD").
 * @param {string} [endDate] - Optional end date string (e.g., "YYYY-MM-DD").
 * @param {boolean} [fetchOnlyUnread] - Optional. If true, attempts to fetch only unread messages.
 * @returns {Promise<Message[]>} A promise that resolves to an array of `whatsapp-web.js` Message objects.
 * @throws Will throw an error if the client is not ready, or if the group is not found or messages cannot be fetched.
 */
const getGroupMessages = async (
    groupId: string,
    messageCount: number = 1000,
    startDate?: string,
    endDate?: string,
    fetchOnlyUnread?: boolean
): Promise<Message[]> => {
    if (!isClientReady()) {
        throw new Error("WhatsApp client not ready.");
    }
    const currentClient = getClient();
    try {
        console.log(`[WHATSAPP.SERVICE] getGroupMessages called with: groupId=${groupId}, messageCount=${messageCount}, startDate=${startDate}, endDate=${endDate}, fetchOnlyUnread=${fetchOnlyUnread}`);
        const chat = await currentClient.getChatById(groupId);
        if (!chat || !chat.isGroup) {
            throw new Error(`Group with ID ${groupId} not found or is not a group.`);
        }
        console.log(`[WHATSAPP.SERVICE] Fetched chat: ${chat.id._serialized}, Unread count: ${chat.unreadCount}`);

        // Fetch messages, whatsapp-web.js fetches recent messages by default with limit
        // If dates are provided, we might fetch a larger batch to ensure coverage, then filter.
        // If date filtering is active, messageCount effectively becomes the max pool size for filtering.
        
        let effectiveMessageCount = messageCount;
        console.log(`[WHATSAPP.SERVICE] Initial effectiveMessageCount: ${effectiveMessageCount}`);

        if (fetchOnlyUnread && chat.unreadCount && chat.unreadCount > 0) {
            console.log(`[WHATSAPP.SERVICE] fetchOnlyUnread is TRUE. Using chat.unreadCount (${chat.unreadCount}) as effectiveMessageCount.`);
            effectiveMessageCount = chat.unreadCount;
        } else if (fetchOnlyUnread) {
            console.log(`[WHATSAPP.SERVICE] fetchOnlyUnread is TRUE, but chat.unreadCount is ${chat.unreadCount}. Defaulting to initial messageCount (${messageCount}) for effectiveMessageCount.`);
            // effectiveMessageCount remains messageCount as per current logic
        } else {
            console.log(`[WHATSAPP.SERVICE] fetchOnlyUnread is FALSE. Using initial messageCount (${messageCount}) for effectiveMessageCount.`);
        }
        console.log(`[WHATSAPP.SERVICE] After unread check, effectiveMessageCount: ${effectiveMessageCount}`);

        // Ensure a decent pool if date filtering is active, potentially overriding unread count if date range is wide
        const messagesToFetch = (startDate && endDate) ? Math.max(effectiveMessageCount, 1000) : effectiveMessageCount;
        console.log(`[WHATSAPP.SERVICE] Final messagesToFetch (considering date filters influencing pool size): ${messagesToFetch}`);
        
        let messages = await chat.fetchMessages({ limit: messagesToFetch });
        console.log(`[WHATSAPP.SERVICE] Fetched ${messages.length} messages initially (before date filtering).`);

        if (startDate && endDate) {
            console.log(`[WHATSAPP.SERVICE] Filtering messages for group ${groupId} between ${startDate} (DD/MM/YYYY) and ${endDate} (DD/MM/YYYY)`);
            
            const parseDdMmYyyy = (dateString: string): Date | null => {
                const parts = dateString.split('/');
                if (parts.length === 3) {
                    const day = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed in JS Date
                    const year = parseInt(parts[2], 10);
                    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                        return new Date(year, month, day);
                    }
                }
                return null;
            };

            const startDateObj = parseDdMmYyyy(startDate);
            const endDateObj = parseDdMmYyyy(endDate);

            if (!startDateObj || !endDateObj) {
                console.warn(`[WHATSAPP.SERVICE] Invalid DD/MM/YYYY date format provided for group ${groupId}. Start: ${startDate}, End: ${endDate}. Returning all fetched messages.`);
            } else {
                const startTimestamp = startDateObj.setHours(0, 0, 0, 0) / 1000;
                const endTimestamp = endDateObj.setHours(23, 59, 59, 999) / 1000;

                messages = messages.filter(msg => {
                    // Assuming msg.timestamp is a Unix timestamp in seconds
                    return msg.timestamp >= startTimestamp && msg.timestamp <= endTimestamp;
                });
                console.log(`[WHATSAPP.SERVICE] Found ${messages.length} messages after DD/MM/YYYY date filtering for group ${groupId}.`);
            }
        }
        
        return messages.map(msg => msg); // Ensure it's an array of Message instances
    } catch (error) {
        console.error(`Error fetching messages for group ${groupId}:`, error);
        throw new Error(`Failed to fetch messages for group ${groupId}.`);
    }
};

// Export functions and variables to be used by other parts of the application
export {
    initializeWhatsAppClient,
    getClient,
    getQrCode,
    isClientReady,
    getClientStatusMessage,
    getGroups,
    getGroupMessages,
    // Export client instance directly if needed elsewhere, though getClient() is preferred
    // client as whatsAppClientInstance 
};