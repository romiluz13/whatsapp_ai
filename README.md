# 🚀 WhatsApp Group Insights AI 🤖

**Tired of catching up on hundreds of WhatsApp messages? Unlock AI-powered summarization and Q&A directly within WhatsApp Web!** 🤯

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Node.js](https://img.shields.io/badge/Node.js->=18.x-blue.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue.svg)](https://www.typescriptlang.org/)

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

## ✨ Features (MVP)

*   **🔐 F1: Secure WhatsApp Connection & Group Listing:**
    *   📱 Easy QR code scanning to connect your WhatsApp account securely.
    *   📋 Lists all your WhatsApp groups within the extension panel.
*   **👆 F2: Manual Group Selection & Rich Message Fetching:**
    *   🎯 Select any group from your list.
    *   💬 Fetches recent messages (configurable, default 1000) from the selected group to provide rich context for AI operations.
*   **🧠 F3: `gpt-4o-mini` Powered Group Summarization:**
    *   📄 Generate concise, AI-crafted summaries of the selected group's recent conversation.
    *   🎨 Summaries are styled with HTML for readability (titles, bolding, links).
*   **❓ F4: `gpt-4o-mini` Powered Group Q&A:**
    *   🗣️ Ask specific questions about the content of the selected group's recent conversation.
    *   💡 Get intelligent answers based on the message context.

## 💡 Why This Project?

In today's fast-paced digital communication, WhatsApp groups can become overwhelming with information. This tool aims to:
*   **Save Time:** Quickly understand the gist of long conversations without reading every message.
*   **Improve Productivity:** Find specific information or answers within your group chats efficiently.
*   **Stay Informed:** Keep up-to-date with important discussions you might have missed.
*   **Explore AI:** Provide a practical, hands-on example of integrating LLMs into everyday tools.

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
4.  **Configure Environment:**
    *   Create a `.env` file in the `backend` directory. You can copy from `.env.example` if it exists, or create a new one.
    *   Add your OpenAI API key and optionally specify the model and port:
        ```env
        OPENAI_API_KEY=your_openai_api_key_here
        OPENAI_MODEL=gpt-4o-mini # Or your preferred model
        PORT=3000 # Optional, defaults to 3000
        ```
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

## 🤝 Contributing

Contributions make the open-source community amazing! If you'd like to contribute:

1.  **Fork** the repository on GitHub.
2.  Create a **new branch** for your feature or bug fix (e.g., `feature/awesome-new-thing` or `bugfix/annoying-glitch`).
3.  Make your changes and **commit** them with clear, descriptive messages.
4.  **Push** your changes to your forked repository.
5.  Open a **Pull Request** to the main repository, detailing your changes.

Please ensure your code follows existing styles and that new features are tested where possible.

## 🗺️ Future Roadmap

*   User-configurable summary lengths/styles.
*   Date-range or specific message count selection for fetching.
*   Advanced caching strategies for performance and API cost optimization.
*   Support for other LLM providers.
*   More AI-driven group management features!

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