import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Assignment, AssignmentWithCourse, Course, CourseMeeting, CourseNote, GradingComponent } from "@/lib/types";

/** Active (non-archived) courses for the user. */
export const getActiveCourses = cache(async (userId: string): Promise<Course[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("*")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("created_at", { ascending: true });
  return (data as Course[]) ?? [];
});

export const getAllCourses = cache(async (userId: string): Promise<Course[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("*")
    .eq("user_id", userId)
    .order("archived", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as Course[]) ?? [];
});

/** Every assignment across active courses, joined with its course. */
export const getAssignmentsWithCourses = cache(async (userId: string): Promise<AssignmentWithCourse[]> => {
  const courses = await getActiveCourses(userId);
  if (!courses.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignments")
    .select("*")
    .eq("user_id", userId)
    .in(
      "course_id",
      courses.map((c) => c.id),
    )
    .order("due_at", { ascending: true, nullsFirst: false });
  const byId = new Map(courses.map((c) => [c.id, c]));
  return ((data as Assignment[]) ?? []).map((a) => ({ ...a, course: byId.get(a.course_id)! })).filter((a) => a.course);
});

export const getMeetingsForCourses = cache(async (userId: string, courseIds: string[]): Promise<CourseMeeting[]> => {
  if (!courseIds.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("course_meetings").select("*").eq("user_id", userId).in("course_id", courseIds);
  return (data as CourseMeeting[]) ?? [];
});

export interface CourseBundle {
  course: Course;
  components: GradingComponent[];
  assignments: Assignment[];
  notes: CourseNote[];
  meetings: CourseMeeting[];
}

export const getCourseBundle = cache(async (userId: string, courseId: string): Promise<CourseBundle | null> => {
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!course) return null;

  const [components, assignments, notes, meetings] = await Promise.all([
    supabase.from("grading_components").select("*").eq("course_id", courseId).order("position"),
    supabase.from("assignments").select("*").eq("course_id", courseId).order("due_at", { ascending: true, nullsFirst: false }),
    supabase.from("course_notes").select("*").eq("course_id", courseId).order("position"),
    supabase.from("course_meetings").select("*").eq("course_id", courseId).order("day_of_week").order("start_time"),
  ]);

  return {
    course: course as Course,
    components: (components.data as GradingComponent[]) ?? [],
    assignments: (assignments.data as Assignment[]) ?? [],
    notes: (notes.data as CourseNote[]) ?? [],
    meetings: (meetings.data as CourseMeeting[]) ?? [],
  };
});

/** Grading components for many courses at once (dashboard grade snapshot). */
export const getComponentsForCourses = cache(async (userId: string, courseIds: string[]): Promise<GradingComponent[]> => {
  if (!courseIds.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("grading_components")
    .select("*")
    .eq("user_id", userId)
    .in("course_id", courseIds)
    .order("position");
  return (data as GradingComponent[]) ?? [];
});
