import { addWeeks, startOfWeek } from "date-fns";
import type { Assignment, AssignmentType } from "@/lib/types";
import { localDate, WEEK_STARTS_ON, weekKey } from "@/lib/dates";

/** Rough effort weighting per item type — used to color busy weeks. */
const TYPE_LOAD: Record<AssignmentType, number> = {
  exam: 3,
  project: 3,
  assignment: 1.5,
  quiz: 1.25,
  reading: 0.5,
  other: 1,
};

export function loadScore(a: Pick<Assignment, "type" | "weight_percent" | "estimated_hours">) {
  let base = TYPE_LOAD[a.type] ?? 1;
  if (a.weight_percent != null && a.weight_percent > 0) base = Math.max(base, a.weight_percent / 8);
  if (a.estimated_hours != null && a.estimated_hours > 0) base = Math.max(base, a.estimated_hours / 3);
  return base;
}

export type LoadLevel = "none" | "light" | "moderate" | "heavy";

export function levelFor(score: number): LoadLevel {
  if (score <= 0) return "none";
  if (score < 2.5) return "light";
  if (score < 5.5) return "moderate";
  return "heavy";
}

export const LOAD_STYLES: Record<LoadLevel, { bg: string; text: string; label: string; dot: string }> = {
  none: { bg: "bg-surface-2", text: "text-ink-subtle", label: "Clear", dot: "bg-line-strong" },
  light: { bg: "bg-brand-100", text: "text-brand-800", label: "Light", dot: "bg-brand-300" },
  moderate: { bg: "bg-brand-300", text: "text-brand-900", label: "Moderate", dot: "bg-brand-500" },
  heavy: { bg: "bg-brand-600", text: "text-white", label: "Heavy", dot: "bg-brand-700" },
};

export interface WeekLoad {
  weekStart: Date;
  key: string;
  score: number;
  count: number;
  level: LoadLevel;
}

/** Load per week for `count` weeks starting from the current week. */
export function weekLoads(assignments: Assignment[], now: Date, count: number, timezone: string): WeekLoad[] {
  const start = startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  const weeks: WeekLoad[] = Array.from({ length: count }, (_, i) => {
    const weekStart = addWeeks(start, i);
    return { weekStart, key: weekKey(weekStart), score: 0, count: 0, level: "none" };
  });
  const byKey = new Map(weeks.map((w) => [w.key, w]));
  for (const a of assignments) {
    if (!a.due_at || a.completed) continue;
    const w = byKey.get(weekKey(localDate(a.due_at, timezone)));
    if (!w) continue;
    w.score += loadScore(a);
    w.count += 1;
  }
  for (const w of weeks) w.level = levelFor(w.score);
  return weeks;
}
