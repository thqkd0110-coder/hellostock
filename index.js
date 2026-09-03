require("dotenv").config();

const cron = require("node-cron");
const Anthropic = require("@anthropic-ai/sdk");
const prompts = require("./prompts");

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

for (const key of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const client = new Anthropic();

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

// The model has no built-in clock, so we inject the real current KST
// date/time into every prompt.
function kstDateLine() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return `오늘 날짜(한국시간, KST): ${parts.year}-${parts.month}-${parts.day} (${parts.weekday}) ${parts.hour}:${parts.minute}`;
}

async function askClaude(promptText) {
  let messages = [{ role: "user", content: promptText }];

  for (let i = 0; i < 6; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
      messages,
    });

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    if (response.stop_reason === "refusal") {
      throw new Error(`Claude refused: ${JSON.stringify(response.stop_details)}`);
    }

    return response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  }

  throw new Error("Exceeded max resume iterations without a final answer");
}

function parseDecision(rawText) {
  const trimmed = rawText.trim();
  if (trimmed.startsWith("SKIP")) {
    return { send: false, reason: trimmed.slice(4).trim() };
  }
  if (trimmed.startsWith("SEND")) {
    const message = trimmed.slice(4).replace(/^\s*\n/, "").trim();
    return { send: true, message };
  }
  // Fallback: model didn't follow the format. Treat the whole thing as the
  // message rather than silently dropping it.
  log("WARNING: response did not start with SKIP/SEND, sending as-is");
  return { send: true, message: trimmed };
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

async function runBriefing(name, promptFn) {
  log(`=== starting ${name} ===`);
  try {
    const promptText = promptFn(kstDateLine());
    const raw = await askClaude(promptText);
    const decision = parseDecision(raw);

    if (!decision.send) {
      log(`${name}: SKIPPED (${decision.reason || "no reason given"})`);
      return;
    }

    await sendTelegram(decision.message);
    log(`${name}: sent successfully (${decision.message.length} chars)`);
  } catch (err) {
    log(`${name}: FAILED -`, err.message || err);
  }
}

const JOBS = {
  1: ["msg1_us_market_close", prompts.msg1],
  2: ["msg2_pre_open", prompts.msg2],
  3: ["msg3_open_snapshot", prompts.msg3],
  4: ["msg4_close_summary", prompts.msg4],
};

// CLI mode: `node index.js 1` runs one briefing immediately and exits.
// Useful for manual testing (locally or via `railway run`).
const cliArg = process.argv[2];
if (cliArg && JOBS[cliArg]) {
  const [name, fn] = JOBS[cliArg];
  runBriefing(name, fn).then(() => process.exit(0));
} else {
  log(`Scheduler starting (model=${MODEL}). Registering 4 cron jobs (Asia/Seoul, Mon-Fri).`);

  const opts = { timezone: "Asia/Seoul" };
  cron.schedule("0 7 * * 1-5", () => runBriefing(...JOBS[1]), opts);
  cron.schedule("30 8 * * 1-5", () => runBriefing(...JOBS[2]), opts);
  cron.schedule("10 9 * * 1-5", () => runBriefing(...JOBS[3]), opts);
  cron.schedule("40 15 * * 1-5", () => runBriefing(...JOBS[4]), opts);

  log("Cron jobs registered: 07:00 / 08:30 / 09:10 / 15:40 KST, Mon-Fri.");

  // Optional health endpoint - only if Railway assigns a PORT.
  if (process.env.PORT) {
    require("http")
      .createServer((_req, res) => res.end("ok"))
      .listen(process.env.PORT, () => log(`Health server listening on ${process.env.PORT}`));
  }
}
