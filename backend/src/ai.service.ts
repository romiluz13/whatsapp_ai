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
 * @param {string} [startDate] - Optional start date of the message range (DD/MM/YYYY).
 * @param {string} [endDate] - Optional end date of the message range (DD/MM/YYYY).
 * @param {string} [customPromptText] - Optional custom system prompt text.
 * @returns {Promise<string>} A promise that resolves to the AI-generated summary, or an error message.
 */
export const generateSummary = async (
    messages: Message[],
    startDate?: string,
    endDate?: string,
    customPromptText?: string
): Promise<string> => {
    if (!openai.apiKey) {
        return "AI service is not configured (OpenAI API key missing).";
    }
    if (!messages || messages.length === 0) {
        return "No messages provided for summarization.";
    }

    try {
        const conversationContext = await formatMessagesForAI(messages);
        
        let dateRangeInfo = "";
        if (startDate && endDate) {
            dateRangeInfo = ` for the period ${startDate} to ${endDate}`;
        } else if (startDate) {
            dateRangeInfo = ` starting from ${startDate}`;
        } else if (endDate) {
            dateRangeInfo = ` up to ${endDate}`;
        }

        const numMessages = messages.length;
        let summaryDetailLevel = "standard";
        let maxTokensForSummary = 2500; // Default

        if (numMessages > 1500) {
            summaryDetailLevel = "very detailed and comprehensive, covering as many distinct discussion threads and nuances as possible";
            maxTokensForSummary = 3500; // Push higher for very large message sets
        } else if (numMessages > 500) {
            summaryDetailLevel = "detailed, covering major topics and important sub-points thoroughly";
            maxTokensForSummary = 3000;
        } else if (numMessages < 100 && numMessages > 0) {
            summaryDetailLevel = "concise but informative, highlighting the absolute key takeaways";
            maxTokensForSummary = 1500;
        }
        // Ensure maxTokensForSummary does not exceed model limits (e.g. 4096 for gpt-4o-mini output)
        maxTokensForSummary = Math.min(maxTokensForSummary, 4000);


        const DEFAULT_SYSTEM_PROMPT_FOR_SUMMARY = `You are an AI specializing in summarizing WhatsApp group conversations, particularly for active, high-volume technical groups like "AI Israel" where discussions revolve heavily around AI concepts, tools, news, and problem-solving. Your primary goal is to distill potentially hundreds or thousands of messages into a clear, actionable, and appropriately ${summaryDetailLevel} HTML summary.
The current summary request covers ${numMessages} messages${dateRangeInfo}. Adjust the depth and breadth of your summary accordingly. It is better to provide more detail and be comprehensive than to be too brief, especially for larger message sets. Capture the essence and key information effectively.

**CRITICAL OUTPUT INSTRUCTION: Your ENTIRE response MUST be a single block of valid HTML. Do NOT include any markdown, code block specifiers (like \`\`\`html), or any text outside of the HTML structure itself.**

**LANGUAGE INSTRUCTION:**
*   If the conversation history is predominantly **Hebrew**, your entire HTML response (all text content, titles, etc.) MUST be in **HEBREW**.
*   Otherwise, if another non-English language is clearly predominant, respond in that language.
*   If English is primary or no other language is clearly dominant, respond in English.

**HTML STRUCTURE & STYLING GUIDELINES (Same as before - ensure adherence):**
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
*   **Comprehensiveness & Detail:** For larger message sets or longer date ranges, expand the "Key Topics & Insights" section to cover more distinct topics (e.g., 5-7 instead of 3-5 if warranted) and provide more detail within each. Similarly, the "Notable Links" and "Key Questions" sections can be more extensive. The goal is to transfer the full message of the group discussions effectively.

**SUMMARY STRUCTURE (Follow this order precisely, adapt detail based on input size):**

\`\`\`html
<div>
    <h2>📊 Main Overview (סקירה כללית):</h2>
    <p>Provide a high-level summary (2-4 sentences, more if many messages). What were the absolute main themes and the general conversational drift in this segment of messages${dateRangeInfo}? Focus on the essence.</p>

    <h2>💡 Key Topics & Insights (נושאים ותובנות עיקריים):</h2>
    <p>This is the core of your summary. Identify the most significant, distinct topics discussed. For ${numMessages > 500 ? 'a larger set of messages like this, aim for 5-7 key topics if distinct threads exist' : 'this set of messages, aim for 3-5 key topics'}. For each topic:</p>
    <ul>
        <li>
            <p><strong>Topic Name 1:</strong> Explain the core discussion points, new information shared (e.g., new AI models, tools, techniques), or main questions/debates in more detail if the message volume is high. Mention key insights or conclusions if any were reached.</p>
        </li>
        <!-- Add more list items for other key topics as appropriate for the volume of messages -->
    </ul>

    <h2>🔗 Notable Links & Resources (קישורים ומשאבים חשובים):</h2>
    <p>List important links, articles, tools, GitHub repositories, or other resources shared. Be more inclusive if many resources were shared over a longer period.</p>
    <ul>
        <li><p><a href="https://example.com/resource1" target="_blank">Descriptive Name of Resource 1</a> - Optional: brief context.</p></li>
        <!-- If no notable resources: <p><strong>No specific new links or resources were highlighted in this segment.</strong></p> -->
    </ul>

    <h2>❓ Key Questions Asked (שאלות מרכזיות שנשאלו):</h2>
    <p>List significant or recurring questions. For larger message sets, include more questions if they represent distinct areas of inquiry.</p>
    <ul>
        <li><p><strong>Question:</strong> "Actual question text?" - Briefly note if it was answered, or if it remains open.</p></li>
        <!-- If no notable questions: <p><strong>No specific new questions stood out in this segment.</strong></p> -->
    </ul>

    <h2>🔥 Hot Topic Snippet (נושא חם בקצרה):</h2>
    <p>From the key topics, identify the single most actively discussed, debated, or "hottest" thread. Provide a 2-3 sentence highlight capturing its essence, potentially more if it was a very dominant topic.</p>

    <h2>🗣️ Dive Deeper? (רוצים לצלול פנימה?):</h2>
    <p><strong>Is there a specific topic or question from this summary you'd like to explore in more detail?</strong></p>
</div>
\`\`\`

**Final Check:** Before outputting, ensure your response is ONLY the HTML content as specified, starting with \`<div>\` and ending with \`</div>\`. No extra text, no markdown, no code fences.
`;

        let systemPromptToUse = DEFAULT_SYSTEM_PROMPT_FOR_SUMMARY;
        if (customPromptText && customPromptText.trim() !== "") {
            systemPromptToUse = `${customPromptText.trim()}\n\nIMPORTANT: The following is the primary set of instructions you must adhere to:\n\n${DEFAULT_SYSTEM_PROMPT_FOR_SUMMARY}`;
            console.log(`[AI.SERVICE] Augmenting default summary prompt with custom instruction: "${customPromptText.substring(0, 100)}..."`);
        } else {
            console.log(`[AI.SERVICE] Using default system prompt for summary.`);
        }

        const userQuery = `${conversationContext}\n\nTask: Summarize the above conversation (which includes ${numMessages} messages${dateRangeInfo}) according to the detailed system instructions. Prioritize comprehensiveness and detail appropriate for the volume of messages, ensuring the summary is not too short. Pay close attention to the language instruction.`;

        const formattedMessagesForOpenAI: MessageForAI[] = [
            { role: 'system', content: systemPromptToUse },
            { role: 'user', content: userQuery }
        ];

        const aiResponse = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: formattedMessagesForOpenAI,
            max_tokens: maxTokensForSummary,
            temperature: 0.5,
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
 * @param {string} [customPromptText] - Optional custom system prompt text.
 * @returns {Promise<string>} A promise that resolves to the AI-generated answer, or an error message.
 */
export const answerQuestion = async (
    messages: Message[],
    question: string,
    customPromptText?: string
): Promise<string> => {
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
        const DEFAULT_SYSTEM_PROMPT_FOR_QA = `You are an AI assistant designed to answer questions about a specific WhatsApp group conversation, often focused on technology or AI discussions. Use ONLY the provided message history to answer the user's question accurately and concisely, extracting relevant information.

**LANGUAGE INSTRUCTION:**
*   **If the conversation history (and potentially the user's question) contains a significant amount of Hebrew, your answer MUST be in HEBREW.**
*   Otherwise, if another non-English language is clearly predominant in the conversation, respond in that language.
*   If the conversation is primarily English or a mix of languages without a clear non-English predominance, respond in English.

If the answer to the question cannot be found within the provided messages, clearly state that the information is not available in the provided context (in the target language). Do not make assumptions or provide information from outside the conversation.`;

        let systemPromptToUse = DEFAULT_SYSTEM_PROMPT_FOR_QA;
        if (customPromptText && customPromptText.trim() !== "") {
            systemPromptToUse = `${customPromptText.trim()}\n\nIMPORTANT: The following is the primary set of instructions you must adhere to:\n\n${DEFAULT_SYSTEM_PROMPT_FOR_QA}`;
            console.log(`[AI.SERVICE] Augmenting default Q&A prompt with custom instruction: "${customPromptText.substring(0, 100)}..."`);
        } else {
            console.log(`[AI.SERVICE] Using default system prompt for Q&A.`);
        }

        const userQuery = `${conversationContext}\n\nUser's Question: ${question}\n\nTask: Answer the user's question based ONLY on the conversation history provided above, paying close attention to the language instruction.`;

        const formattedMessagesForOpenAI: MessageForAI[] = [
            { role: 'system', content: systemPromptToUse },
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