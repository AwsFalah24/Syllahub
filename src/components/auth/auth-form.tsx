"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.55-5.17 3.55-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.98-3.09Z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const supabase = createClient();

  async function handleGoogle() {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      toast.error(error.message);
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/onboarding");
          router.refresh();
        } else {
          setCheckEmail(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <div className="animate-fade-up text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M4 6h16v12H4z" />
            <path d="m4 7 8 6 8-6" />
          </svg>
        </div>
        <h2 className="text-h2 font-semibold">Check your inbox</h2>
        <p className="mt-2 text-ink-muted">
          We sent a confirmation link to <span className="font-medium text-ink">{email}</span>. Click it to finish
          creating your account.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-h1 font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p className="mt-2 text-ink-muted">
        {mode === "login"
          ? "Sign in to see what's due and where your grades stand."
          : "Upload a syllabus and let SyllaHub map out your semester."}
      </p>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mt-8 w-full"
        onClick={handleGoogle}
        loading={googleLoading}
      >
        {!googleLoading && <GoogleIcon />}
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3 text-micro uppercase tracking-wider text-ink-subtle">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" ? (
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Chen"
            />
          </div>
        ) : null}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.edu"
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-caption text-ink-muted">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
