import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractSyllabusText, MAX_UPLOAD_BYTES, sha256, SUPPORTED_MIME } from "@/lib/parse/extract";
import { PARSE_MODEL, parseSyllabusImage, parseSyllabusText } from "@/lib/parse/llm";
import { parsedSyllabusSchema, type ParsedSyllabus } from "@/lib/parse/schema";
import { canAddCourse } from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST multipart/form-data { file }
 * → { uploadId, parsed, cached }
 *
 * Pipeline: hash → cache lookup → store file → extract text → LLM → cache write.
 */
export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const supabase = await createClient();

  // Free-tier gate: check before spending money on a parse.
  const { count } = await supabase
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("archived", false);
  if (!canAddCourse(profile, count ?? 0)) {
    return NextResponse.json({ error: "course_limit", message: "Upgrade to add more courses." }, { status: 402 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  const mime = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
  if (!SUPPORTED_MIME.has(mime)) {
    return NextResponse.json({ error: "Please upload a PDF or a photo (PNG/JPG/WebP)." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File is larger than 20 MB." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = sha256(buf);
  const admin = createAdminClient();

  // 1. Cache: identical file → skip the paid parse entirely.
  const { data: cached } = await admin.from("parse_cache").select("parsed").eq("content_hash", hash).maybeSingle();

  // 2. Store the original in private storage (best effort — parsing works without it).
  const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1] ?? "bin";
  const storagePath = `${profile.id}/${hash}.${ext}`;
  const { error: storageError } = await supabase.storage
    .from("syllabi")
    .upload(storagePath, buf, { contentType: mime, upsert: true });

  // 3. Create the upload record up front so failures are visible.
  const { data: upload, error: uploadError } = await supabase
    .from("syllabus_uploads")
    .insert({
      user_id: profile.id,
      file_name: file.name,
      storage_path: storageError ? null : storagePath,
      mime_type: mime,
      content_hash: hash,
      status: "pending",
    })
    .select("id")
    .single();
  if (uploadError || !upload) {
    return NextResponse.json({ error: uploadError?.message ?? "Could not record upload" }, { status: 500 });
  }

  try {
    let parsed: ParsedSyllabus;
    let fromCache = false;

    if (cached?.parsed) {
      const check = parsedSyllabusSchema.safeParse(cached.parsed);
      if (check.success) {
        parsed = check.data;
        fromCache = true;
      } else {
        parsed = await runParse(buf, mime);
      }
    } else {
      parsed = await runParse(buf, mime);
    }

    if (!fromCache) {
      await admin.from("parse_cache").upsert({ content_hash: hash, parsed, model: PARSE_MODEL });
    }

    await supabase.from("syllabus_uploads").update({ status: "parsed", parsed }).eq("id", upload.id);

    return NextResponse.json({ uploadId: upload.id, parsed, cached: fromCache });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parsing failed";
    await supabase.from("syllabus_uploads").update({ status: "failed", error: message }).eq("id", upload.id);
    console.error("[parse] failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function runParse(buf: Buffer, mime: string): Promise<ParsedSyllabus> {
  const extracted = await extractSyllabusText(buf, mime);
  if (extracted.kind === "text") {
    const parsed = await parseSyllabusText(extracted.text);
    if (extracted.method === "ocr") {
      parsed.warnings = ["Text was read from a photo with OCR — double-check dates and numbers.", ...parsed.warnings];
    }
    return parsed;
  }

  // No text layer. Photos can fall back to a vision model if enabled.
  if (mime.startsWith("image/") && process.env.PARSE_VISION_FALLBACK === "true") {
    const parsed = await parseSyllabusImage(buf, mime);
    parsed.warnings = ["Parsed directly from the photo — double-check dates and numbers.", ...parsed.warnings];
    return parsed;
  }

  throw new Error(
    `${extracted.reason} Try exporting the syllabus as a text PDF, or upload clear photos of each page.`,
  );
}
