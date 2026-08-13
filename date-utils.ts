// Every date calculation in this dashboard is anchored to Asia/Bangkok (UTC+7),
// regardless of the server's or the manager's browser's local timezone.
export const BANGKOK_TZ = "Asia/Bangkok";

export const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** Converts a UTC ISO timestamp to its Asia/Bangkok calendar date, formatted YYYY-MM-DD. */
export function bangkokDateStr(utcIso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(utcIso));
}

/** Formats a UTC ISO timestamp as an Asia/Bangkok HH:mm 24-hour time string. */
export function bangkokTimeStr(utcIso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: BANGKOK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(utcIso));
}

/** Today's calendar date in Asia/Bangkok, formatted YYYY-MM-DD. */
export function todayBangkokStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** A full "refreshed at" label in Thai, for the header sync indicator. */
export function bangkokRefreshLabel(utcIso: string): string {
  const d = new Date(utcIso);
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  const [y, m, day] = dateStr.split("-").map(Number);
  const time = bangkokTimeStr(utcIso);
  return `${day} ${THAI_MONTHS[m - 1]} ${y + 543} · ${time} น. (เวลาไทย)`;
}

/** Parses a YYYY-MM-DD string into a local Date object, for display formatting only. */
export function parseYMD(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function fmtDateThai(d: Date): string {
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear() + 543}`;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${THAI_MONTHS[parseInt(m, 10) - 1]} ${parseInt(y, 10) + 543}`;
}
