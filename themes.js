// Korean sector "theme" rankings via Naver Finance's public theme-list page
// (no API key). Naver serves this page as EUC-KR despite its meta tag
// claiming utf-8, so the raw bytes must be decoded explicitly.

const BASE_URL = "https://finance.naver.com/sise/theme.naver";

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

const ROW_RE = /<tr>\s*<td class="col_type1">[\s\S]*?<\/tr>/g;
const NAME_RE = /sise_group_detail\.naver\?type=theme&no=\d+">([^<]+)<\/a>/;
const RATE_RE = /class="number col_type2">\s*<span[^>]*>\s*([+\-0-9.,%]+)\s*<\/span>/;
const LEADER_RE = /<a href="\/item\/main\.naver\?code=\d+">([^<]+)<\/a>/g;

async function fetchThemeHtml(ordering) {
  const url = `${BASE_URL}?field=change_rate&ordering=${ordering}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Naver theme request failed: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder("euc-kr").decode(buf);
}

function parseThemes(html) {
  const rows = html.match(ROW_RE) || [];
  const themes = [];
  for (const row of rows) {
    const nameMatch = NAME_RE.exec(row);
    const rateMatch = RATE_RE.exec(row);
    if (!nameMatch || !rateMatch) continue;

    const leaders = [];
    let leaderMatch;
    LEADER_RE.lastIndex = 0;
    while ((leaderMatch = LEADER_RE.exec(row)) !== null) {
      // Naver truncates long names server-side with "..".
      leaders.push(decodeEntities(leaderMatch[1]).replace(/\.\.$/, "…"));
    }

    themes.push({
      name: decodeEntities(nameMatch[1]),
      changePct: Number(rateMatch[1].replace(/[^0-9.\-]/g, "")),
      leaders,
    });
  }
  return themes;
}

// "주요 테마" - today's top-gaining sector themes.
async function fetchTopThemes(limit = 3) {
  const html = await fetchThemeHtml("desc");
  return parseThemes(html).slice(0, limit);
}

// "관심 테마" - today's top-declining sector themes, worth watching.
async function fetchBottomThemes(limit = 3) {
  const html = await fetchThemeHtml("asc");
  return parseThemes(html).slice(0, limit);
}

module.exports = { fetchTopThemes, fetchBottomThemes };
