const Anthropic = require("@anthropic-ai/sdk");
const { fetchWebContent } = require("./web-scraper");
const { searchDuckDuckGo } = require("./search");

const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const maxTokens = parseInt(process.env.MAX_TOKENS || "4096", 10);

const client = new Anthropic();

// Per-user conversation history (in-memory)
const conversations = new Map();

const SYSTEM_PROMPT = `Je bent een behulpzame AI-assistent die communiceert via Telegram.
De gebruiker zit waarschijnlijk in een vliegtuig met beperkt internet (alleen messaging-apps werken).
Houd antwoorden beknopt maar informatief - lange berichten zijn lastig op mobiel.
Je kunt Nederlands en Engels. Antwoord in de taal van de gebruiker.

Je hebt tools om het internet te doorzoeken en websites te lezen.
Gebruik deze proactief wanneer de gebruiker iets vraagt waarvoor actuele informatie nodig is, zoals:
- Nieuws, weer, sportuitslagen, evenementen
- Feiten die je wilt verifiëren
- Informatie over specifieke bedrijven, producten, of personen
- Alles waar je niet 100% zeker over bent

Zoek eerst, lees dan de relevante pagina's, en geef een samengevat antwoord.
Vermeld altijd de bron-URL zodat de gebruiker zelf kan doorklikken.`;

const tools = [
  {
    name: "web_search",
    description:
      "Zoek op het internet via DuckDuckGo. Gebruik dit om actuele informatie te vinden.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "De zoekterm",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_webpage",
    description:
      "Haal de tekstinhoud van een webpagina op. Gebruik dit om een specifieke URL te lezen.",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "De URL om op te halen",
        },
      },
      required: ["url"],
    },
  },
];

async function handleToolCall(toolName, toolInput) {
  if (toolName === "web_search") {
    const results = await searchDuckDuckGo(toolInput.query);
    if (results.length === 0) {
      return "Geen resultaten gevonden.";
    }
    return results
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   URL: ${r.url}`)
      .join("\n\n");
  }
  if (toolName === "fetch_webpage") {
    return await fetchWebContent(toolInput.url);
  }
  return "Onbekende tool.";
}

async function askClaude(userId, userMessage, onStatus) {
  if (!conversations.has(userId)) {
    conversations.set(userId, []);
  }
  const history = conversations.get(userId);

  history.push({ role: "user", content: userMessage });

  // Keep history manageable (last 20 messages)
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }

  // Tool use loop - Claude may call tools multiple times
  const MAX_TOOL_ROUNDS = 5;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      tools,
      messages: history,
    });

    // Check if Claude wants to use tools
    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

    if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
      // No tool calls, extract final text
      const text = response.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");

      history.push({ role: "assistant", content: response.content });
      return text;
    }

    // Claude wants to use tools
    history.push({ role: "assistant", content: response.content });

    const toolResults = [];
    for (const toolBlock of toolUseBlocks) {
      // Notify user what's happening
      if (onStatus) {
        const statusMsg =
          toolBlock.name === "web_search"
            ? `🔍 Zoeken: "${toolBlock.input.query}"...`
            : `🌐 Ophalen: ${toolBlock.input.url}...`;
        onStatus(statusMsg);
      }

      let result;
      try {
        result = await handleToolCall(toolBlock.name, toolBlock.input);
      } catch (err) {
        result = `Fout: ${err.message}`;
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolBlock.id,
        content: result,
      });
    }

    history.push({ role: "user", content: toolResults });
  }

  return "Ik heb te veel stappen nodig om dit te beantwoorden. Probeer een specifiekere vraag.";
}

function clearHistory(userId) {
  conversations.delete(userId);
}

module.exports = { askClaude, clearHistory };
