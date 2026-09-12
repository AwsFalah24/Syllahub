import {
  addDays,
  addWeeks,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export const WEEK_STARTS_ON = 1; // Monday

/** Build a UTC instant from a local date (+ optional time) in the user's timezone. */
export function toDueAt(date: string, time: string | null, timezone: string): string {
  const local = `${date}T${time ?? "23:59"}:00`;
  return fromZonedTime(local, timezone).toISOString();
}

/** Split an ISO instant back into local date + time strings for editing. */
export function fromDueAt(iso: string, timezone: string, allDay: boolean) {
  return {
    date: formatInTimeZone(iso, timezone, "yyyy-MM-dd"),
    time: allDay ? null : formatInTimeZone(iso, timezone, "HH:mm"),
  };
}

/** "Now" expressed in the user's local wall-clock (for grouping/labels). */
export function nowInTz(timezone: string) {
  return toZonedTime(new Date(), timezone);
}

export function localDate(iso: string, timezone: string) {
  return toZonedTime(iso, timezone);
}

export type Bucket = "overdue" | "today" | "thisWeek" | "nextWeek" | "later" | "undated";

export function bucketFor(due: Date | null, now: Date): Bucket {
  if (!due) return "undated";
  const today = startOfDay(now);
  if (isBefore(due, today)) return "overdue";
  if (isSameDay(due, now)) return "today";
  const weekEnd = endOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  if (!isBefore(weekEnd, due)) return "thisWeek";
  const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: WEEK_STARTS_ON });
  if (!isBefore(nextWeekEnd, due)) return "nextWeek";
  return "later";
}

export const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: "Overdue",
  today: "Today",
  thisWeek: "This week",
  nextWeek: "Next week",
  later: "Later",
  undated: "No date yet",
};

/** `due` and `now` must both be in the same (user) wall-clock frame. */
export function relativeDue(due: Date, now: Date, allDay: boolean) {
  const days = differenceInCalendarDays(due, now);
  if (days === 0) return allDay ? "Due today" : `Today · ${format(due, "h:mm a")}`;
  if (days === 1) return allDay ? "Tomorrow" : `Tomorrow · ${format(due, "h:mm a")}`;
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days < 7) return format(due, "EEEE") + (allDay ? "" : ` · ${format(due, "h:mm a")}`);
  return format(due, "MMM d") + (allDay ? "" : ` · ${format(due, "h:mm a")}`);
}

export function daysUntil(due: Date, now: Date) {
  return differenceInCalendarDays(due, now);
}

/** Week key (Monday date) for grouping. */
export function weekKey(d: Date) {
  return format(startOfWeek(d, { weekStartsOn: WEEK_STARTS_ON }), "yyyy-MM-dd");
}

export function weekRange(start: Date) {
  const s = startOfWeek(start, { weekStartsOn: WEEK_STARTS_ON });
  return { start: s, end: addDays(s, 6) };
}

export function formatWeekLabel(weekStart: Date) {
  const end = addDays(weekStart, 6);
  if (weekStart.getMonth() === end.getMonth()) {
    return `${format(weekStart, "MMM d")}–${format(end, "d")}`;
  }
  return `${format(weekStart, "MMM d")} – ${format(end, "MMM d")}`;
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatTimeStr(t: string) {
  // "14:30:00" | "14:30" → "2:30 PM"
  const [h, m] = t.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return format(d, m === 0 ? "h a" : "h:mm a");
}
