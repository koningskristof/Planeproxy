const TelegramBot = require("node-telegram-bot-api");
const { askClaude, clearHistory } = require("./claude-client");
const { fetchWebContent } = require("./web-scraper");

// Load .env if present
try {
  require("fs")
    .readFileSync(".env", "utf8")
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"))
    .forEach((line) => {
      const [key, ...rest] = line.split("=");
      if (key && rest.length) {
        process.env[key.trim()] = rest.join("=").trim();
      }
    });
} catch {
  // no .env file, rely on environment variables
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is required. Set it in .env or as environment variable.");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is required. Set it in .env or as environment variable.");
  process.exit(1);
}

const allowedUsers = process.env.ALLOWED_USERS
  ? process.env.ALLOWED_USERS.split(",").map((id) => parseInt(id.trim(), 10))
  : [];

const bot = new TelegramBot(token, { polling: true });

console.log("PlaneProxy is running! Waiting for Telegram messages...");

// Auth check
function isAllowed(userId) {
  return allowedUsers.length === 0 || allowedUsers.includes(userId);
}

// Send long messages in chunks (Telegram has a 4096 char limit)
async function sendLong(chatId, text, options = {}) {
  const MAX = 4000;
  if (text.length <= MAX) {
    return bot.sendMessage(chatId, text, options);
  }
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX) {
      chunks.push(remaining);
      break;
    }
    // Try to split at a newline
    let splitAt = remaining.lastIndexOf("\n", MAX);
    if (splitAt < MAX / 2) splitAt = MAX;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  for (const chunk of chunks) {
    await bot.sendMessage(chatId, chunk, options);
  }
}

// /start command
bot.onText(/\/start/, (msg) => {
  if (!isAllowed(msg.from.id)) return;
  sendLong(
    msg.chat.id,
    `Welkom bij *PlaneProxy*! ✈️

Ik ben je AI-assistent die werkt via Telegram — perfect voor in het vliegtuig.

*Commando's:*
- Stuur gewoon een bericht → ik beantwoord het via Claude AI
- \`/fetch URL\` → haal de tekst van een website op
- \`/summarize URL\` → haal een website op en vat deze samen
- \`/clear\` → wis de gespreksgeschiedenis
- \`/help\` → toon dit bericht

*Voorbeeld:*
\`/fetch wikipedia.org/wiki/Amsterdam\`
\`/summarize nos.nl\`
Of stel gewoon een vraag!`,
    { parse_mode: "Markdown" }
  );
});

// /help command
bot.onText(/\/help/, (msg) => {
  if (!isAllowed(msg.from.id)) return;
  sendLong(
    msg.chat.id,
    `*PlaneProxy Commando's:*

📨 *Gewoon bericht* — Stel een vraag aan Claude AI
🌐 \`/fetch URL\` — Haal website-inhoud op als tekst
📝 \`/summarize URL\` — Haal website op + samenvatting door Claude
🗑 \`/clear\` — Wis gespreksgeschiedenis
🆔 \`/myid\` — Toon je Telegram user ID

💡 *Tips:*
- Antwoorden onthouden context (tot 20 berichten)
- Websites worden omgezet naar leesbare tekst
- Werkt perfect op vliegtuig-WiFi via Telegram!`,
    { parse_mode: "Markdown" }
  );
});

// /myid - useful for setting up ALLOWED_USERS
bot.onText(/\/myid/, (msg) => {
  bot.sendMessage(msg.chat.id, `Je Telegram user ID is: \`${msg.from.id}\``, {
    parse_mode: "Markdown",
  });
});

// /clear command
bot.onText(/\/clear/, (msg) => {
  if (!isAllowed(msg.from.id)) return;
  clearHistory(msg.from.id);
  bot.sendMessage(msg.chat.id, "Gespreksgeschiedenis gewist.");
});

// /fetch command - fetch website content
bot.onText(/\/fetch\s+(.+)/, async (msg, match) => {
  if (!isAllowed(msg.from.id)) return;
  const url = match[1].trim();
  const chatId = msg.chat.id;

  bot.sendChatAction(chatId, "typing");

  try {
    const content = await fetchWebContent(url);
    await sendLong(chatId, content);
  } catch (err) {
    bot.sendMessage(chatId, `Kon website niet ophalen: ${err.message}`);
  }
});

// /summarize command - fetch + summarize via Claude
bot.onText(/\/summarize\s+(.+)/, async (msg, match) => {
  if (!isAllowed(msg.from.id)) return;
  const url = match[1].trim();
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  bot.sendChatAction(chatId, "typing");

  try {
    const content = await fetchWebContent(url);
    bot.sendChatAction(chatId, "typing");
    const summary = await askClaude(
      userId,
      `Hier is de inhoud van ${url}:\n\n${content}\n\nGeef een beknopte samenvatting van deze pagina.`
    );
    await sendLong(chatId, summary);
  } catch (err) {
    bot.sendMessage(chatId, `Fout: ${err.message}`);
  }
});

// Regular messages - send to Claude
bot.on("message", async (msg) => {
  // Skip commands
  if (msg.text && msg.text.startsWith("/")) return;
  if (!msg.text) return;
  if (!isAllowed(msg.from.id)) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;

  bot.sendChatAction(chatId, "typing");

  try {
    const reply = await askClaude(userId, msg.text);
    await sendLong(chatId, reply);
  } catch (err) {
    console.error("Claude error:", err);
    bot.sendMessage(chatId, `Er ging iets mis: ${err.message}`);
  }
});

// Error handling
bot.on("polling_error", (err) => {
  console.error("Polling error:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
