import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, PenLine } from "lucide-react";
import { createClient, getProfile } from "@/lib/supabase/server";
import { canAddCourse, FREE_COURSE_LIMIT } from "@/lib/plans";
import { PageHeader } from "@/components/shell/page-header";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Add a syllabus" };

export default async function NewCoursePage({ searchParams }: PageProps<"/courses/new">) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const { first } = await searchParams;

  const supabase = await createClient();
  const { count } = await supabase
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("archived", false);
  const activeCount = count ?? 0;
  const allowed = canAddCourse(profile, activeCount);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow={first ? "Step 2 of 2" : "New course"}
        title={first ? "Upload your first syllabus" : "Add a syllabus"}
        description="We'll pull out every deadline, exam, grading weight and professor rule. You get to check it all before anything is saved."
      />

      {allowed ? (
        <>
          <UploadDropzone />
          <div className="mt-10 flex items-center gap-3 text-micro uppercase tracking-wider text-ink-subtle">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <p className="text-caption text-ink-muted">Don&apos;t have the file handy?</p>
            <Link href="/courses/review">
              <Button variant="secondary" size="sm">
                <PenLine className="h-4 w-4" /> Enter course details manually
              </Button>
            </Link>
            {first ? (
              <Link href="/dashboard" className="mt-2 text-caption text-ink-subtle hover:text-ink-muted">
                Skip for now
              </Link>
            ) : null}
          </div>
        </>
      ) : (
        <UpgradePrompt activeCount={activeCount} />
      )}
    </div>
  );
}

function UpgradePrompt({ activeCount }: { activeCount: number }) {
  return (
    <div className="card-soft relative overflow-hidden p-8 text-center sm:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-100/70 blur-3xl"
      />
      <div className="relative">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-bg text-brand-600 shadow-soft">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-h2 font-semibold text-ink">You&apos;ve used your free course</h2>
        <p className="mx-auto mt-2 max-w-md text-body text-ink-muted">
          The free plan includes {FREE_COURSE_LIMIT} active course — you have {activeCount}. Upgrade to add every course
          you&apos;re taking this term and see your whole semester in one place.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/upgrade?reason=course_limit">
            <Button size="lg">See plans</Button>
          </Link>
          <Link href="/courses">
            <Button size="lg" variant="ghost">
              Archive a course instead
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
