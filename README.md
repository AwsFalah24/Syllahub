# SyllaHub

A syllabus + grade tracker for university students. Upload a syllabus (PDF or photo), an LLM parses it into deadlines, exams, grading weights and professor rules, and the app turns that into a live timeline, a grade tracker with a "what do I need" calculator, a weekly study plan, and reminders.

Single-user by design: no sharing, groups, or LMS integrations.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4, Turbopack)
- **Supabase** — Postgres, Auth (email/password + Google), Storage for syllabus files
- **OpenAI-compatible LLM** with strict JSON-schema output for parsing; `unpdf` for PDF text, `tesseract.js` for OCR
- **Stripe** Checkout + webhooks (monthly / 4-month / yearly subscriptions)
- **Web Push** (`web-push`) + **Resend** email for reminders and digests

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the schema: paste `supabase/migrations/0001_init.sql` into the SQL editor (or `supabase db push` with the CLI). It creates all tables, RLS policies, the `syllabi` storage bucket, and a trigger that creates a `profiles` row for every new user.
3. **Auth → URL configuration**: set Site URL to your app URL and add `http://localhost:3000/auth/callback` (and your production `/auth/callback`) to Redirect URLs.
4. **Auth → Providers → Google**: enable and add your Google OAuth client ID/secret (authorized redirect URI is `https://<project>.supabase.co/auth/v1/callback`).
5. Copy the project URL, anon key and service-role key into `.env.local`.

### 2. LLM

Set `OPENAI_API_KEY`. The default model is `gpt-4o-mini`; override with `OPENAI_MODEL`. Any OpenAI-compatible endpoint works via `OPENAI_BASE_URL` as long as it supports `response_format: json_schema`.

Only extracted **text** is sent to the model. Parsed results are cached in `parse_cache` by SHA-256 of the file, so re-uploading an identical syllabus is free. Set `PARSE_VISION_FALLBACK=true` to send photos to a vision model when OCR can't read them.

### 3. Stripe

1. Create a product with three recurring prices: monthly (`interval=month`), semester (`interval=month, interval_count=4`), yearly (`interval=year`). Put their IDs in `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_SEMESTER`, `STRIPE_PRICE_YEARLY`.
2. Add a webhook endpoint for `https://<your-app>/api/stripe/webhook` with events `checkout.session.completed` and `customer.subscription.*`. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

The free tier allows 1 active course. The limit is enforced server-side (`/api/parse`, `createCourseFromReview`, un-archiving) and surfaced at the point of adding a second course.

### 4. Notifications

- Web push: `npx web-push generate-vapid-keys` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- Email: `RESEND_API_KEY` and a verified `EMAIL_FROM`.
- Cron: `vercel.json` schedules `/api/cron/reminders` and `/api/cron/digest` hourly. Set `CRON_SECRET`; Vercel passes it as a Bearer token. On other hosts, hit those routes hourly with `Authorization: Bearer <CRON_SECRET>`.

Reminders default to 3 days and 1 day before each deadline (configurable per user). Digests go out at 7am in the user's timezone, daily or weekly (Monday).

## Project layout

```
src/
  app/
    (auth)/login, signup        # auth pages
    auth/callback, signout      # OAuth code exchange, sign-out
    onboarding/                 # name + school → straight to first upload
    (app)/                      # authenticated shell (sidebar / bottom nav)
      dashboard/                # timeline: Overdue / Today / This week / Next week / Later + week load strip
      calendar/                 # month / week views, busy-week rail
      plan/                     # generated study plan (week / month / term)
      courses/                  # list, new (upload), review (edit parsed data), [id] (course + grades)
      settings/, upgrade/
    api/
      parse/                    # upload → extract → LLM → cache
      ics/[token]/              # calendar subscription feed
      stripe/{checkout,portal,webhook}
      push/subscribe
      cron/{reminders,digest}
  actions/                      # server actions (courses, assignments, profile)
  lib/
    grades.ts                   # standing + "what do I need" math
    planner.ts                  # study-plan scheduler
    load.ts                     # busy-week scoring
    parse/{extract,llm,schema}  # text extraction and structured parsing
    notifications/{push,email}
  components/                   # UI, grouped by feature
supabase/migrations/            # schema + RLS
public/sw.js                    # push service worker
```

## Grade math

Each course has weighted components (Midterm 25%, Homework 20%, …). Within a component, graded items are averaged; the share of the component's weight that counts as "locked in" is proportional to how many of its items are graded (3 of 8 homeworks graded → 3/8 of the Homework weight). Components with no items can take a direct grade (e.g. Participation 95%). Items with their own explicit weight and no component act as their own component.

`whatDoINeed(target)` = `(target × totalWeight − pointsBanked) / remainingWeight`. The hero shows it as a single animated number and a bar, with best/worst-case finals alongside.

## Scripts

```bash
npm run dev      # start locally
npm run build    # production build (also type-checks)
npm run lint     # eslint
```
