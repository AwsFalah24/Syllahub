import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Brand panel */}
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-surface p-10 lg:flex">
        <Link href="/">
          <Logo />
        </Link>
        <div className="relative z-10 max-w-md">
          <p className="text-display font-semibold text-ink">
            Your whole semester, <span className="text-brand-600">organized</span> in one upload.
          </p>
          <p className="mt-5 text-lg leading-relaxed text-ink-muted">
            Deadlines, exams, grading weights and professor rules — pulled straight from your syllabus into a live
            dashboard.
          </p>
        </div>
        <p className="text-caption text-ink-subtle">Built for students who would rather not read the syllabus twice.</p>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-100/70 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl"
        />
      </aside>

      <main className="flex flex-1 flex-col px-6 py-8 sm:px-10">
        <div className="lg:hidden">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
