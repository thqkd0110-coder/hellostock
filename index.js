require("dotenv").config();

const cron = require("node-cron");
const { getQuote } = require("./market");
const { isKrxHolidayToday, isMostRecentUsSessionHoliday } = require("./holidays");
const templates = require("./templates");
const { fetchHeadlines } = require("./news");
const { fetchTopThemes, fetchBottomThemes } = require("./themes");

const US_KEYWORDS = ["stock", "dow", "nasdaq", "s&p", "market", "bond", "fed", "oil", "rate"];
const KR_KEYWORDS = ["코스피", "코스닥", "증시", "환율", "금리", "채권", "외국인", "수급"];

async function safeHeadlines(market, keywords) {
  try {
    return await fetchHeadlines(market, { limit: 3, keywords });
  } catch (err) {
    log(`news fetch failed (${market}):`, err.message || err);
    return [];
  }
}

async function safeThemes(kind) {
  try {
    return kind === "top" ? await fetchTopThemes(3) : await fetchBottomThemes(3);
  } catch (err) {
    log(`theme fetch failed (${kind}):`, err.message || err);
    return [];
  }
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

for (const key of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram send failed: ${JSON.stringify(data)}`);
  }
  return data;
}

async function runBriefing(name, { skipCheck, fetchData, buildMessage }) {
  log(`=== starting ${name} ===`);
  try {
    if (skipCheck()) {
      log(`${name}: SKIPPED (holiday)`);
      return;
    }

    const data = await fetchData();
    const text = buildMessage(data, new Date());

    await sendTelegram(text);
    log(`${name}: sent successfully`);
  } catch (err) {
    log(`${name}: FAILED -`, err.message || err);
  }
}

const JOBS = {
  1: [
    "msg1_us_market_close",
    {
      skipCheck: isMostRecentUsSessionHoliday,
      fetchData: async () => ({
        nasdaq: await getQuote("nasdaq"),
        dow: await getQuote("dow"),
        usNews: await safeHeadlines("us", US_KEYWORDS),
      }),
      buildMessage: templates.msg1,
    },
  ],
  2: [
    "msg2_pre_open",
    {
      skipCheck: isKrxHolidayToday,
      fetchData: async () => ({
        nasdaq: await getQuote("nasdaq"),
        dow: await getQuote("dow"),
        usNews: await safeHeadlines("us", US_KEYWORDS),
        krNews: await safeHeadlines("kr", KR_KEYWORDS),
      }),
      buildMessage: templates.msg2,
    },
  ],
  3: [
    "msg3_open_snapshot",
    {
      skipCheck: isKrxHolidayToday,
      fetchData: async () => ({
        kospi: await getQuote("kospi"),
        kosdaq: await getQuote("kosdaq"),
        krNews: await safeHeadlines("kr", KR_KEYWORDS),
        topThemes: await safeThemes("top"),
        bottomThemes: await safeThemes("bottom"),
      }),
      buildMessage: templates.msg3,
    },
  ],
  4: [
    "msg4_close_summary",
    {
      skipCheck: isKrxHolidayToday,
      fetchData: async () => ({
        kospi: await getQuote("kospi"),
        kosdaq: await getQuote("kosdaq"),
        krNews: await safeHeadlines("kr", KR_KEYWORDS),
        topThemes: await safeThemes("top"),
        bottomThemes: await safeThemes("bottom"),
      }),
      buildMessage: templates.msg4,
    },
  ],
};

// CLI mode: `node index.js 1` runs one briefing immediately and exits.
const cliArg = process.argv[2];
if (cliArg && JOBS[cliArg]) {
  const [name, job] = JOBS[cliArg];
  runBriefing(name, job).then(() => process.exit(0));
} else {
  log("Scheduler starting. Registering 4 cron jobs (Asia/Seoul, Mon-Fri).");

  const opts = { timezone: "Asia/Seoul" };
  cron.schedule("0 7 * * 1-5", () => runBriefing(...JOBS[1]), opts);
  cron.schedule("30 8 * * 1-5", () => runBriefing(...JOBS[2]), opts);
  cron.schedule("10 9 * * 1-5", () => runBriefing(...JOBS[3]), opts);
  cron.schedule("40 15 * * 1-5", () => runBriefing(...JOBS[4]), opts);

  log("Cron jobs registered: 07:00 / 08:30 / 09:10 / 15:40 KST, Mon-Fri.");

  if (process.env.PORT) {
    require("http")
      .createServer((_req, res) => res.end("ok"))
      .listen(process.env.PORT, () => log(`Health server listening on ${process.env.PORT}`));
  }
}
