const cheerio = require("cheerio");

const MAX_TEXT_LENGTH = 10000;
const MAX_REDIRECTS = 5;

async function fetchWithRedirects(url) {
  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    return response;
  }
  throw new Error("Te veel redirects");
}

async function fetchWebContent(url) {
  // Normalize URL
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  const response = await fetchWithRedirects(url);

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

  // Extract text with links
  const lines = [];
  if (title) lines.push(`📰 *${title}*\n`);

  // For news sites, prioritize extracting article links
  const seenLinks = new Set();
  contentEl.find("a").each((_, el) => {
    const $el = $(el);
    const href = resolveUrl($el.attr("href"));
    const text = $el.text().trim().replace(/\s+/g, " ");
    if (!text || text.length < 10 || !href) return;
    // Skip non-article links (anchors, javascript, social media share, etc.)
    if (href.startsWith("javascript:") || href.includes("#") && href.split("#")[0] === url) return;
    if (seenLinks.has(href)) return;
    seenLinks.add(href);

    // Find time/date info near the link
    const parent = $el.closest("li, article, div");
    const timeEl = parent.find("time").first();
    const timeText = timeEl.length ? ` (${timeEl.text().trim()})` : "";

    lines.push(`• ${text}${timeText}\n  🔗 ${href}\n`);
  });

  // If no links found, fall back to text extraction
  if (lines.length <= 1) {
    contentEl.find("h1, h2, h3, h4, h5, h6, p, li, blockquote").each((_, el) => {
      const tag = el.tagName;
      const $el = $(el);
      let text = $el.text().trim().replace(/\s+/g, " ");
      if (!text) return;

      // Check for a link inside this element
      const link = $el.find("a").first();
      const href = resolveUrl(link.attr("href"));

      if (tag.startsWith("h")) {
        const level = parseInt(tag[1]);
        text = "#".repeat(level) + " " + text;
      } else if (tag === "li") {
        text = "- " + text;
      } else if (tag === "blockquote") {
        text = "> " + text;
      }

      if (href && !href.startsWith("javascript:")) {
        text += `\n  🔗 ${href}`;
      }

      lines.push(text);
    });
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
