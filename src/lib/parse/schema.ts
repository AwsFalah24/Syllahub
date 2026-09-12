import { z } from "zod";

/**
 * The structured output we ask the LLM for. Strict JSON-schema mode requires
 * every field to be present, so optional data is expressed as `nullable()`.
 */
export const parsedCourseSchema = z.object({
  name: z.string().describe("Full course title, e.g. 'Introduction to Microeconomics'"),
  code: z.string().nullable().describe("Course code, e.g. 'ECON 101'"),
  professor: z.string().nullable().describe("Instructor's name"),
  term: z.string().nullable().describe("Term, e.g. 'Fall 2026'"),
  term_start: z.string().nullable().describe("First day of classes as YYYY-MM-DD if stated or inferable"),
  term_end: z.string().nullable().describe("Last day of classes / exam period end as YYYY-MM-DD if stated"),
});

export const parsedGradingSchema = z.object({
  name: z.string().describe("Component name, e.g. 'Midterm', 'Homework', 'Participation'"),
  weight_percent: z.number().describe("Weight as a percentage of the final grade, 0-100"),
  notes: z.string().nullable().describe("Any detail, e.g. 'lowest two dropped'"),
});

export const assignmentTypeEnum = z.enum(["assignment", "exam", "quiz", "reading", "project", "other"]);

export const parsedAssignmentSchema = z.object({
  title: z.string().describe("Short title, e.g. 'Problem Set 3' or 'Midterm Exam'"),
  type: assignmentTypeEnum,
  due_date: z.string().nullable().describe("Due/exam date as YYYY-MM-DD. Null if truly unknown."),
  due_time: z.string().nullable().describe("Time as HH:MM (24h) if stated, else null"),
  component: z
    .string()
    .nullable()
    .describe("Name of the grading component this belongs to (must match a grading component name exactly)"),
  weight_percent: z
    .number()
    .nullable()
    .describe("Weight of this specific item if stated individually (e.g. 'Midterm 25%'). Null otherwise."),
  description: z.string().nullable().describe("Brief extra context, e.g. chapters covered"),
});

export const parsedMeetingSchema = z.object({
  day_of_week: z.number().int().min(0).max(6).describe("0 = Sunday ... 6 = Saturday"),
  start_time: z.string().describe("HH:MM 24h"),
  end_time: z.string().describe("HH:MM 24h"),
  location: z.string().nullable(),
  kind: z.enum(["lecture", "lab", "tutorial", "seminar", "other"]),
});

export const noteTypeEnum = z.enum(["late_policy", "attendance", "instruction", "office_hours", "contact", "other"]);

export const parsedNoteSchema = z.object({
  type: noteTypeEnum,
  content: z.string().describe("One self-contained rule or piece of info, in the professor's words where possible"),
});

export const parsedSyllabusSchema = z.object({
  course: parsedCourseSchema,
  grading: z.array(parsedGradingSchema),
  assignments: z.array(parsedAssignmentSchema),
  meetings: z.array(parsedMeetingSchema),
  notes: z.array(parsedNoteSchema),
  confidence: z.enum(["high", "medium", "low"]).describe("How confident you are in the dates and weights"),
  warnings: z.array(z.string()).describe("Things the student should double-check, e.g. 'Year inferred as 2026'"),
});

export type ParsedSyllabus = z.infer<typeof parsedSyllabusSchema>;
export type ParsedAssignment = z.infer<typeof parsedAssignmentSchema>;
export type ParsedGrading = z.infer<typeof parsedGradingSchema>;
export type ParsedMeeting = z.infer<typeof parsedMeetingSchema>;
export type ParsedNote = z.infer<typeof parsedNoteSchema>;

export function emptyParsedSyllabus(): ParsedSyllabus {
  return {
    course: { name: "", code: null, professor: null, term: null, term_start: null, term_end: null },
    grading: [],
    assignments: [],
    meetings: [],
    notes: [],
    confidence: "high",
    warnings: [],
  };
}
