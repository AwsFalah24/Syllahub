import "server-only";

/** Cron routes accept `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this automatically). */
export function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}
