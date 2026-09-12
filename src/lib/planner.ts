import { addDays, differenceInCalendarDays, format, isBefore, isSameDay, startOfDay } from "date-fns";
import type { Assignment, AssignmentType, Course, CourseMeeting } from "@/lib/types";

/**
 * Study planner.
 *
 * Builds a day-by-day schedule of class meetings + study blocks. Study blocks
 * are 1-hour slots inside the student's study window, never overlapping a
 * class, capped by their daily study budget. Work is scheduled
 * earliest-deadline-first, spread across the days leading up to each due date
 * so nothing gets crammed into the night before unless it has to.
 */

export interface PlanTask {
  id: string;
  title: string;
  type: AssignmentType;
  due: Date;
  hours: number;
  weight: number;
  course: Course;
  overdue: boolean;
}

export interface PlanMeeting {
  id: string;
  course: Course;
  kind: CourseMeeting["kind"];
  startMin: number;
  endMin: number;
  location: string | null;
}

export interface StudyBlock {
  task: PlanTask;
  startMin: number;
  endMin: number;
  /** Task is due on this day. */
  dueToday: boolean;
  /** Optional early start on something not yet urgent. */
  ahead?: boolean;
}

export interface PlanDay {
  date: Date;
  key: string;
  meetings: PlanMeeting[];
  blocks: StudyBlock[];
  due: PlanTask[];
  studyHours: number;
}

export interface Plan {
  days: PlanDay[];
  totalStudyHours: number;
  /** Hours that couldn't fit in the window before the deadline. */
  unscheduled: { task: PlanTask; hours: number }[];
  tasks: PlanTask[];
}

export interface PlannerPrefs {
  hoursPerDay: number;
  startHour: number;
  endHour: number;
}

const DEFAULT_HOURS: Record<AssignmentType, number> = {
  exam: 8,
  project: 10,
  assignment: 3,
  quiz: 2,
  reading: 1.5,
  other: 2,
};

