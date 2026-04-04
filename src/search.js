const cheerio = require("cheerio");

async function searchDuckDuckGo(query) {
  // Use DuckDuckGo HTML lite version (no JS required)
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "nl-BE,nl;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    signal: AbortSignal.timeout(15000),
  });

  const body = await response.text();
  const $ = cheerio.load(body);

  const results = [];
  $(".result").each((_, el) => {
    const $el = $(el);
    const titleEl = $el.find(".result__a").first();
    const title = titleEl.text().trim();
    const snippet = $el.find(".result__snippet").text().trim();
    // DuckDuckGo HTML wraps URLs in a redirect, extract the real URL
    const rawHref = titleEl.attr("href") || "";
    let url = rawHref;
    const uddgMatch = rawHref.match(/[?&]uddg=([^&]+)/);
    if (uddgMatch) {
      url = decodeURIComponent(uddgMatch[1]);
    }

    if (title && url) {
      results.push({ title, url, snippet });
    }
  });

  return results.slice(0, 8);
}

function formatResults(query, results) {
  if (results.length === 0) {
    return `Geen resultaten gevonden voor "${query}"`;
  }

  const lines = [`🔍 *Resultaten voor "${query}":*\n`];

  results.forEach((r, i) => {
    lines.push(`${i + 1}. *${r.title}*`);
    if (r.snippet) lines.push(`   ${r.snippet}`);
    lines.push(`   🔗 ${r.url}\n`);
  });

  lines.push(`💡 Gebruik /fetch URL om een resultaat te openen`);

  return lines.join("\n");
}

module.exports = { searchDuckDuckGo, formatResults };
