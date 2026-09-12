import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { getProfile } from "@/lib/supabase/server";
import { isPaid, FREE_COURSE_LIMIT } from "@/lib/plans";
import { getSiteUrl } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { BillingPortalButton, CalendarFeed, ProfileSettings } from "@/components/settings/profile-settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const paid = isPaid(profile);
  const icsUrl = `${getSiteUrl()}/api/ics/${profile.ics_token}`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Profile, reminders, planner and billing." />

      <div className="space-y-14">
        <Section title="Profile & planner">
          <ProfileSettings profile={profile} />
        </Section>

        <Section id="notifications" title="Reminders">
          <NotificationSettings profile={profile} />
        </Section>

        <Section id="calendar" title="Calendar subscription" description="Subscribe once and every deadline and class shows up in Google or Apple Calendar automatically.">
          <CalendarFeed url={icsUrl} />
        </Section>

        <Section id="billing" title="Plan & billing">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-body font-semibold text-ink">{paid ? "Paid plan" : "Free plan"}</div>
              <p className="mt-0.5 text-caption text-ink-muted">
                {paid
                  ? profile.plan_expires_at
                    ? `Renews or ends ${format(new Date(profile.plan_expires_at), "MMMM d, yyyy")}.`
                    : "Unlimited courses."
                  : `${FREE_COURSE_LIMIT} active course included. Upgrade for unlimited.`}
              </p>
            </div>
            {paid && profile.stripe_customer_id ? (
              <BillingPortalButton />
            ) : (
              <Link href="/upgrade">
                <Button size="sm">See plans</Button>
              </Link>
            )}
          </div>
        </Section>

        <Section title="Account">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-caption text-ink-muted">Signed in as {profile.email}</p>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-h3 font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1 text-caption text-ink-muted">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
