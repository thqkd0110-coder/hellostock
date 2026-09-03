// Free, no-key market data via Yahoo Finance's public chart endpoint.

const SYMBOLS = {
  nasdaq: "^IXIC",
  dow: "^DJI",
  kospi: "^KS11",
  kosdaq: "^KQ11",
};

async function fetchQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=1d&range=5d`;

  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) {
    throw new Error(`Yahoo Finance request failed for ${symbol}: HTTP ${res.status}`);
  }

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result || !result.meta) {
    throw new Error(`No chart data returned for ${symbol}`);
  }

  const meta = result.meta;
  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose;
  const changePct =
    meta.regularMarketChangePercent ?? ((price - prevClose) / prevClose) * 100;
  const changeAbs = meta.fulldayChange ?? price - prevClose;

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const series = timestamps
    .map((t, i) => ({ t, close: closes[i] }))
    .filter((p) => p.close != null);

  return {
    symbol,
    name: meta.longName || meta.shortName || symbol,
    price,
    prevClose,
    changeAbs,
    changePct,
    marketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : null,
    series,
  };
}

async function getQuote(name) {
  const symbol = SYMBOLS[name];
  if (!symbol) throw new Error(`Unknown symbol name: ${name}`);
  return fetchQuote(symbol);
}

module.exports = { getQuote, SYMBOLS };
