import type { Assignment, GradingComponent } from "@/lib/types";

/**
 * Grade math.
 *
 * A course is a set of weighted components (Midterm 25%, Homework 20%, ...).
 * Each component either
 *   - has a direct grade override (e.g. Participation: 95%),
 *   - or contains assignments, some of which are graded.
 *
 * Within a component, graded items are averaged (equal weighting). The share
 * of the component's weight that is "locked in" is proportional to how many
 * of its items are graded, so 3 of 8 homeworks graded locks in 3/8 of the
 * Homework weight. That keeps "what do I need" honest mid-semester.
 *
 * Assignments with an explicit weight_percent and no component act as their
 * own component.
 */

export interface ComponentStanding {
  id: string;
  name: string;
  weight: number;
  items: Assignment[];
  gradedCount: number;
  totalCount: number;
  /** Average % across graded items (or the override). Null when nothing graded. */
  average: number | null;
  /** Portion of `weight` that is locked in by grades so far. */
  lockedWeight: number;
  remainingWeight: number;
  /** Points contributed toward the final grade (out of `weight`). */
  contribution: number;
  isOverride: boolean;
}

export interface CourseStanding {
  components: ComponentStanding[];
  totalWeight: number;
  lockedWeight: number;
  remainingWeight: number;
  /** Weighted average of graded work so far, 0-100. Null before any grade. */
  current: number | null;
  /** Points banked out of totalWeight. */
  pointsSoFar: number;
  /** Final grade if every remaining item scored 100 / 0. */
  maxPossible: number;
  minPossible: number;
  /** Items that don't count toward the grade (no component, no weight). */
  unweighted: Assignment[];
}

export function percentOf(a: Pick<Assignment, "score" | "max_score">) {
  if (a.score == null) return null;
  const max = a.max_score > 0 ? a.max_score : 100;
  return (a.score / max) * 100;
}

export function computeStanding(components: GradingComponent[], assignments: Assignment[]): CourseStanding {
  const byComponent = new Map<string, Assignment[]>();
  const unweighted: Assignment[] = [];
  const standalone: Assignment[] = [];

  for (const a of assignments) {
    if (a.component_id && components.some((c) => c.id === a.component_id)) {
      const list = byComponent.get(a.component_id) ?? [];
      list.push(a);
      byComponent.set(a.component_id, list);
    } else if (a.weight_percent != null && a.weight_percent > 0) {
      standalone.push(a);
    } else {
      unweighted.push(a);
    }
  }

  const standings: ComponentStanding[] = [];

  for (const c of [...components].sort((x, y) => x.position - y.position)) {
    const items = (byComponent.get(c.id) ?? []).sort(sortByDue);
    const weight = Number(c.weight_percent) || 0;

    if (c.grade_override != null) {
      standings.push({
        id: c.id,
        name: c.name,
        weight,
        items,
        gradedCount: items.length,
        totalCount: items.length,
        average: Number(c.grade_override),
        lockedWeight: weight,
        remainingWeight: 0,
        contribution: (Number(c.grade_override) / 100) * weight,
        isOverride: true,
      });
      continue;
    }

    const graded = items.map(percentOf).filter((p): p is number => p != null);
    const average = graded.length ? graded.reduce((s, p) => s + p, 0) / graded.length : null;
    const fraction = items.length ? graded.length / items.length : 0;
    const lockedWeight = weight * fraction;

    standings.push({
      id: c.id,
      name: c.name,
      weight,
      items,
      gradedCount: graded.length,
      totalCount: items.length,
      average,
      lockedWeight,
      remainingWeight: weight - lockedWeight,
      contribution: average != null ? (average / 100) * lockedWeight : 0,
      isOverride: false,
    });
  }

  for (const a of standalone.sort(sortByDue)) {
    const weight = Number(a.weight_percent) || 0;
    const p = percentOf(a);
    standings.push({
      id: `a:${a.id}`,
      name: a.title,
      weight,
      items: [a],
      gradedCount: p != null ? 1 : 0,
      totalCount: 1,
      average: p,
      lockedWeight: p != null ? weight : 0,
      remainingWeight: p != null ? 0 : weight,
      contribution: p != null ? (p / 100) * weight : 0,
      isOverride: false,
    });
  }

  const totalWeight = standings.reduce((s, c) => s + c.weight, 0);
  const lockedWeight = standings.reduce((s, c) => s + c.lockedWeight, 0);
  const pointsSoFar = standings.reduce((s, c) => s + c.contribution, 0);
  const remainingWeight = Math.max(0, totalWeight - lockedWeight);

  return {
    components: standings,
    totalWeight,
    lockedWeight,
    remainingWeight,
    current: lockedWeight > 0 ? (pointsSoFar / lockedWeight) * 100 : null,
    pointsSoFar,
    maxPossible: totalWeight > 0 ? ((pointsSoFar + remainingWeight) / totalWeight) * 100 : 0,
    minPossible: totalWeight > 0 ? (pointsSoFar / totalWeight) * 100 : 0,
    unweighted: unweighted.sort(sortByDue),
  };
}

