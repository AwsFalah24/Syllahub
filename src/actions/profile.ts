"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";

const onboardingSchema = z.object({
  full_name: z.string().trim().min(1, "Tell us your name").max(120),
  school: z.string().trim().min(1, "Which school do you attend?").max(200),
  timezone: z.string().trim().min(1).max(80),
});

export async function completeOnboarding(formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");

  const parsed = onboardingSchema.safeParse({
    full_name: formData.get("full_name"),
    school: formData.get("school"),
    timezone: formData.get("timezone") || "America/New_York",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ...parsed.data, onboarded: true })
    .eq("id", user.id);
  if (error) return { error: error.message };

  redirect("/courses/new?first=1");
}

const settingsSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  school: z.string().trim().max(200).nullable(),
  timezone: z.string().trim().min(1).max(80),
  study_hours_per_day: z.coerce.number().min(0.5).max(16),
  study_start_hour: z.coerce.number().int().min(0).max(23),
  study_end_hour: z.coerce.number().int().min(1).max(24),
});

export async function updateProfileSettings(input: z.input<typeof settingsSchema>) {
  const user = await getUser();
  if (!user) return { error: "Not signed in" };
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (parsed.data.study_end_hour <= parsed.data.study_start_hour) {
    return { error: "Study window must end after it starts" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/plan");
  return { ok: true };
}

const notifSchema = z.object({
  reminder_days: z.array(z.number().int().min(0).max(30)).min(0).max(6),
  email_reminders: z.boolean(),
  push_reminders: z.boolean(),
  digest: z.enum(["none", "daily", "weekly"]),
});

export async function updateNotificationSettings(input: z.input<typeof notifSchema>) {
  const user = await getUser();
  if (!user) return { error: "Not signed in" };
  const parsed = notifSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ...parsed.data, reminder_days: Array.from(new Set(parsed.data.reminder_days)).sort((a, b) => b - a) })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function rotateIcsToken() {
  const user = await getUser();
  if (!user) return { error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ ics_token: crypto.randomUUID() }).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
