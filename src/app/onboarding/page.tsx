import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/logo";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.onboarded) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col px-6 py-8">
      <Logo />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <div className="animate-fade-up">
          <div className="eyebrow mb-3">Step 1 of 2</div>
          <h1 className="text-h1 font-semibold">Let&apos;s set you up</h1>
          <p className="mt-2 text-ink-muted">Two quick details, then you&apos;ll upload your first syllabus.</p>
          <OnboardingForm defaultName={profile.full_name ?? ""} />
        </div>
      </div>
    </div>
  );
}
