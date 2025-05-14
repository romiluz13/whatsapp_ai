import OpenAI from 'openai';
import dotenv from 'dotenv';
import { Message } from 'whatsapp-web.js'; // Assuming Message type is needed for context

// Load environment variables
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY?.trim(),
});

if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is not set. AI features will not work.");
}

interface MessageForAI {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Formats an array of WhatsApp messages into a single string for AI processing.
 * Prepends "Conversation History:" and lists messages with sender and body.
 * Sorts messages by timestamp.
 * @param {Message[]} messages - An array of `whatsapp-web.js` Message objects.
 * @returns {Promise<string>} A string representing the formatted conversation history.
 */
const formatMessagesForAI = async (messages: Message[]): Promise<string> => {
    let conversationContext = "Conversation History:\n";
    // Sort messages by timestamp if not already sorted
    const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);

    for (const msg of sortedMessages) {
        const sender = msg.fromMe ? 'You' : (msg.author || msg.from); // msg.author for group messages
        let contactName = sender;
        // Fetching contact can be slow and error-prone, especially in a batch.
        // For MVP, we might simplify this or make it optional.
        // if (!msg.fromMe && msg.getContact) {
        //     try {
        //         const contact = await msg.getContact();
        //         contactName = contact.pushname || contact.name || sender;
        //     } catch (e) {
        //         // console.warn(`Could not get contact for message from ${sender}`);
        //         contactName = sender; // Fallback
        //     }
        // }
        conversationContext += `${contactName}: ${msg.body}\n`;
    }
    return conversationContext;
};

/**
 * Generates a summary for a given array of WhatsApp messages using the OpenAI API.
 * @param {Message[]} messages - An array of `whatsapp-web.js` Message objects to summarize.
 * @returns {Promise<string>} A promise that resolves to the AI-generated summary, or an error message.
 */
export const generateSummary = async (messages: Message[]): Promise<string> => {
    if (!openai.apiKey) {
        return "AI service is not configured (OpenAI API key missing).";
    }
    if (!messages || messages.length === 0) {
        return "No messages provided for summarization.";
    }

    try {
        const conversationContext = await formatMessagesForAI(messages);
        const systemPrompt = `You are an AI specializing in summarizing WhatsApp group conversations, particularly for active, high-volume technical groups like "AI Israel" where discussions revolve heavily around AI concepts, tools, news, and problem-solving. Your primary goal is to distill potentially hundreds or thousands of messages into a clear, concise, and actionable HTML summary.

**CRITICAL OUTPUT INSTRUCTION: Your ENTIRE response MUST be a single block of valid HTML. Do NOT include any markdown, code block specifiers (like \`\`\`html), or any text outside of the HTML structure itself.**

**LANGUAGE INSTRUCTION:**
*   If the conversation history is predominantly **Hebrew**, your entire HTML response (all text content, titles, etc.) MUST be in **HEBREW**.
*   Otherwise, if another non-English language is clearly predominant, respond in that language.
*   If English is primary or no other language is clearly dominant, respond in English.

**HTML STRUCTURE & STYLING GUIDELINES:**
*   **Main Container:** Wrap your entire summary in a single \`<div>\`.
*   **Section Titles:** Use \`<h2>\` for main section titles. Each \`<h2>\` MUST start with a relevant emoji.
    *   Example (Hebrew): \`<h2>📊 סקירה כללית:</h2>\`
    *   Example (English): \`<h2>📊 Main Overview:</h2>\`
*   **Paragraphs:** Use \`<p>\` for all descriptive text.
*   **Emphasis:** Use \`<strong>\` for bolding key terms, names, or takeaways. Use \`<em>\` for italics if needed for nuance.
*   **Lists:** Use \`<ul>\` for unordered lists and \`<li>\` for list items. List items should generally contain a \`<p>\` tag for their content for consistent spacing.
*   **Hyperlinks:**
    *   **MUST be HTML anchor tags:** \`<a href="URL" target="_blank">Descriptive Link Text</a>\`.
    *   \`target="_blank"\` is crucial.
    *   Link text MUST be descriptive (e.g., "Research Paper on LLMs," not just the URL).
*   **Conciseness:** While comprehensive, strive for clarity and conciseness, especially given the potential volume of messages. Focus on the most impactful information.

**SUMMARY STRUCTURE (Follow this order precisely):**

\`\`\`html
<div>
    <h2>📊 Main Overview (סקירה כללית):</h2>
    <p>Provide a 2-3 sentence high-level summary. What were the absolute main themes and the general conversational drift in this segment of (potentially many) messages? Focus on the essence, imagine someone has only 10 seconds to catch up.</p>

    <h2>💡 Key Topics & Insights (נושאים ותובנות עיקריים):</h2>
    <p>This is the core of your summary. Given a potentially large number of messages in a group like "AI Israel," identify the 3-5 most significant, distinct topics discussed. For each topic:</p>
    <ul>
        <li>
            <p><strong>Topic Name 1:</strong> Briefly explain the core discussion points, new information shared (e.g., new AI models, tools, techniques), or main questions/debates. Mention key insights or conclusions if any were reached.</p>
        </li>
        <li>
            <p><strong>Topic Name 2:</strong> (Similar detail)</p>
        </li>
        <!-- Add more list items for other key topics, up to about 5 -->
    </ul>

    <h2>🔗 Notable Links & Resources (קישורים ומשאבים חשובים):</h2>
    <p>List any important links, articles, tools, GitHub repositories, or other resources shared. If many were shared, prioritize the most relevant or frequently referenced.</p>
    <ul>
        <li><p><a href="https://example.com/resource1" target="_blank">Descriptive Name of Resource 1</a> - Optional: very brief (1-sentence) context if not obvious from title.</p></li>
        <!-- Add more list items as needed -->
        <!-- If no notable resources: <p><strong>No specific new links or resources were highlighted in this segment.</strong></p> -->
    </ul>

    <h2>❓ Key Questions Asked (שאלות מרכזיות שנשאלו):</h2>
    <p>List 1-3 significant or recurring questions posed by group members. Focus on those that sparked discussion or represent common points of confusion/interest in the AI Israel group context.</p>
    <ul>
        <li><p><strong>Question:</strong> "Actual question text?" - Briefly note if it was answered, or if it remains open.</p></li>
        <!-- If no notable questions: <p><strong>No specific new questions stood out in this segment.</strong></p> -->
    </ul>

    <h2>🔥 Hot Topic Snippet (נושא חם בקצרה):</h2>
    <p>From the key topics, identify the single most actively discussed, debated, or "hottest" thread. Provide a 1-2 sentence highlight capturing its essence. What got people talking the most?</p>

    <h2>🗣️ Dive Deeper? (רוצים לצלול פנימה?):</h2>
    <p><strong>Is there a specific topic or question from this summary you'd like to explore in more detail?</strong></p>
</div>
\`\`\`

**Final Check:** Before outputting, ensure your response is ONLY the HTML content as specified, starting with \`<div>\` and ending with \`</div>\`. No extra text, no markdown, no code fences.
`;
        const userQuery = `${conversationContext}\n\nTask: Summarize the above conversation according to the detailed system instructions, paying close attention to the language instruction.`;

        const formattedMessagesForOpenAI: MessageForAI[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userQuery }
        ];

        const aiResponse = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini', // Ensure this uses the intended model
            messages: formattedMessagesForOpenAI,
            max_tokens: 2500, // Significantly increased for very comprehensive HTML summaries from many messages
            temperature: 0.5, // Lower temperature for more factual summaries
        });

        return aiResponse.choices[0].message.content || 'Sorry, I could not generate a summary.';
    } catch (error: any) {
        console.error('Error generating summary with AI:', error);
        if (error.response && error.response.data && error.response.data.error) {
            return `AI API Error: ${error.response.data.error.message}`;
        }
        return 'An error occurred while generating the summary. Please try again later.';
    }
};

