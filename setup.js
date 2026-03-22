#!/usr/bin/env node

const fs = require("fs");
const readline = require("readline");
const path = require("path");

const envPath = path.join(__dirname, ".env");
const examplePath = path.join(__dirname, ".env.example");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log("\n=== PlaneProxy Setup ===\n");

  if (fs.existsSync(envPath)) {
    const overwrite = await ask(".env file already exists. Overwrite? (y/N): ");
    if (overwrite.toLowerCase() !== "y") {
      console.log("Setup cancelled.");
      rl.close();
      return;
    }
  }

  console.log("You'll need:");
  console.log("  1. A Telegram Bot Token (from @BotFather on Telegram)");
  console.log("  2. An Anthropic API Key (from console.anthropic.com)\n");

  const botToken = await ask("Telegram Bot Token: ");
  if (!botToken.trim()) {
    console.error("Bot token is required. Run setup again when you have it.");
    rl.close();
    return;
  }

  const apiKey = await ask("Anthropic API Key: ");
  if (!apiKey.trim()) {
    console.error("API key is required. Run setup again when you have it.");
    rl.close();
    return;
  }

  const allowedUsers = await ask(
    "Allowed Telegram user IDs (comma-separated, leave empty to allow all): "
  );

  const envContent = `# Telegram Bot Token (get from @BotFather on Telegram)
TELEGRAM_BOT_TOKEN=${botToken.trim()}

# Anthropic API Key (get from console.anthropic.com)
ANTHROPIC_API_KEY=${apiKey.trim()}

# Optional: Comma-separated list of allowed Telegram user IDs (leave empty to allow all)
ALLOWED_USERS=${allowedUsers.trim()}

# Optional: Claude model to use (default: claude-sonnet-4-6)
CLAUDE_MODEL=claude-sonnet-4-6

# Optional: Max tokens for Claude responses (default: 4096)
MAX_TOKENS=4096
`;

  fs.writeFileSync(envPath, envContent);
  console.log("\n.env file created successfully!");
  console.log("Run 'npm start' to launch PlaneProxy.\n");

  rl.close();
}

main().catch((err) => {
  console.error("Setup error:", err.message);
  rl.close();
  process.exit(1);
});
