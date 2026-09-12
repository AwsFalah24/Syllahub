import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BellRing, CalendarDays, Sparkles, Target } from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  const user = await getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Get started</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 pb-20 pt-12 text-center sm:pt-24">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-caption font-semibold text-brand-700">
            <Sparkles className="h-3.5 w-3.5" /> Upload a syllabus. That&apos;s the whole setup.
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-[40px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[60px]">
            Your semester, <span className="text-brand-600">organized</span> before the first lecture ends.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
            SyllaHub reads your syllabus and turns it into a live timeline of deadlines, a grade tracker that tells you
            exactly what you need on the final, and reminders so nothing slips.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup">
              <Button size="lg" className="px-7">
                Start free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <span className="text-caption text-ink-subtle">Free for one course · no card needed</span>
          </div>

          {/* Product glimpse */}
          <div className="relative mx-auto mt-16 max-w-3xl">
            <div className="card-raised grid gap-6 p-6 text-left sm:grid-cols-[200px_1fr] sm:p-8">
              <div className="flex flex-col items-center justify-center">
                <div className="relative flex h-40 w-40 items-center justify-center">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-surface-2)" strokeWidth="9" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="var(--color-brand-500)"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 42}
                      strokeDashoffset={2 * Math.PI * 42 * (1 - 0.824)}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="eyebrow">Current</span>
                    <span className="text-[34px] font-semibold leading-none tracking-tight tabular">82.4</span>
                    <span className="text-caption text-ink-muted">B+</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="eyebrow">ECON 101 · Target A-</div>
                <p className="mt-2 text-caption text-ink-muted">To finish with A- (85%), you need at least</p>
                <p className="mt-1 text-[34px] font-semibold leading-none tracking-tight text-ink tabular">
                  78% <span className="text-h3 font-medium text-ink-muted">on the Final</span>
                </p>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full w-[78%] rounded-full bg-brand-500" />
                </div>
                <ul className="mt-6 space-y-2">
                  {[
                    ["Problem Set 6", "Thursday", "violet"],
                    ["Midterm 2", "Oct 14", "rose"],
                    ["Reading: Ch. 9–10", "Oct 16", "teal"],
                  ].map(([t, d]) => (
                    <li key={t} className="flex items-center gap-3 text-caption">
                      <span className="h-4 w-4 rounded-full border-[1.5px] border-line-strong" />
                      <span className="h-5 w-1 rounded-full bg-brand-400" />
                      <span className="flex-1 font-medium text-ink">{t}</span>
                      <span className="text-ink-muted tabular">{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div aria-hidden className="pointer-events-none absolute -inset-x-20 -bottom-10 -z-10 h-56 rounded-full bg-brand-100/60 blur-3xl" />
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-10 px-6 pb-24 sm:grid-cols-3">
          {[
            {
              icon: CalendarDays,
              title: "Every deadline, one timeline",
              body: "Assignments, readings, quizzes and exams grouped by This Week / Next Week / Later, color-tagged by course. Subscribe from Google or Apple Calendar.",
            },
            {
              icon: Target,
              title: "Know what you need",
              body: "Log grades as they land. See your standing and exactly what score on the remaining work gets you to your target.",
            },
            {
              icon: BellRing,
              title: "Reminders that actually help",
              body: "Push and email nudges 3 days and 1 day before. A Monday digest with what's due this week. A study plan around your classes.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-h3 font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-body text-ink-muted">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-8 text-caption text-ink-subtle">
        <span>© {new Date().getFullYear()} SyllaHub</span>
        <span>Made for students who&apos;d rather not read the syllabus twice.</span>
      </footer>
    </div>
  );
}
