import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import {
    initializeWhatsAppClient,
    getQrCode,
    isClientReady,
    getClientStatusMessage,
    getGroups,
    getGroupMessages
} from './whatsapp.service';
import { generateSummary, answerQuestion } from './ai.service';
import { Message } from 'whatsapp-web.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors({
    origin: '*', // Adjust in production
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware to parse JSON bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- Initialize WhatsApp Client ---
initializeWhatsAppClient()
    .then(() => {
        console.log("WhatsApp client initialization process started.");
    })
    .catch(error => {
        console.error("Failed to initialize WhatsApp client after all retries:", error);
        // The status message in whatsapp.service should reflect this failure.
    });

// --- API Endpoints ---

/**
 * @route GET /auth/status
 * @description Provides the current status of the WhatsApp client connection.
 * @returns {object} JSON object with `ready` (boolean), `message` (string), and `qrCodeAvailable` (boolean).
 */
app.get('/auth/status', (req: Request, res: Response) => {
    res.json({
        ready: isClientReady(),
        message: getClientStatusMessage(),
        qrCodeAvailable: !!getQrCode() && !isClientReady() // QR only relevant if not ready
    });
});

/**
 * @route GET /auth/qr
 * @description Provides the QR code string for WhatsApp authentication, if available and needed.
 * @returns {object} JSON object with `qrCode` (string) or an error/status message.
 */
app.get('/auth/qr', (req: Request, res: Response) => {
    const qr = getQrCode();
    if (qr && !isClientReady()) { // Only send QR if it's available and client isn't ready
        res.json({ qrCode: qr });
    } else if (isClientReady()) {
        res.status(200).json({ message: 'Client is already authenticated and ready.' });
    }
    else {
        res.status(404).json({ error: 'QR code not currently available.' });
    }
});

/**
 * @route GET /auth/qr-page
 * @description Serves an HTML page that displays the current WhatsApp connection status and QR code (if available) for easy scanning.
 * The page auto-refreshes every 5 seconds.
 */
app.get('/auth/qr-page', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html');
    const statusMessage = getClientStatusMessage();
    const ready = isClientReady();
    let bodyContent = `<h1>WhatsApp Connection Status</h1><p id="statusP">Status: ${statusMessage}</p>`;

    if (ready) {
        bodyContent += '<p style="color: green;">Client is connected!</p>';
    } else {
        const qr = getQrCode();
        if (qr) {
            bodyContent += `
                <p>Scan this QR code with your phone:</p>
                <div id="qrCodeContainer">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}" alt="WhatsApp QR Code">
                </div>
            `;
        } else {
            bodyContent += '<p>Waiting for QR code or client to initialize...</p>';
        }
    }

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp QR Code</title>
            <meta http-equiv="refresh" content="5">
            <style>
                body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 90vh; margin: 0; background-color: #f0f0f0; text-align: center; }
                #qrCodeContainer { margin: 20px; padding: 10px; background-color: white; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
                #statusP { font-weight: bold; }
            </style>
        </head>
        <body>
            ${bodyContent}
        </body>
        </html>
    `);
});


/**
 * @route GET /groups
 * @description Fetches and returns a list of all WhatsApp groups the client is part of.
 * @returns {Array<object>} JSON array of group objects, each with `id` and `name`, or an error message.
 */
app.get('/groups', async (req: Request, res: Response) => {
    if (!isClientReady()) {
        return res.status(503).json({ error: 'WhatsApp client not ready.' });
    }
    try {
        const groups = await getGroups();
        res.json(groups);
    } catch (error: any) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch groups.' });
    }
});

/**
 * @route GET /groups/:groupId/messages
 * @description Fetches recent messages from a specified group.
 * @param {string} req.params.groupId - The ID of the group.
 * @param {string} [req.query.count] - Optional number of messages to fetch (defaults to 50).
 * @returns {Array<object>} JSON array of formatted message objects, or an error message.
 */
app.get('/groups/:groupId/messages', async (req: Request, res: Response) => {
    if (!isClientReady()) {
        return res.status(503).json({ error: 'WhatsApp client not ready.' });
    }
    const { groupId } = req.params;
    const messageCountParam = req.query.count as string;
    // Default to 1000 messages, PRD mentions "configurable number of messages"
    const messageCount = messageCountParam ? parseInt(messageCountParam, 10) : 1000;

    if (isNaN(messageCount) || messageCount <= 0) {
        return res.status(400).json({ error: 'Invalid message count specified.' });
    }

    try {
        const messages = await getGroupMessages(groupId, messageCount);
        // We might want to map messages to a simpler structure for the frontend
        const formattedMessages = messages.map(msg => ({
            id: msg.id._serialized,
            body: msg.body,
            timestamp: msg.timestamp,
            from: msg.from,
            fromMe: msg.fromMe,
            author: msg.author // Important for group messages
        }));
        res.json(formattedMessages);
    } catch (error: any) {
        console.error(`Error fetching messages for group ${groupId}:`, error);
        res.status(500).json({ error: error.message || `Failed to fetch messages for group ${groupId}.` });
    }
});

/**
 * @route POST /ai/summarize
 * @description Generates an AI-powered summary for a given set of messages.
 * @param {Array<Message>} req.body.messages - An array of message objects (compatible with `whatsapp-web.js` Message structure).
 * @returns {object} JSON object with the `summary` (string), or an error message.
 */
app.post('/ai/summarize', async (req: Request, res: Response) => {
    const { messages } = req.body as { messages: Message[] }; // Assuming frontend sends full Message objects or compatible structure

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages are required for summarization.' });
    }

    try {
        // The AI service expects Message[] from whatsapp-web.js.
        // If frontend sends a simplified version, ensure it's compatible or transform it.
        // For now, assuming compatible structure.
        const summary = await generateSummary(messages);
        res.json({ summary });
    } catch (error: any) {
        console.error('Error generating summary:', error);
        res.status(500).json({ error: error.message || 'Failed to generate summary.' });
    }
});

/**
 * @route POST /ai/ask
 * @description Answers a question based on a given set of messages and a question string using AI.
 * @param {Array<Message>} req.body.messages - An array of message objects for context.
 * @param {string} req.body.question - The question to be answered.
 * @returns {object} JSON object with the `answer` (string), or an error message.
 */
app.post('/ai/ask', async (req: Request, res: Response) => {
    const { messages, question } = req.body as { messages: Message[], question: string };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages context is required to answer a question.' });
    }
    if (!question || typeof question !== 'string' || question.trim() === "") {
        return res.status(400).json({ error: 'A question is required.' });
    }

    try {
        // Similar to summarize, assuming compatible Message structure.
        const answer = await answerQuestion(messages, question);
        res.json({ answer });
    } catch (error: any) {
        console.error('Error answering question:', error);
        res.status(500).json({ error: error.message || 'Failed to generate answer.' });
    }
});

/**
 * @route GET /health
 * @description Provides a simple health check for the backend service.
 * @returns {object} JSON object indicating service status and WhatsApp client status.
 */
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'UP',
        message: 'Backend service is running.',
        whatsappReady: isClientReady(),
        whatsappStatus: getClientStatusMessage()
    });
});


app.listen(port, () => {
    console.log(`Backend server listening on port ${port}`);
    console.log(`Open http://localhost:${port}/auth/qr-page to see QR code if needed.`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('SIGINT received. Shutting down gracefully...');
    // Add any cleanup logic here if needed for services
    // e.g., await client.destroy(); if whatsapp.service exposes client instance or a shutdown method
    process.exit(0);
});