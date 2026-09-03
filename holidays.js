// Hardcoded 2026 trading-holiday calendars.
// Verified via web search against official NYSE / KRX notices (Sep 2026).
// NOTE: these lists cover 2026 only and must be updated for future years.

const NYSE_HOLIDAYS_2026 = new Set([
  "2026-01-01", // New Year's Day
  "2026-01-19", // Martin Luther King Jr. Day
  "2026-02-16", // Washington's Birthday
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-06-19", // Juneteenth
  "2026-07-03", // Independence Day (observed)
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving
  "2026-12-25", // Christmas
]);

const KRX_HOLIDAYS_2026 = new Set([
  "2026-01-01", // 신정
  "2026-02-16", // 설날 연휴
  "2026-02-17", // 설날
  "2026-02-18", // 설날 연휴
  "2026-03-02", // 삼일절 대체공휴일
  "2026-05-01", // 근로자의 날
  "2026-05-05", // 어린이날
  "2026-05-25", // 부처님오신날 대체공휴일
  "2026-06-03", // 전국동시지방선거일
  "2026-07-17", // 제헌절
  "2026-08-17", // 광복절 대체공휴일
  "2026-09-24", // 추석 연휴
  "2026-09-25", // 추석
  "2026-10-05", // 개천절 대체공휴일
  "2026-10-09", // 한글날
  "2026-12-25", // 성탄절
  "2026-12-31", // 연말 휴장
]);

function toISODate(date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date); // en-CA gives YYYY-MM-DD
}

function isKrxHolidayToday(now = new Date()) {
  return KRX_HOLIDAYS_2026.has(toISODate(now));
}

// For the 07:00 KST "previous US session" check: if today (KST) is Monday,
// the most recent NYSE session is last Friday; otherwise it's yesterday.
function isMostRecentUsSessionHoliday(now = new Date()) {
  const kstWeekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(now);

  const target = new Date(now);
  const daysBack = kstWeekday === "Mon" ? 3 : 1;
  target.setUTCDate(target.getUTCDate() - daysBack);

  return NYSE_HOLIDAYS_2026.has(toISODate(target));
}

module.exports = { isKrxHolidayToday, isMostRecentUsSessionHoliday, toISODate };