/**
 * Answers a question based on a given array of WhatsApp messages and a question string, using the OpenAI API.
 * @param {Message[]} messages - An array of `whatsapp-web.js` Message objects providing context.
 * @param {string} question - The question to answer.
 * @returns {Promise<string>} A promise that resolves to the AI-generated answer, or an error message.
 */
export const answerQuestion = async (messages: Message[], question: string): Promise<string> => {
    if (!openai.apiKey) {
        return "AI service is not configured (OpenAI API key missing).";
    }
    if (!messages || messages.length === 0) {
        return "No message context provided to answer the question.";
    }
    if (!question || question.trim() === "") {
        return "No question provided.";
    }

    try {
        const conversationContext = await formatMessagesForAI(messages);
        const systemPrompt = `You are an AI assistant designed to answer questions about a specific WhatsApp group conversation, often focused on technology or AI discussions. Use ONLY the provided message history to answer the user's question accurately and concisely, extracting relevant information.

**LANGUAGE INSTRUCTION:**
*   **If the conversation history (and potentially the user's question) contains a significant amount of Hebrew, your answer MUST be in HEBREW.**
*   Otherwise, if another non-English language is clearly predominant in the conversation, respond in that language.
*   If the conversation is primarily English or a mix of languages without a clear non-English predominance, respond in English.

If the answer to the question cannot be found within the provided messages, clearly state that the information is not available in the provided context (in the target language). Do not make assumptions or provide information from outside the conversation.`;
        const userQuery = `${conversationContext}\n\nUser's Question: ${question}\n\nTask: Answer the user's question based ONLY on the conversation history provided above, paying close attention to the language instruction.`;

        const formattedMessagesForOpenAI: MessageForAI[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userQuery }
        ];

        const aiResponse = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini', // Ensure this uses the intended model
            messages: formattedMessagesForOpenAI,
            max_tokens: 250, // Slightly increased if answers might need more detail
            temperature: 0.3, // Lower temperature for more factual, context-bound answers
        });

        return aiResponse.choices[0].message.content || 'Sorry, I could not generate an answer.';
    } catch (error: any) {
        console.error('Error answering question with AI:', error);
        if (error.response && error.response.data && error.response.data.error) {
            return `AI API Error: ${error.response.data.error.message}`;
        }
        return 'An error occurred while generating the answer. Please try again later.';
    }
};