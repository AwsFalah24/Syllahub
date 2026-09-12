import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { emptyParsedSyllabus, parsedSyllabusSchema, type ParsedSyllabus } from "@/lib/parse/schema";
import { draftFromParsed } from "@/lib/review";
import { pickNextColor } from "@/lib/colors";
import { PageHeader } from "@/components/shell/page-header";
import { ReviewEditor } from "@/components/review/review-editor";

export const metadata: Metadata = { title: "Review syllabus" };

export default async function ReviewPage({ searchParams }: PageProps<"/courses/review">) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const { upload } = await searchParams;
  const uploadId = typeof upload === "string" ? upload : null;

  const supabase = await createClient();
  const { data: courses } = await supabase.from("courses").select("color").eq("user_id", profile.id).eq("archived", false);
  const color = pickNextColor((courses ?? []).map((c) => c.color as string));

  let parsed: ParsedSyllabus = emptyParsedSyllabus();
  let fileName: string | null = null;
  let cached = false;

  if (uploadId) {
    const { data: row } = await supabase
      .from("syllabus_uploads")
      .select("id, file_name, status, parsed, course_id")
      .eq("id", uploadId)
      .eq("user_id", profile.id)
      .maybeSingle();
    if (!row) notFound();
    if (row.status === "saved" && row.course_id) redirect(`/courses/${row.course_id}`);
    const check = parsedSyllabusSchema.safeParse(row.parsed);
    if (!check.success) redirect("/courses/new");
    parsed = check.data;
    fileName = row.file_name;
    cached = true;
  }

  const draft = draftFromParsed(parsed, uploadId, color);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={fileName ? `From ${fileName}` : "Manual entry"}
        title={uploadId ? "Check what we found" : "Add course details"}
        description={
          uploadId
            ? "AI parsing isn't perfect. Click anything to fix it, remove what doesn't belong, and add what's missing. Nothing is saved until you confirm."
            : "Fill in what you know — you can always add more from the course page later."
        }
      />
      <ReviewEditor initial={draft} warnings={cached ? parsed.warnings : []} />
    </div>
  );
}
