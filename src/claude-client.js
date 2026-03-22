const Anthropic = require("@anthropic-ai/sdk");

const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const maxTokens = parseInt(process.env.MAX_TOKENS || "4096", 10);

const client = new Anthropic();

// Per-user conversation history (in-memory)
const conversations = new Map();

const SYSTEM_PROMPT = `Je bent een behulpzame AI-assistent die communiceert via Telegram.
De gebruiker zit waarschijnlijk in een vliegtuig met beperkt internet (alleen messaging-apps werken).
Houd antwoorden beknopt maar informatief - lange berichten zijn lastig op mobiel.
Je kunt Nederlands en Engels. Antwoord in de taal van de gebruiker.
Als de gebruiker een website-inhoud deelt (via /fetch), help dan met het samenvatten of beantwoorden van vragen erover.`;

async function askClaude(userId, userMessage) {
  if (!conversations.has(userId)) {
    conversations.set(userId, []);
  }
  const history = conversations.get(userId);

  history.push({ role: "user", content: userMessage });

  // Keep history manageable (last 20 messages)
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    messages: history,
  });

  const assistantMessage = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");

  history.push({ role: "assistant", content: assistantMessage });

  return assistantMessage;
}

function clearHistory(userId) {
  conversations.delete(userId);
}

module.exports = { askClaude, clearHistory };
