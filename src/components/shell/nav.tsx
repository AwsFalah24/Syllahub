"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, GraduationCap, LayoutGrid, Plus, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import type { Profile } from "@/lib/types";
import { initials } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Timeline", icon: LayoutGrid },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/plan", label: "Plan", icon: Sparkles },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col px-4 py-6 md:flex">
      <Link href="/dashboard" className="px-2">
        <Logo />
      </Link>

      <Link
        href="/courses/new"
        className="mt-8 flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-500 text-caption font-semibold text-white shadow-brand/40 transition hover:bg-brand-600 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        Add syllabus
      </Link>

      <nav className="mt-6 flex flex-col gap-0.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex h-10 items-center gap-3 rounded-xl px-3 text-body font-medium transition-colors",
                active ? "bg-brand-50 text-brand-700" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", active ? "text-brand-600" : "text-ink-subtle group-hover:text-ink-2")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        {profile.plan === "free" ? (
          <Link
            href="/upgrade"
            className="mb-4 block rounded-2xl bg-surface p-4 transition hover:bg-surface-2"
          >
            <div className="text-caption font-semibold text-ink">Free plan</div>
            <p className="mt-1 text-caption text-ink-muted">1 course included. Upgrade for unlimited courses.</p>
            <span className="mt-2 inline-block text-caption font-semibold text-brand-600">See plans →</span>
          </Link>
        ) : null}
        <Link href="/settings" className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-caption font-semibold text-brand-700">
            {initials(profile.full_name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-caption font-medium text-ink">{profile.full_name ?? "Student"}</span>
            <span className="block truncate text-micro text-ink-subtle">{profile.school ?? profile.email}</span>
          </span>
        </Link>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-md safe-bottom md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-2 pt-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10.5px] font-medium transition-colors",
                active ? "text-brand-600" : "text-ink-subtle hover:text-ink-2",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
