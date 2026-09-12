import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { MobileNav, Sidebar } from "@/components/shell/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.onboarded) redirect("/onboarding");

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1">
      <Sidebar profile={profile} />
      <main className="min-w-0 flex-1 px-5 pb-28 pt-6 sm:px-8 md:pb-12 md:pt-10 lg:px-12">{children}</main>
      <MobileNav />
    </div>
  );
}
