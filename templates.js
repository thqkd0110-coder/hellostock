function fmtPrice(n) {
  return n.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtSigned(n, decimals = 2) {
  const s = n.toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return n >= 0 ? `+${s}` : s;
}

function fmtPct(n) {
  return fmtSigned(n) + "%";
}

function arrow(n) {
  return n >= 0 ? "▲" : "▼";
}

function mmdd(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now).replace("-", "/");
}

function indexLine(label, q) {
  return `• ${label}: ${fmtPrice(q.price)} (${arrow(q.changeAbs)} ${fmtSigned(
    q.changeAbs,
  )}pt, ${fmtPct(q.changePct)})`;
}

function newsBlock(title, headlines) {
  if (!headlines || headlines.length === 0) return "";
  const lines = headlines.map((h) => `• "${h}"`).join("\n");
  return `\n\n${title}\n${lines}`;
}

function msg1({ nasdaq, dow, usNews }, now) {
  return `📊 [${mmdd(now)}] 전일 미국 증시 마감 브리핑

📈 주요 지수
${indexLine("나스닥종합지수", nasdaq)}
${indexLine("다우존스산업평균", dow)}${newsBlock("📰 관련 뉴스", usNews)}`;
}

function msg2({ nasdaq, dow, usNews, krNews }, now) {
  return `🇰🇷 [${mmdd(now)}] 개장 전 브리핑

🌐 전일 미국 증시 마감 (참고)
${indexLine("나스닥종합지수", nasdaq)}
${indexLine("다우존스산업평균", dow)}${newsBlock("📰 오늘의 주요 뉴스", [
    ...(usNews || []),
    ...(krNews || []),
  ])}`;
}

function msg3({ kospi, kosdaq, krNews }, now) {
  return `🔔 [${mmdd(now)}] 코스피·코스닥 개장 동향

${indexLine("코스피", kospi)}
${indexLine("코스닥", kosdaq)}${newsBlock("📰 관련 뉴스", krNews)}`;
}

function msg4({ kospi, kosdaq, krNews }, now) {
  return `🏁 [${mmdd(now)}] 코스피·코스닥 마감 시황

${indexLine("코스피", kospi)}
${indexLine("코스닥", kosdaq)}${newsBlock("📰 마감 관련 뉴스", krNews)}

오늘 하루도 증시 확인하시느라 고생 많으셨습니다. 편안한 저녁 보내세요.`;
}

module.exports = { msg1, msg2, msg3, msg4 };
