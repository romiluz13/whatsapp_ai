const fs = require('fs');
const readline = require('readline');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("\n===== WhatsApp AI Co-Pilot Setup =====\n");
console.log("This script will help you configure your OpenAI API key.\n");

// Check for existing .env file
const envPath = path.join(__dirname, '.env');
let existingKey = '';

if (fs.existsSync(envPath)) {
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/OPENAI_API_KEY=([^\s]*)/);
        
        if (match && match[1] && match[1] !== 'your_openai_api_key_here') {
            existingKey = match[1];
            console.log(`An existing OpenAI API key was found (${existingKey.slice(0, 3)}...${existingKey.slice(-4)}).`);
        }
    } catch (err) {
        console.error("Error reading .env file:", err.message);
    }
}

const askApiKey = () => {
    const defaultPrompt = existingKey ? 
        `Enter your OpenAI API key (press Enter to keep existing key): ` : 
        `Enter your OpenAI API key: `;
    
    rl.question(defaultPrompt, (apiKey) => {
        const keyToUse = apiKey.trim() || existingKey;
        
        if (!keyToUse) {
            console.log("Error: No API key provided. The key is required for AI functionality.");
            return askApiKey();
        }
        
        // Ask for model preference
        rl.question(`Select AI model (default is gpt-4o-mini):\n1. gpt-4o-mini (faster, cheaper)\n2. gpt-4o (more powerful)\nEnter choice [1/2]: `, (modelChoice) => {
            let model = 'gpt-4o-mini'; // Default
            
            if (modelChoice.trim() === '2') {
                model = 'gpt-4o';
            }
            
            // Create or update .env file
            const envContent = `# WhatsApp AI Co-Pilot Environment Variables

# OpenAI API Key
OPENAI_API_KEY=${keyToUse}

# Server port
PORT=3000

# OpenAI Model to use
OPENAI_MODEL=${model}
`;
            
            try {
                fs.writeFileSync(envPath, envContent);
                console.log("\n✅ Configuration saved successfully!");
                console.log("\nYou can now start the backend with:");
                console.log("  npm start");
                console.log("\nAnd install the Chrome extension from the extension/ folder.");
                
            } catch (err) {
                console.error("Error writing .env file:", err.message);
            }
            
            rl.close();
        });
    });
};

askApiKey(); 