const MAX_PER_DAY: Record<AssignmentType, number> = {
  exam: 3,
  project: 3,
  assignment: 2,
  quiz: 2,
  reading: 1,
  other: 2,
};

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function buildPlan({
  from,
  to,
  now,
  assignments,
  meetings,
  courses,
  prefs,
}: {
  from: Date;
  to: Date;
  now: Date;
  assignments: Assignment[];
  meetings: CourseMeeting[];
  courses: Course[];
  prefs: PlannerPrefs;
}): Plan {
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const today = startOfDay(now);
  const start = startOfDay(from);
  const end = startOfDay(to);

  // Tasks: incomplete, dated, due before (range end + lookahead) — big items
  // need to start early even if they're due after the visible range.
  const lookahead = addDays(end, 14);
  const tasks: PlanTask[] = assignments
    .filter((a) => !a.completed && a.score == null && a.due_at && courseById.has(a.course_id))
    .map((a) => {
      const due = new Date(a.due_at!);
      return {
        id: a.id,
        title: a.title,
        type: a.type,
        due,
        hours: a.estimated_hours ?? DEFAULT_HOURS[a.type],
        weight: a.weight_percent ?? 0,
        course: courseById.get(a.course_id)!,
        overdue: isBefore(due, today),
      };
    })
    .filter((t) => isBefore(t.due, lookahead))
    .sort((a, b) => a.due.getTime() - b.due.getTime() || b.weight - a.weight);

  const remaining = new Map(tasks.map((t) => [t.id, t.hours]));

  const days: PlanDay[] = [];
  const dayCount = differenceInCalendarDays(end, start) + 1;
  const budgetSlots = Math.max(0, Math.round(prefs.hoursPerDay));

  for (let i = 0; i < dayCount; i++) {
    const date = addDays(start, i);
    const dow = date.getDay();

    const dayMeetings: PlanMeeting[] = meetings
      .filter((m) => m.day_of_week === dow && courseById.has(m.course_id))
      .map((m) => ({
        id: m.id,
        course: courseById.get(m.course_id)!,
        kind: m.kind,
        startMin: toMin(m.start_time),
        endMin: toMin(m.end_time),
        location: m.location,
      }))
      .sort((a, b) => a.startMin - b.startMin);

    const due = tasks.filter((t) => isSameDay(t.due, date));
    const day: PlanDay = { date, key: format(date, "yyyy-MM-dd"), meetings: dayMeetings, blocks: [], due, studyHours: 0 };

    // Past days: show what happened, don't schedule.
    if (isBefore(date, today)) {
      days.push(day);
      continue;
    }

    // Free 1-hour slots inside the study window, avoiding classes and (today) past hours.
    const slots: number[] = [];
    for (let h = prefs.startHour; h < prefs.endHour; h++) {
      const s = h * 60;
      const e = s + 60;
      if (isSameDay(date, today) && e <= now.getHours() * 60 + now.getMinutes()) continue;
      if (dayMeetings.some((m) => s < m.endMin && e > m.startMin)) continue;
      slots.push(s);
    }

    const perTaskToday = new Map<string, number>();
    let used = 0;
    let slotIdx = 0;

    for (; slotIdx < slots.length; slotIdx++) {
      const s = slots[slotIdx];
      if (used >= budgetSlots) break;

      // Candidates: unfinished, not yet due (or overdue), and inside their lead window.
      const candidates = tasks.filter((t) => {
        const rem = remaining.get(t.id) ?? 0;
        if (rem <= 0) return false;
        if (!t.overdue && isBefore(t.due, date) && !isSameDay(t.due, date)) return false;
        const lead = Math.min(14, Math.max(3, Math.ceil(t.hours / 1.25)));
        const openFrom = addDays(startOfDay(t.due), -lead);
        return t.overdue || !isBefore(date, openFrom);
      });
      if (!candidates.length) break;

      const daysLeft = (t: PlanTask) => Math.max(0, differenceInCalendarDays(t.due, date));
      // Respect the per-day cap unless the task is urgent (due within a day) or overdue.
      let pick = candidates.find((t) => (perTaskToday.get(t.id) ?? 0) < MAX_PER_DAY[t.type] || daysLeft(t) <= 1 || t.overdue);
      // Prefer spreading: if the top pick already has hours today and another candidate has none, alternate.
      if (pick && (perTaskToday.get(pick.id) ?? 0) > 0) {
        const fresh = candidates.find((t) => (perTaskToday.get(t.id) ?? 0) === 0 && daysLeft(t) <= daysLeft(pick!) + 3);
        if (fresh) pick = fresh;
      }
      if (!pick) break;

      const last = day.blocks[day.blocks.length - 1];
      if (last && last.task.id === pick.id && last.endMin === s) {
        last.endMin = s + 60;
      } else {
        day.blocks.push({ task: pick, startMin: s, endMin: s + 60, dueToday: isSameDay(pick.due, date) });
      }
      remaining.set(pick.id, (remaining.get(pick.id) ?? 0) - 1);
      perTaskToday.set(pick.id, (perTaskToday.get(pick.id) ?? 0) + 1);
      used += 1;
    }

    // Spare budget and nothing urgent: bank one "get ahead" hour on the next
    // thing due (within two weeks). Keeps light weeks productive without
    // filling every free day.
    if (used < budgetSlots && slotIdx < slots.length) {
      const ahead = tasks.find(
        (t) =>
          (remaining.get(t.id) ?? 0) > 0 &&
          !perTaskToday.has(t.id) &&
          !isBefore(t.due, date) &&
          differenceInCalendarDays(t.due, date) <= 14,
      );
      if (ahead) {
        const s = slots[slotIdx];
        day.blocks.push({ task: ahead, startMin: s, endMin: s + 60, dueToday: false, ahead: true });
        remaining.set(ahead.id, (remaining.get(ahead.id) ?? 0) - 1);
        used += 1;
      }
    }

    day.studyHours = used;
    days.push(day);
  }

  const unscheduled = tasks
    .filter((t) => (remaining.get(t.id) ?? 0) > 0 && !isBefore(end, startOfDay(t.due)))
    .map((t) => ({ task: t, hours: remaining.get(t.id) ?? 0 }));

  return {
    days,
    totalStudyHours: days.reduce((s, d) => s + d.studyHours, 0),
    unscheduled,
    tasks,
  };
}

export function minToLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hh} ${suffix}` : `${hh}:${String(m).padStart(2, "0")} ${suffix}`;
}
