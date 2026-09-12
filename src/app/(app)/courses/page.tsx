import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, Plus } from "lucide-react";
import { getProfile } from "@/lib/supabase/server";
import { getAllCourses, getComponentsForCourses } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { computeStanding, letterFor } from "@/lib/grades";
import { courseColor } from "@/lib/colors";
import { canAddCourse, FREE_COURSE_LIMIT, isPaid } from "@/lib/plans";
import type { Assignment } from "@/lib/types";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { GradeRing } from "@/components/grades/grade-ring";

export const metadata: Metadata = { title: "Courses" };

export default async function CoursesPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const courses = await getAllCourses(profile.id);
  const active = courses.filter((c) => !c.archived);
  const archived = courses.filter((c) => c.archived);

  const supabase = await createClient();
  const [components, { data: assignmentsData }] = await Promise.all([
    getComponentsForCourses(
      profile.id,
      courses.map((c) => c.id),
    ),
    supabase.from("assignments").select("*").eq("user_id", profile.id),
  ]);
  const assignments = (assignmentsData as Assignment[]) ?? [];

  const canAdd = canAddCourse(profile, active.length);

  return (
    <div>
      <PageHeader
        title="Courses"
        description={
          isPaid(profile)
            ? `${active.length} active ${active.length === 1 ? "course" : "courses"}`
            : `${active.length} of ${FREE_COURSE_LIMIT} free ${FREE_COURSE_LIMIT === 1 ? "course" : "courses"} used`
        }
        actions={
          <Link href={canAdd ? "/courses/new" : "/upgrade?reason=course_limit"}>
            <Button size="sm">
              <Plus className="h-4 w-4" /> Add syllabus
            </Button>
          </Link>
        }
      />

      {active.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-6 w-6" />}
          title="No courses yet"
          description="Upload a syllabus and we'll set the course up for you."
          action={
            <Link href="/courses/new">
              <Button>Upload a syllabus</Button>
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              assignments={assignments.filter((a) => a.course_id === course.id)}
              components={components.filter((c) => c.course_id === course.id)}
            />
          ))}
        </ul>
      )}

      {archived.length ? (
        <div className="mt-14">
          <SectionTitle>Archived</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                assignments={assignments.filter((a) => a.course_id === course.id)}
                components={components.filter((c) => c.course_id === course.id)}
                muted
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CourseCard({
  course,
  assignments,
  components,
  muted,
}: {
  course: Awaited<ReturnType<typeof getAllCourses>>[number];
  assignments: Assignment[];
  components: Awaited<ReturnType<typeof getComponentsForCourses>>;
  muted?: boolean;
}) {
  const color = courseColor(course.color);
  const standing = computeStanding(components, assignments);
  const remaining = assignments.filter((a) => !a.completed && a.due_at && new Date(a.due_at) > new Date()).length;

  return (
    <li>
      <Link
        href={`/courses/${course.id}`}
        className={`card-raised group flex h-full flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift ${muted ? "opacity-60 hover:opacity-100" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-caption font-semibold" style={{ color: color.text }}>
              {course.code ?? "Course"}
            </div>
            <h3 className="mt-0.5 truncate text-h3 font-semibold text-ink">{course.name}</h3>
            <p className="mt-0.5 truncate text-caption text-ink-muted">
              {[course.professor, course.term].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <GradeRing value={standing.current} size={52} stroke={6} color={color.hex} marker={course.target_grade}>
            <span className="text-caption font-semibold tabular text-ink">{letterFor(standing.current)}</span>
          </GradeRing>
        </div>
        <div className="mt-5 flex items-center justify-between text-caption text-ink-muted">
          <span>
            {standing.current == null ? "No grades yet" : `${standing.current.toFixed(1)}% current`}
          </span>
          <span className="tabular">{remaining} upcoming</span>
        </div>
      </Link>
    </li>
  );
}
