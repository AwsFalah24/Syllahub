import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: body.data.endpoint,
      p256dh: body.data.keys.p256dh,
      auth: body.data.keys.auth,
      user_agent: request.headers.get("user-agent"),
    },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
