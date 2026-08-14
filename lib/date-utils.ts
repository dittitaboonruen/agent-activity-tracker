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

/** A full "refreshed at" label in Thai, for the header sync indicator — e.g. "14 สิงหาคม 2569 · 14:32 น. (เวลาไทย)". */
export function bangkokRefreshLabel(utcIso: string): string {
  const dateStr = bangkokDateStr(utcIso); // YYYY-MM-DD, already resolved to Asia/Bangkok
  const time = bangkokTimeStr(utcIso);
  return `${formatThaiDateLong(dateStr)} · ${time} น. (เวลาไทย)`;
}

/** Parses a YYYY-MM-DD string into a local Date object, for display formatting only. */
export function parseYMD(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Formats a Bangkok-local calendar date (a YYYY-MM-DD string, e.g. from
 * bangkokDateStr/todayBangkokStr) as a full Thai date with the full month
 * name — e.g. "14 สิงหาคม 2569". Used everywhere a user-visible date is shown
 * on the dashboard. This only changes display formatting; it has no effect on
 * how dates are computed, filtered, or interpreted anywhere else.
 *
 * Takes the YYYY-MM-DD string rather than a Date object, and anchors it at
 * noon UTC before formatting. That avoids the calendar day ever shifting by
 * ±1 due to the runtime's own local timezone (server or any manager's
 * browser) — Bangkok is a fixed UTC+7 with no DST, so noon UTC always falls
 * within the same calendar day when displayed in Asia/Bangkok.
 */
export function formatThaiDateLong(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: BANGKOK_TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(anchor);
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${THAI_MONTHS[parseInt(m, 10) - 1]} ${parseInt(y, 10) + 543}`;
}
