import "server-only";
import { createHash } from "node:crypto";

export const SUPPORTED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
]);

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
/** Keep prompt size bounded; a 30-page syllabus is well under this. */
export const MAX_TEXT_CHARS = 60_000;
/** Below this we assume the PDF is scanned / has no text layer. */
export const MIN_USEFUL_CHARS = 150;

export function sha256(buf: Buffer | Uint8Array) {
  return createHash("sha256").update(buf).digest("hex");
}

export function normalizeText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function extractPdfText(buf: Buffer): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  return { text: normalizeText(text), pages: totalPages };
}

export async function ocrImage(buf: Buffer): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    // Cache language data between invocations where the FS is writable.
    cachePath: process.env.TESSERACT_CACHE_PATH ?? "/tmp",
    logger: () => {},
  });
  try {
    const {
      data: { text },
    } = await worker.recognize(buf);
    return normalizeText(text);
  } finally {
    await worker.terminate();
  }
}

export type ExtractResult =
  | { kind: "text"; text: string; pages: number; method: "pdf" | "ocr" }
  | { kind: "image-only"; reason: string };

/**
 * Turn an uploaded file into plain text. PDFs use their text layer; images go
 * through OCR. Scanned PDFs with no text layer are reported so the caller can
 * fall back to a vision model or ask the student for a photo.
 */
export async function extractSyllabusText(buf: Buffer, mime: string): Promise<ExtractResult> {
  if (mime === "application/pdf") {
    const { text, pages } = await extractPdfText(buf);
    if (text.length >= MIN_USEFUL_CHARS) {
      return { kind: "text", text: text.slice(0, MAX_TEXT_CHARS), pages, method: "pdf" };
    }
    return { kind: "image-only", reason: "This PDF has no text layer (it looks scanned)." };
  }

  if (mime.startsWith("image/")) {
    const text = await ocrImage(buf);
    if (text.length >= MIN_USEFUL_CHARS) {
      return { kind: "text", text: text.slice(0, MAX_TEXT_CHARS), pages: 1, method: "ocr" };
    }
    return { kind: "image-only", reason: "We couldn't read enough text from this photo." };
  }

  throw new Error(`Unsupported file type: ${mime}`);
}
