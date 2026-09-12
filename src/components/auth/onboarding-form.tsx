"use client";

import { useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { completeOnboarding } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
}

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-8 space-y-5"
      action={(fd) =>
        start(async () => {
          fd.set("timezone", browserTimezone());
          const res = await completeOnboarding(fd);
          if (res?.error) toast.error(res.error);
        })
      }
    >
      <div>
        <Label htmlFor="full_name">Your name</Label>
        <Input id="full_name" name="full_name" defaultValue={defaultName} required autoFocus placeholder="Alex Chen" />
      </div>
      <div>
        <Label htmlFor="school">School</Label>
        <Input id="school" name="school" required placeholder="University of Toronto" />
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Continue to upload
        {!pending && <ArrowRight className="h-4 w-4" />}
      </Button>
    </form>
  );
}
