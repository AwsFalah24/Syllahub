/**
 * Hand-maintained database types mirroring supabase/migrations.
 * Keep in sync when the schema changes.
 */

export type PlanTier = "free" | "paid";
export type AssignmentType = "assignment" | "exam" | "quiz" | "reading" | "project" | "other";
export type NoteType = "late_policy" | "attendance" | "instruction" | "office_hours" | "contact" | "other";
export type MeetingKind = "lecture" | "lab" | "tutorial" | "seminar" | "other";
export type DigestFrequency = "none" | "daily" | "weekly";
export type UploadStatus = "pending" | "parsed" | "saved" | "failed";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  school: string | null;
  onboarded: boolean;
  timezone: string;
  plan: PlanTier;
  plan_expires_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  reminder_days: number[];
  email_reminders: boolean;
  push_reminders: boolean;
  digest: DigestFrequency;
  last_digest_at: string | null;
  study_hours_per_day: number;
  study_start_hour: number;
  study_end_hour: number;
  ics_token: string;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  user_id: string;
  name: string;
  code: string | null;
  professor: string | null;
  term: string | null;
  color: string;
  target_grade: number;
  term_start: string | null;
  term_end: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface GradingComponent {
  id: string;
  course_id: string;
  user_id: string;
  name: string;
  weight_percent: number;
  grade_override: number | null;
  position: number;
  created_at: string;
}

export interface Assignment {
  id: string;
  course_id: string;
  user_id: string;
  component_id: string | null;
  title: string;
  type: AssignmentType;
  due_at: string | null;
  all_day: boolean;
  weight_percent: number | null;
  score: number | null;
  max_score: number;
  completed: boolean;
  estimated_hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseNote {
  id: string;
  course_id: string;
  user_id: string;
  type: NoteType;
  content: string;
  position: number;
  created_at: string;
}

export interface CourseMeeting {
  id: string;
  course_id: string;
  user_id: string;
  day_of_week: number;
  start_time: string; // "HH:MM:SS"
  end_time: string;
  location: string | null;
  kind: MeetingKind;
  created_at: string;
}

export interface Reminder {
  id: string;
  assignment_id: string;
  user_id: string;
  days_before: number;
  channel: "push" | "email";
  remind_at: string;
  sent: boolean;
  sent_at: string | null;
  created_at: string;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

export interface SyllabusUpload {
  id: string;
  user_id: string;
  course_id: string | null;
  file_name: string;
  storage_path: string | null;
  mime_type: string | null;
  content_hash: string | null;
  status: UploadStatus;
  parsed: unknown | null;
  error: string | null;
  created_at: string;
}

export interface ParseCacheRow {
  content_hash: string;
  parsed: unknown;
  model: string | null;
  created_at: string;
}

/** Convenience: an assignment joined with its course. */
export type AssignmentWithCourse = Assignment & { course: Course };

export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  assignment: "Assignment",
  exam: "Exam",
  quiz: "Quiz",
  reading: "Reading",
  project: "Project",
  other: "Other",
};

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  late_policy: "Late policy",
  attendance: "Attendance",
  instruction: "Instruction",
  office_hours: "Office hours",
  contact: "Contact",
  other: "Note",
};

export const MEETING_KIND_LABELS: Record<MeetingKind, string> = {
  lecture: "Lecture",
  lab: "Lab",
  tutorial: "Tutorial",
  seminar: "Seminar",
  other: "Class",
};
