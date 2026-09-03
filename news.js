// Free RSS headline fetching (no API key). Used to attach real news
// headlines as background context, since no LLM is generating analysis.

const FEEDS = {
  us: "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain", // WSJ Markets
  kr: "https://www.yna.co.kr/rss/market.xml", // 연합뉴스 마켓+
};

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

const TITLE_RE = /<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/title>/;

function extractTitles(xml) {
  const titles = [];
  // Only look inside <item>...</item> - the channel/image title(s) at the
  // top of the feed are not stories and must not be treated as headlines.
  const itemRe = /<item\b[\s\S]*?<\/item>/g;
  let itemMatch;
  while ((itemMatch = itemRe.exec(xml)) !== null) {
    const titleMatch = TITLE_RE.exec(itemMatch[0]);
    if (!titleMatch) continue;
    const raw = (titleMatch[1] ?? titleMatch[2] ?? "").trim();
    if (raw) titles.push(decodeEntities(raw));
  }
  return titles;
}

async function fetchHeadlines(market, { limit = 3, keywords = [] } = {}) {
  const url = FEEDS[market];
  if (!url) throw new Error(`Unknown news market: ${market}`);

  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`News feed request failed (${market}): HTTP ${res.status}`);

  const xml = await res.text();
  const titles = extractTitles(xml);

  if (keywords.length === 0) return titles.slice(0, limit);

  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  const matched = titles.filter((t) =>
    lowerKeywords.some((k) => t.toLowerCase().includes(k)),
  );

  const result = matched.slice(0, limit);
  if (result.length < limit) {
    for (const t of titles) {
      if (result.length >= limit) break;
      if (!result.includes(t)) result.push(t);
    }
  }
  return result;
}

module.exports = { fetchHeadlines };
