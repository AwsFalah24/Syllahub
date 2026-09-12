"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getProfile } from "@/lib/supabase/server";
import { toDueAt } from "@/lib/dates";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function revalidateAll(courseId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/plan");
  revalidatePath("/courses");
  if (courseId) revalidatePath(`/courses/${courseId}`);
}

export async function toggleAssignmentComplete(id: string, completed: boolean): Promise<Result> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .update({ completed })
    .eq("id", id)
    .eq("user_id", profile.id)
    .select("course_id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateAll(data?.course_id as string | undefined);
  return { ok: true, data: undefined };
}

const gradeSchema = z.object({
  score: z.number().min(0).nullable(),
  max_score: z.number().positive().default(100),
});

export async function setAssignmentGrade(id: string, input: z.input<typeof gradeSchema>): Promise<Result> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const parsed = gradeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid grade" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .update({
      score: parsed.data.score,
      max_score: parsed.data.max_score,
      // Logging a grade implies the work is done.
      ...(parsed.data.score != null ? { completed: true } : {}),
    })
    .eq("id", id)
    .eq("user_id", profile.id)
    .select("course_id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateAll(data?.course_id as string | undefined);
  return { ok: true, data: undefined };
}

const assignmentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: z.enum(["assignment", "exam", "quiz", "reading", "project", "other"]),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  due_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  component_id: z.string().uuid().nullable(),
  weight_percent: z.number().min(0).max(100).nullable(),
  estimated_hours: z.number().min(0).max(200).nullable(),
  notes: z.string().trim().max(2000).nullable(),
});

export type AssignmentInput = z.input<typeof assignmentSchema>;

export async function createAssignment(courseId: string, input: AssignmentInput): Promise<Result<{ id: string }>> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      course_id: courseId,
      user_id: profile.id,
      title: d.title,
      type: d.type,
      due_at: d.due_date ? toDueAt(d.due_date, d.due_time, profile.timezone) : null,
      all_day: !d.due_time,
      component_id: d.component_id,
      weight_percent: d.weight_percent,
      estimated_hours: d.estimated_hours,
      notes: d.notes,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not add" };
  revalidateAll(courseId);
  return { ok: true, data: { id: data.id as string } };
}

export async function updateAssignment(id: string, input: AssignmentInput): Promise<Result> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .update({
      title: d.title,
      type: d.type,
      due_at: d.due_date ? toDueAt(d.due_date, d.due_time, profile.timezone) : null,
      all_day: !d.due_time,
      component_id: d.component_id,
      weight_percent: d.weight_percent,
      estimated_hours: d.estimated_hours,
      notes: d.notes,
    })
    .eq("id", id)
    .eq("user_id", profile.id)
    .select("course_id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateAll(data?.course_id as string | undefined);
  return { ok: true, data: undefined };
}

export async function deleteAssignment(id: string): Promise<Result> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", id)
    .eq("user_id", profile.id)
    .select("course_id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateAll(data?.course_id as string | undefined);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Grading components
// ---------------------------------------------------------------------------

const componentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  weight_percent: z.number().min(0).max(100),
  grade_override: z.number().min(0).max(100).nullable().optional(),
});

export async function createComponent(courseId: string, input: z.input<typeof componentSchema>): Promise<Result<{ id: string }>> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const parsed = componentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid component" };
  const supabase = await createClient();
  const { count } = await supabase
    .from("grading_components")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  const { data, error } = await supabase
    .from("grading_components")
    .insert({ course_id: courseId, user_id: profile.id, ...parsed.data, position: count ?? 0 })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not add" };
  revalidateAll(courseId);
  return { ok: true, data: { id: data.id as string } };
}

export async function updateComponent(id: string, courseId: string, input: Partial<z.input<typeof componentSchema>>): Promise<Result> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const parsed = componentSchema.partial().safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid component" };
  const supabase = await createClient();
  const { error } = await supabase.from("grading_components").update(parsed.data).eq("id", id).eq("user_id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidateAll(courseId);
  return { ok: true, data: undefined };
}

export async function deleteComponent(id: string, courseId: string): Promise<Result> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase.from("grading_components").delete().eq("id", id).eq("user_id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidateAll(courseId);
  return { ok: true, data: undefined };
}
