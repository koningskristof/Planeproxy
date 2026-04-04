const cheerio = require("cheerio");

const MAX_TEXT_LENGTH = 10000;
const MAX_REDIRECTS = 5;

async function fetchUrl(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "nl-BE,nl;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  return response;
}

async function fetchWebContent(url) {
  // Normalize URL
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  const response = await fetchUrl(url);

  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();

  // If it's JSON, return formatted JSON
  if (contentType.includes("application/json")) {
    try {
      const json = JSON.parse(body);
      const formatted = JSON.stringify(json, null, 2);
      return truncate(formatted, "JSON");
    } catch {
      return truncate(body, "Raw");
    }
  }

  // If it's plain text, return as-is
  if (contentType.includes("text/plain")) {
    return truncate(body, "Text");
  }

  // Parse HTML and extract readable content
  const $ = cheerio.load(body);

  // Remove non-content elements
  $("script, style, nav, footer, header, iframe, noscript, svg, [role='navigation'], [role='banner'], .sidebar, .menu, .nav, .advertisement, .ad").remove();

  // Get title
  const title = $("title").text().trim();

  // Try to find main content area
  const mainSelectors = ["article", "main", "[role='main']", ".content", ".post", ".article", "#content"];
  let contentEl = null;
  for (const sel of mainSelectors) {
    if ($(sel).length) {
      contentEl = $(sel).first();
      break;
    }
  }

  // Fall back to body
  if (!contentEl) {
    contentEl = $("body");
  }

  // Resolve relative URLs to absolute
  const baseUrl = new URL(url);
  function resolveUrl(href) {
    if (!href) return null;
    try {
      return new URL(href, baseUrl).href;
    } catch {
      return null;
    }
  }

  // Extract text content
  const lines = [];
  if (title) lines.push(`📰 *${title}*\n`);

  // Extract article text (headings, paragraphs, lists, quotes)
  contentEl.find("h1, h2, h3, h4, h5, h6, p, li, blockquote").each((_, el) => {
    const tag = el.tagName;
    const $el = $(el);
    let text = $el.text().trim().replace(/\s+/g, " ");
    if (!text) return;

    if (tag.startsWith("h")) {
      const level = parseInt(tag[1]);
      text = "#".repeat(level) + " " + text;
    } else if (tag === "li") {
      text = "- " + text;
    } else if (tag === "blockquote") {
      text = "> " + text;
    }

    lines.push(text);
  });

  // Also extract links (always, after text content)
  const linkLines = [];
  const seenLinks = new Set();
  contentEl.find("a").each((_, el) => {
    const $el = $(el);
    const href = resolveUrl($el.attr("href"));
    const text = $el.text().trim().replace(/\s+/g, " ");
    if (!text || text.length < 10 || !href) return;
    if (href.startsWith("javascript:") || href.includes("#") && href.split("#")[0] === url) return;
    if (seenLinks.has(href)) return;
    seenLinks.add(href);

    const parent = $el.closest("li, article, div");
    const timeEl = parent.find("time").first();
    const timeText = timeEl.length ? ` (${timeEl.text().trim()})` : "";

    linkLines.push(`• ${text}${timeText}\n  🔗 ${href}`);
  });

  if (linkLines.length > 0) {
    lines.push("\n---\n🔗 *Links:*\n");
    lines.push(...linkLines);
  }

  let result = lines.join("\n");
  if (!result.trim()) {
    result = contentEl.text().replace(/\s+/g, " ").trim();
    if (title) result = `Title: ${title}\n\n${result}`;
  }

  return truncate(result, "Webpage");
}

function truncate(text, label) {
  if (text.length > MAX_TEXT_LENGTH) {
    return `[${label} - afgekapt tot ${MAX_TEXT_LENGTH} tekens]\n\n${text.slice(0, MAX_TEXT_LENGTH)}...\n\n[Afgekapt - gebruik /fetch URL start-end voor specifieke secties]`;
  }
  return text;
}

module.exports = { fetchWebContent };
