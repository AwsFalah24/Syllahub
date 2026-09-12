import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-10 text-h1 font-semibold text-ink">That page doesn&apos;t exist</h1>
      <p className="mt-2 max-w-sm text-body text-ink-muted">Maybe the course was deleted, or the link was mistyped.</p>
      <Link href="/dashboard" className="mt-8">
        <Button>Back to timeline</Button>
      </Link>
    </div>
  );
}
