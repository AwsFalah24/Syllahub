import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { getCourseBundle } from "@/lib/data";
import { CourseWorkspace } from "@/components/course/course-workspace";

export async function generateMetadata({ params }: PageProps<"/courses/[id]">): Promise<Metadata> {
  const profile = await getProfile();
  if (!profile) return {};
  const { id } = await params;
  const bundle = await getCourseBundle(profile.id, id);
  return { title: bundle?.course.code ?? bundle?.course.name ?? "Course" };
}

export default async function CoursePage({ params }: PageProps<"/courses/[id]">) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const { id } = await params;
  const bundle = await getCourseBundle(profile.id, id);
  if (!bundle) notFound();

  return <CourseWorkspace bundle={bundle} timezone={profile.timezone} />;
}
