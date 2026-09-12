"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CheckCircle2, FileText, Loader2, Sparkles, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Stage = "idle" | "uploading" | "extracting" | "parsing" | "done" | "error";

const STAGE_COPY: Record<Stage, string> = {
  idle: "",
  uploading: "Uploading your syllabus…",
  extracting: "Reading the text…",
  parsing: "Finding deadlines, exams and grading weights…",
  done: "Done — opening review",
  error: "Something went wrong",
};

export function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = stage !== "idle" && stage !== "error" && stage !== "done";

  const onFiles = useCallback((files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const ok = f.type === "application/pdf" || f.type.startsWith("image/") || f.name.toLowerCase().endsWith(".pdf");
    if (!ok) {
      toast.error("Please choose a PDF or a photo.");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("That file is over 20 MB.");
      return;
    }
    setFile(f);
    setError(null);
    setStage("idle");
  }, []);

  async function parse() {
    if (!file) return;
    setError(null);
    setStage("uploading");
    const fd = new FormData();
    fd.append("file", file);

    // Stage hints are cosmetic; the server does the real work in one request.
    const t1 = setTimeout(() => setStage("extracting"), 1200);
    const t2 = setTimeout(() => setStage("parsing"), 3500);

    try {
      const res = await fetch("/api/parse", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      clearTimeout(t1);
      clearTimeout(t2);
      if (res.status === 402) {
        router.push("/upgrade?reason=course_limit");
        return;
      }
      if (!res.ok) {
        throw new Error(json.error ?? "Parsing failed");
      }
      setStage("done");
      router.push(`/courses/review?upload=${json.uploadId}`);
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      setStage("error");
      setError(err instanceof Error ? err.message : "Parsing failed");
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!busy) onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200",
          drag ? "border-brand-400 bg-brand-50" : "border-line-strong bg-surface hover:border-brand-300 hover:bg-brand-50/40",
          busy && "cursor-default",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />

        <AnimatePresence mode="wait">
          {busy ? (
            <motion.div
              key="busy"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex flex-col items-center"
            >
              <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
                <Sparkles className="h-6 w-6" />
                <span className="absolute inset-0 animate-pulse-soft rounded-2xl ring-4 ring-brand-200/60" />
              </div>
              <p className="text-h3 font-semibold text-ink">{STAGE_COPY[stage]}</p>
              <p className="mt-1 text-caption text-ink-muted">Usually takes 10–30 seconds.</p>
              <ProgressSteps stage={stage} />
            </motion.div>
          ) : file ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex flex-col items-center"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-bg text-brand-600 shadow-soft">
                {file.type.startsWith("image/") ? <Camera className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
              </div>
              <p className="max-w-xs truncate text-body font-medium text-ink">{file.name}</p>
              <p className="mt-0.5 text-caption text-ink-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setStage("idle");
                  setError(null);
                }}
                className="mt-3 inline-flex items-center gap-1 text-caption text-ink-muted hover:text-ink"
              >
                <X className="h-3.5 w-3.5" /> Choose a different file
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex flex-col items-center"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-bg text-brand-600 shadow-soft">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="text-h3 font-semibold text-ink">Drop your syllabus here</p>
              <p className="mt-1 text-caption text-ink-muted">PDF or a photo of the page · up to 20 MB</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
                  <FileText className="h-4 w-4" /> Choose file
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="sm:hidden"
                  onClick={(e) => {
                    e.stopPropagation();
                    cameraRef.current?.click();
                  }}
                >
                  <Camera className="h-4 w-4" /> Take a photo
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-caption text-danger">{error}</div>
      ) : null}

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-caption text-ink-muted">You&apos;ll review everything before it&apos;s saved.</p>
        <Button size="lg" disabled={!file || busy} onClick={parse} className="sm:min-w-44">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Parsing…" : "Parse syllabus"}
        </Button>
      </div>
    </div>
  );
}

function ProgressSteps({ stage }: { stage: Stage }) {
  const steps: Stage[] = ["uploading", "extracting", "parsing"];
  const idx = steps.indexOf(stage);
  return (
    <ol className="mt-6 flex items-center gap-2">
      {steps.map((s, i) => {
        const done = i < idx || stage === "done";
        const active = i === idx;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-micro font-semibold transition-colors",
                done ? "bg-brand-500 text-white" : active ? "bg-brand-100 text-brand-700" : "bg-surface-2 text-ink-subtle",
              )}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </span>
            {i < steps.length - 1 ? <span className={cn("h-px w-8", done ? "bg-brand-400" : "bg-line")} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
