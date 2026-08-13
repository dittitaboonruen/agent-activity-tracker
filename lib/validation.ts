import type { Filters, DateQuickOption } from "@/types";

const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** True for a syntactically and calendrically valid YYYY-MM-DD string. */
export function isValidYMD(value: string): boolean {
  if (!YMD_REGEX.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * Clamps incoming filter changes to known-safe shapes before they enter component
 * state. Today these values can only come from trusted UI controls — a native
 * <select> populated from the agents/channels already returned by the server, and
 * an <input type="date">) — so this is defense-in-depth: it guards against DOM
 * tampering in devtools and against any future change that wires filters to URL
 * query parameters, without changing any current filter behavior.
 */
export function sanitizeFilterChange(
  next: Partial<Filters>,
  current: Filters,
  agents: string[],
  channels: string[]
): Partial<Filters> {
  const sanitized: Partial<Filters> = {};

  if (next.dateQuick !== undefined) {
    const value: DateQuickOption = next.dateQuick === "custom" ? "custom" : "today";
    sanitized.dateQuick = value;
  }

  if (next.customStart !== undefined) {
    sanitized.customStart = next.customStart === "" || isValidYMD(next.customStart) ? next.customStart : current.customStart;
  }

  if (next.customEnd !== undefined) {
    sanitized.customEnd = next.customEnd === "" || isValidYMD(next.customEnd) ? next.customEnd : current.customEnd;
  }

  if (next.agentFilter !== undefined) {
    sanitized.agentFilter = next.agentFilter === "all" || agents.includes(next.agentFilter) ? next.agentFilter : "all";
  }

  if (next.channelFilter !== undefined) {
    sanitized.channelFilter =
      next.channelFilter === "all" || channels.includes(next.channelFilter) ? next.channelFilter : "all";
  }

  return sanitized;
}

