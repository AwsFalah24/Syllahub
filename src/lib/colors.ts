/**
 * Course color palette. Each course gets one; stored as the key in the DB so
 * we can evolve the actual hex values without a migration.
 */
export const COURSE_COLORS = {
  violet: { name: "Violet", hex: "#7a4dff", soft: "#efe9ff", text: "#4a26a8" },
  blue: { name: "Blue", hex: "#3b82f6", soft: "#e6efff", text: "#1e4fb8" },
  teal: { name: "Teal", hex: "#14b8a6", soft: "#e0f7f4", text: "#0f766e" },
  green: { name: "Green", hex: "#22c55e", soft: "#e5f8ec", text: "#15803d" },
  amber: { name: "Amber", hex: "#f59e0b", soft: "#fdf2dc", text: "#b45309" },
  orange: { name: "Orange", hex: "#f97316", soft: "#ffeadb", text: "#c2410c" },
  rose: { name: "Rose", hex: "#f43f5e", soft: "#ffe4e9", text: "#be123c" },
  pink: { name: "Pink", hex: "#ec4899", soft: "#fde4f1", text: "#be185d" },
  sky: { name: "Sky", hex: "#0ea5e9", soft: "#e0f3fd", text: "#0369a1" },
  slate: { name: "Slate", hex: "#64748b", soft: "#eaeef3", text: "#334155" },
} as const;

export type CourseColorKey = keyof typeof COURSE_COLORS;

export const COURSE_COLOR_KEYS = Object.keys(COURSE_COLORS) as CourseColorKey[];

export function courseColor(key: string | null | undefined) {
  return COURSE_COLORS[(key as CourseColorKey) ?? "violet"] ?? COURSE_COLORS.violet;
}

/** Pick the least-used color for a new course. */
export function pickNextColor(used: string[]): CourseColorKey {
  const counts = new Map<CourseColorKey, number>();
  for (const k of COURSE_COLOR_KEYS) counts.set(k, 0);
  for (const u of used) {
    if (counts.has(u as CourseColorKey)) counts.set(u as CourseColorKey, (counts.get(u as CourseColorKey) ?? 0) + 1);
  }
  let best: CourseColorKey = "violet";
  let bestCount = Infinity;
  for (const k of COURSE_COLOR_KEYS) {
    const c = counts.get(k) ?? 0;
    if (c < bestCount) {
      best = k;
      bestCount = c;
    }
  }
  return best;
}
