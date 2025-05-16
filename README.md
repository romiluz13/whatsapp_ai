# 🚀 WhatsApp Group Insights AI 🤖

**Tired of catching up on hundreds of WhatsApp messages? Unlock AI-powered summarization and Q&A directly within WhatsApp Web!** 🤯

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Node.js](https://img.shields.io/badge/Node.js->=18.x-blue.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue.svg)](https://www.typescriptlang.org/)

---

# 🔥 **AI-Powered Setup: Your README is the Key!** 🔥

**Got an AI Coding Assistant? (Cursor, Copilot, etc.)**

Skip the manual steps! Just **copy this entire README.md file** and paste it into your AI assistant.
Tell it: *"Set up this project for me."*

Your AI will handle the cloning, installations, and configurations following the detailed instructions below. Welcome to 2025! 😉

---

WhatsApp Group Insights AI is an open-source Chrome extension that brings the power of Large Language Models (LLMs) like `gpt-4o-mini` directly to your WhatsApp Web interface. Get quick, intelligent summaries of long group discussions and ask specific questions about the content, saving you time and keeping you in the loop.

This project has been refactored for a modern, intuitive user experience and a clean, maintainable codebase, making it ready for community contributions and further innovation!

---

<!-- TODO: Add GIF Demo Here -->
<!-- A short screen recording (5-15 seconds) showing:
1. QR code scanning / Connection status
2. Group selection dropdown
3. Clicking "Summarize Group" and seeing a summary appear
4. Typing a question and getting an answer
This will make the README much more engaging!
-->

---

## ✨ Core Features & The Big Idea

This extension seamlessly integrates with your WhatsApp Web, offering:

*   **🤖 AI-Powered Summaries:** Instantly get the gist of long group chats. No more endless scrolling!
*   **❓ Intelligent Q&A:** Ask specific questions about any group conversation and get answers based on the actual message content.
*   **🔒 Secure Connection:** Connects to your WhatsApp account safely and lists your groups right in the extension.

**The core idea?** To tame information overload in WhatsApp groups. We believe AI can make keeping up with busy chats effortless and efficient, giving you back valuable time. This is just the beginning, and we envision a future with even more intelligent group management tools.

## 💡 Why This Project?

In today's fast-paced digital communication, WhatsApp groups can become overwhelming. This tool was born from a desire to:

*   **Save You Time:** Quickly grasp what's important without reading every single message.
*   **Boost Your Productivity:** Find information and answers within your group chats in seconds.
*   **Keep You In The Loop:** Effortlessly stay updated on crucial discussions.
*   **Pioneer with AI:** Showcase a practical way to embed powerful LLMs into everyday communication tools.

We're building this in the open because we believe in the power of community. Your insights and contributions can help shape this tool into something truly amazing!

## 🛠️ Tech Stack

*   **Frontend (Extension Panel):** HTML, CSS, Vanilla JavaScript
*   **Backend Server:** Node.js, Express.js, TypeScript
*   **WhatsApp Integration:** `whatsapp-web.js`
*   **AI Integration:** OpenAI API (`gpt-4o-mini` or configurable)
*   **Browser:** Google Chrome (as an extension)

## 📂 Project Structure

```
whatsapp-ai-insights/
├── backend/                 # Node.js backend server
│   ├── src/
│   │   ├── ai.service.ts    # Handles OpenAI API interactions
│   │   ├── index.ts       # Express server setup and API routes
│   │   └── whatsapp.service.ts # Manages whatsapp-web.js client
│   ├── .env.example       # Example environment file
│   ├── package.json
│   └── tsconfig.json
├── extension/               # Chrome extension files
│   ├── assets/              # (Optional: for static assets)
│   ├── fontawesome/         # FontAwesome library
│   ├── icons/               # Extension icons (16, 48, 128)
│   ├── panel.html           # UI for the extension sidebar
│   ├── panel.css            # Styles for panel.html
│   ├── panel.js             # Logic for panel UI and communication
│   ├── content.js           # Injects sidebar, interacts with WhatsApp Web DOM
│   ├── background.js        # Handles background tasks, communication hub
│   ├── bridge.js            # Facilitates communication between panel and content script
│   └── manifest.json        # Extension manifest
├── .gitignore
├── LICENSE                  # Project License (e.g., MIT)
├── README.md                # This file
└── package.json             # Root package.json (if any)
```

## 🚀 Setup and Installation

Getting started is easy! Follow these steps:

### Prerequisites

*   🟢 Node.js (v18.x or later recommended)
*   📦 npm or yarn
*   🌐 Google Chrome browser
*   🔑 An OpenAI API key with access to a model like `gpt-4o-mini` (or your preferred model).

### 1. Backend Setup ⚙️

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/romiluz13/whatsapp_ai.git
    cd whatsapp_ai
    ```
2.  **Navigate to Backend:**
    ```bash
    cd backend
    ```
3.  **Install Dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```
4.  **Set Your OpenAI API Key (Choose ONE method):**
    *   🔑 **EASIEST METHOD (Recommended): Use the Extension Panel!**
        1.  After setting up the backend and loading the extension (see steps below), open WhatsApp Web.
        2.  Click the extension icon, then the **settings icon (⚙️)** within the panel.
        3.  Enter your OpenAI API key in the designated field and click "Save API Key".
        4.  *That's it! This key is stored locally in your browser and will be used for all AI requests.*
    *   ⚙️ **Alternative Method (.env file for backend):**
        1.  Create a `.env` file in the `backend` directory.
        2.  Add your key: `OPENAI_API_KEY=your_openai_api_key_here`
        3.  You can also set `OPENAI_MODEL` (defaults to `gpt-4o-mini`) and `PORT` (defaults to `3000`) here.
        4.  *Note: If an API key is set in the extension panel, it will **override** the one in the `.env` file.*
5.  **Start the Backend Server:**
    ```bash
    npm run dev
    # or
    # yarn dev
    ```
    This will compile TypeScript and start the server (usually on `http://localhost:3000`). Look for a confirmation message in your terminal.

### 2. Chrome Extension Setup 🧩

1.  Open Google Chrome and navigate to `chrome://extensions`.
2.  Enable **Developer mode** (toggle switch, usually in the top right).
3.  Click the **"Load unpacked"** button.
4.  Select the `extension` folder from this project directory (`whatsapp_ai/extension`).
5.  The "WhatsApp AI Insights" extension will appear in your list and be active. You should see its icon in your Chrome toolbar.

## 🎮 Usage

1.  ✅ Ensure the backend server is running (from Backend Setup step 5).
2.  💬 Open WhatsApp Web (`web.whatsapp.com`) in your Chrome browser.
3.  📊 The WhatsApp AI Insights panel should automatically appear on the right side.
4.  **Connect to WhatsApp:**
    *   The panel will guide you. If needed, scan the QR code displayed in the panel (or at `http://localhost:3000/auth/qr-page` for a larger view) using the WhatsApp app on your phone.
    *   Status will update to "Client is ready and connected to WhatsApp."
5.  **Select a Group:**
    *   Choose a group from the dropdown list.
6.  **Summarize Group:**
    *   Click "סכם קבוצה" (Summarize Group). An AI-generated summary of recent messages will appear.
7.  **Ask a Question:**
    *   Type your question about the selected group's conversation into the text area.
    *   Click the send button (paper airplane icon). Get an AI-generated answer based on the conversation context.

## 🧑‍💻 Development

### Key Scripts (Backend)

*   `npm run build` or `yarn build`: Compile TypeScript to JavaScript (e.g., to a `dist` folder).
*   `npm start` or `yarn start`: Run the compiled JavaScript server (for production).
*   `npm run dev` or `yarn dev`: Run the server in development mode with auto-reloading.

## 🤝 Let's Build Together!

Contributions are the lifeblood of open-source and are **highly encouraged!** Whether you're a seasoned developer or just starting, your ideas and code can make a huge impact.

**Here's how you can jump in:**

1.  **Fork** the repository on GitHub – make it your own playground!
2.  Create a **new branch** for your brilliant feature or crucial bug fix (e.g., `feature/next-gen-summary` or `bugfix/chat-sync-error`).
3.  Craft your changes and **commit** them with clear, descriptive messages – tell us your story!
4.  **Push** your innovations to your forked repository.
5.  Open a **Pull Request** to the main repository. Share your work, explain your changes, and let's discuss how to make this project even better!

We value clean code, innovative ideas, and a collaborative spirit. Clone the repo, play around, and let's improve it together!

## 🤔 What's Next?

While the core features are robust, here are some areas for potential future exploration by the community:

*   Even more nuanced user controls for summary length/style (beyond prompt augmentation).
*   Advanced caching strategies for further performance and API cost optimization.
*   Support for other LLM providers or local models.
*   Your great ideas!

## ❤️ Show Your Support

If you find this project useful or interesting:
*   ⭐ Star the repository on GitHub!
*   🔗 Share it on LinkedIn, Twitter, or with your friends and colleagues.
*   💡 Suggest new features or report bugs by opening an issue.

## 📜 License

This project is licensed under the MIT License. See the [`LICENSE`](LICENSE) file for details.
*(Note: You'll need to add a LICENSE file to the repository, e.g., by creating one with the MIT License text.)*

---

*Disclaimer: This tool interacts with WhatsApp Web. Ensure your use complies with WhatsApp's terms of service. The developers are not responsible for any misuse or account issues.*