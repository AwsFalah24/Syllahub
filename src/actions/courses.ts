"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getProfile } from "@/lib/supabase/server";
import { reviewDraftSchema, type ReviewDraft } from "@/lib/review";
import { toDueAt } from "@/lib/dates";
import { canAddCourse } from "@/lib/plans";
import { COURSE_COLOR_KEYS } from "@/lib/colors";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; code?: string };

const DEFAULT_HOURS: Record<string, number> = {
  exam: 8,
  project: 10,
  assignment: 3,
  quiz: 2,
  reading: 1.5,
  other: 2,
};

export async function createCourseFromReview(input: ReviewDraft): Promise<Result<{ courseId: string }>> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };

  const parsed = reviewDraftSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid data" };
  }
  const draft = parsed.data;
  const supabase = await createClient();

  // Free-tier gate (server-side, authoritative).
  const { count } = await supabase
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("archived", false);
  if (!canAddCourse(profile, count ?? 0)) {
    return { ok: false, error: "Upgrade to add more courses.", code: "course_limit" };
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .insert({
      user_id: profile.id,
      name: draft.course.name,
      code: draft.course.code || null,
      professor: draft.course.professor || null,
      term: draft.course.term || null,
      term_start: draft.course.term_start,
      term_end: draft.course.term_end,
      color: draft.course.color,
      target_grade: draft.course.target_grade,
    })
    .select("id")
    .single();
  if (courseError || !course) return { ok: false, error: courseError?.message ?? "Could not create course" };

  const courseId = course.id as string;

  // Grading components → ids (mapping client keys → db ids).
  const keyToComponentId = new Map<string, string>();
  if (draft.grading.length) {
    const { data: comps, error } = await supabase
      .from("grading_components")
      .insert(
        draft.grading.map((g, i) => ({
          course_id: courseId,
          user_id: profile.id,
          name: g.name,
          weight_percent: g.weight_percent,
          position: i,
        })),
      )
      .select("id");
    if (error || !comps) return { ok: false, error: error?.message ?? "Could not save grading breakdown" };
    comps.forEach((c, i) => keyToComponentId.set(draft.grading[i].key, c.id as string));
  }

  if (draft.assignments.length) {
    const { error } = await supabase.from("assignments").insert(
      draft.assignments.map((a) => ({
        course_id: courseId,
        user_id: profile.id,
        component_id: a.componentKey ? (keyToComponentId.get(a.componentKey) ?? null) : null,
        title: a.title,
        type: a.type,
        due_at: a.due_date ? toDueAt(a.due_date, a.due_time, profile.timezone) : null,
        all_day: !a.due_time,
        weight_percent: a.weight_percent,
        estimated_hours: DEFAULT_HOURS[a.type] ?? 2,
        notes: a.description || null,
      })),
    );
    if (error) return { ok: false, error: error.message };
  }

  if (draft.meetings.length) {
    const { error } = await supabase.from("course_meetings").insert(
      draft.meetings.map((m) => ({
        course_id: courseId,
        user_id: profile.id,
        day_of_week: m.day_of_week,
        start_time: m.start_time,
        end_time: m.end_time,
        location: m.location || null,
        kind: m.kind,
      })),
    );
    if (error) return { ok: false, error: error.message };
  }

  if (draft.notes.length) {
    const { error } = await supabase.from("course_notes").insert(
      draft.notes.map((n, i) => ({
        course_id: courseId,
        user_id: profile.id,
        type: n.type,
        content: n.content,
        position: i,
      })),
    );
    if (error) return { ok: false, error: error.message };
  }

  if (draft.uploadId) {
    await supabase
      .from("syllabus_uploads")
      .update({ status: "saved", course_id: courseId })
      .eq("id", draft.uploadId)
      .eq("user_id", profile.id);
  }

  revalidatePath("/dashboard");
  revalidatePath("/courses");
  revalidatePath("/calendar");
  revalidatePath("/plan");
  return { ok: true, data: { courseId } };
}

const courseUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  code: z.string().trim().max(40).nullable().optional(),
  professor: z.string().trim().max(120).nullable().optional(),
  term: z.string().trim().max(60).nullable().optional(),
  color: z.enum(COURSE_COLOR_KEYS as [string, ...string[]]).optional(),
  target_grade: z.number().min(0).max(100).optional(),
  term_start: z.string().nullable().optional(),
  term_end: z.string().nullable().optional(),
});

export async function updateCourse(courseId: string, input: z.input<typeof courseUpdateSchema>): Promise<Result> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const parsed = courseUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid data" };
  const supabase = await createClient();
  const { error } = await supabase.from("courses").update(parsed.data).eq("id", courseId).eq("user_id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  revalidatePath("/courses");
  return { ok: true, data: undefined };
}

export async function setCourseArchived(courseId: string, archived: boolean): Promise<Result> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();

  if (!archived) {
    const { count } = await supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("archived", false);
    if (!canAddCourse(profile, count ?? 0)) {
      return { ok: false, error: "Upgrade to have more active courses.", code: "course_limit" };
    }
  }

  const { error } = await supabase.from("courses").update({ archived }).eq("id", courseId).eq("user_id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/courses");
  revalidatePath("/dashboard");
  revalidatePath(`/courses/${courseId}`);
  return { ok: true, data: undefined };
}

export async function deleteCourse(courseId: string): Promise<Result> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase.from("courses").delete().eq("id", courseId).eq("user_id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/courses");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Notes & meetings (edited from the course page)
// ---------------------------------------------------------------------------

const noteSchema = z.object({
  type: z.enum(["late_policy", "attendance", "instruction", "office_hours", "contact", "other"]),
  content: z.string().trim().min(1).max(2000),
});

export async function addCourseNote(courseId: string, input: z.input<typeof noteSchema>): Promise<Result> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid note" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("course_notes")
    .insert({ course_id: courseId, user_id: profile.id, ...parsed.data, position: Date.now() % 100000 });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/courses/${courseId}`);
  return { ok: true, data: undefined };
}

export async function updateCourseNote(noteId: string, courseId: string, input: z.input<typeof noteSchema>): Promise<Result> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid note" };
  const supabase = await createClient();
  const { error } = await supabase.from("course_notes").update(parsed.data).eq("id", noteId).eq("user_id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/courses/${courseId}`);
  return { ok: true, data: undefined };
}

export async function deleteCourseNote(noteId: string, courseId: string): Promise<Result> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase.from("course_notes").delete().eq("id", noteId).eq("user_id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/courses/${courseId}`);
  return { ok: true, data: undefined };
}

const meetingSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  location: z.string().trim().max(120).nullable(),
  kind: z.enum(["lecture", "lab", "tutorial", "seminar", "other"]),
});

export async function addCourseMeeting(courseId: string, input: z.input<typeof meetingSchema>): Promise<Result> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const parsed = meetingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid meeting time" };
  const supabase = await createClient();
  const { error } = await supabase.from("course_meetings").insert({ course_id: courseId, user_id: profile.id, ...parsed.data });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/plan");
  return { ok: true, data: undefined };
}

export async function deleteCourseMeeting(meetingId: string, courseId: string): Promise<Result> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase.from("course_meetings").delete().eq("id", meetingId).eq("user_id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/plan");
  return { ok: true, data: undefined };
}
