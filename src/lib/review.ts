import { z } from "zod";
import type { ParsedSyllabus } from "@/lib/parse/schema";
import { COURSE_COLOR_KEYS } from "@/lib/colors";

/**
 * The editable draft shown on the review screen and submitted to the server.
 * Every row carries a client-side `key` so React can track edits/deletes.
 */

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const timeStr = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();

export const draftCourseSchema = z.object({
  name: z.string().trim().min(1, "Give the course a name").max(200),
  code: z.string().trim().max(40).nullable(),
  professor: z.string().trim().max(120).nullable(),
  term: z.string().trim().max(60).nullable(),
  term_start: dateStr,
  term_end: dateStr,
  color: z.enum(COURSE_COLOR_KEYS as [string, ...string[]]),
  target_grade: z.number().min(0).max(100),
});

export const draftGradingSchema = z.object({
  key: z.string(),
  name: z.string().trim().min(1).max(120),
  weight_percent: z.number().min(0).max(100),
});

export const draftAssignmentSchema = z.object({
  key: z.string(),
  title: z.string().trim().min(1).max(200),
  type: z.enum(["assignment", "exam", "quiz", "reading", "project", "other"]),
  due_date: dateStr,
  due_time: timeStr,
  componentKey: z.string().nullable(),
  weight_percent: z.number().min(0).max(100).nullable(),
  description: z.string().trim().max(1000).nullable(),
});

export const draftMeetingSchema = z.object({
  key: z.string(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  location: z.string().trim().max(120).nullable(),
  kind: z.enum(["lecture", "lab", "tutorial", "seminar", "other"]),
});

export const draftNoteSchema = z.object({
  key: z.string(),
  type: z.enum(["late_policy", "attendance", "instruction", "office_hours", "contact", "other"]),
  content: z.string().trim().min(1).max(2000),
});

export const reviewDraftSchema = z.object({
  uploadId: z.string().uuid().nullable(),
  course: draftCourseSchema,
  grading: z.array(draftGradingSchema).max(50),
  assignments: z.array(draftAssignmentSchema).max(400),
  meetings: z.array(draftMeetingSchema).max(30),
  notes: z.array(draftNoteSchema).max(100),
});

export type ReviewDraft = z.infer<typeof reviewDraftSchema>;
export type DraftGrading = z.infer<typeof draftGradingSchema>;
export type DraftAssignment = z.infer<typeof draftAssignmentSchema>;
export type DraftMeeting = z.infer<typeof draftMeetingSchema>;
export type DraftNote = z.infer<typeof draftNoteSchema>;

export function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/** Convert LLM output into an editable draft, linking assignments to components by name. */
export function draftFromParsed(parsed: ParsedSyllabus, uploadId: string | null, color: string): ReviewDraft {
  const grading = parsed.grading.map((g) => ({ key: newKey(), name: g.name, weight_percent: g.weight_percent }));
  const byName = new Map(grading.map((g) => [g.name.toLowerCase(), g.key]));

  const assignments = parsed.assignments
    .map((a) => ({
      key: newKey(),
      title: a.title,
      type: a.type,
      due_date: a.due_date,
      due_time: a.due_time,
      componentKey: a.component ? (byName.get(a.component.toLowerCase()) ?? null) : null,
      weight_percent: a.weight_percent,
      description: a.description,
    }))
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

  return {
    uploadId,
    course: {
      name: parsed.course.name,
      code: parsed.course.code,
      professor: parsed.course.professor,
      term: parsed.course.term,
      term_start: parsed.course.term_start,
      term_end: parsed.course.term_end,
      color,
      target_grade: 85,
    },
    grading,
    assignments,
    meetings: parsed.meetings.map((m) => ({ key: newKey(), ...m })),
    notes: parsed.notes.map((n) => ({ key: newKey(), ...n })),
  };
}