export type NeedStatus = "locked" | "secured" | "reachable" | "unreachable" | "no-data";

export interface NeedResult {
  status: NeedStatus;
  /** Raw % needed on the remaining work (may be <0 or >100). */
  needed: number | null;
  /** Clamped 0–100 for display. */
  neededDisplay: number | null;
  target: number;
  finalIfLocked: number | null;
}

/** What average % is needed on remaining work to finish at `target`? */
export function whatDoINeed(standing: CourseStanding, target: number): NeedResult {
  const { totalWeight, remainingWeight, pointsSoFar, lockedWeight } = standing;
  if (totalWeight <= 0) return { status: "no-data", needed: null, neededDisplay: null, target, finalIfLocked: null };

  if (remainingWeight <= 0.0001) {
    const final = (pointsSoFar / totalWeight) * 100;
    return { status: "locked", needed: null, neededDisplay: null, target, finalIfLocked: final };
  }

  const needed = (((target / 100) * totalWeight - pointsSoFar) / remainingWeight) * 100;
  let status: NeedStatus = "reachable";
  if (needed <= 0) status = "secured";
  else if (needed > 100) status = "unreachable";
  if (lockedWeight === 0) status = needed > 100 ? "unreachable" : "reachable";

  return {
    status,
    needed,
    neededDisplay: Math.min(100, Math.max(0, needed)),
    target,
    finalIfLocked: null,
  };
}

export const LETTER_SCALE: { min: number; letter: string }[] = [
  { min: 90, letter: "A" },
  { min: 85, letter: "A-" },
  { min: 80, letter: "B+" },
  { min: 75, letter: "B" },
  { min: 70, letter: "B-" },
  { min: 65, letter: "C+" },
  { min: 60, letter: "C" },
  { min: 55, letter: "C-" },
  { min: 50, letter: "D" },
  { min: 0, letter: "F" },
];

export function letterFor(pct: number | null | undefined) {
  if (pct == null || Number.isNaN(pct)) return "—";
  return LETTER_SCALE.find((s) => pct >= s.min)?.letter ?? "F";
}

export const TARGET_PRESETS = [
  { label: "A", value: 90 },
  { label: "A-", value: 85 },
  { label: "B+", value: 80 },
  { label: "B", value: 75 },
  { label: "B-", value: 70 },
  { label: "C+", value: 65 },
  { label: "Pass", value: 50 },
];

function sortByDue(a: Assignment, b: Assignment) {
  return (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999");
}

/** Names of components that still have ungraded work — used for the copy "…on the Final". */
export function remainingNames(standing: CourseStanding) {
  return standing.components.filter((c) => c.remainingWeight > 0.0001).map((c) => c.name);
}
