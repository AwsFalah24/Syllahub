import "server-only";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { parsedSyllabusSchema, type ParsedSyllabus } from "./schema";

export const PARSE_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? PARSE_MODEL;

let client: OpenAI | null = null;
function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  return client;
}

function systemPrompt(today: string) {
  return `You are a meticulous assistant that converts university course syllabi into structured JSON for a student's planner.

Today's date is ${today}. Use it to infer the year for dates that omit one (e.g. "Sept 14" in a Fall syllabus). Prefer the term stated in the syllabus over today's date when they disagree. Never invent dates: if a date is not present or cannot be derived (e.g. only "Week 5" with no start date), set due_date to null and mention it in warnings.

Rules:
- Extract EVERY graded item, exam, quiz, reading and deliverable you can find, one per row. Expand recurring items when the individual dates are listed ("Quiz 1 ... Quiz 2 ..."). Do not merge them.
- "type": use "exam" for midterms/finals, "quiz" for quizzes/tests, "project" for term projects/papers/presentations, "reading" for assigned readings, "assignment" for homework/problem sets/labs, else "other".
- Grading components: list each component with its weight as a percentage. Weights should sum to ~100. If the syllabus gives ranges or alternatives, pick the default scheme and explain in warnings.
- For each assignment, set "component" to the exact name of the grading component it counts toward (e.g. all problem sets -> "Homework"). Set "weight_percent" only when that individual item's weight is stated explicitly.
- Meetings: capture regular lecture/lab/tutorial times as day_of_week (0=Sunday) with 24h HH:MM times.
- Notes: capture late policy, attendance policy, office hours, contact info, and every specific professor instruction or rule (e.g. "no laptops", "cite in APA", "bring a calculator", "email subject must include course code"). One rule per note. Quote or closely paraphrase the syllabus. Do not include generic university boilerplate (academic integrity statements, accessibility offices) unless it contains a course-specific rule.
- Keep titles short and human ("Problem Set 3", not "Problem Set 3 due Friday at 11:59pm").
- Output times in 24h HH:MM. Output dates as YYYY-MM-DD.
- Set confidence to "low" if dates were mostly inferred or the text was garbled (e.g. from OCR).`;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export async function parseSyllabusText(text: string): Promise<ParsedSyllabus> {
  const openai = getClient();
  const completion = await openai.chat.completions.parse({
    model: PARSE_MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt(todayString()) },
      {
        role: "user",
        content: `Here is the syllabus text. Extract it into the schema.\n\n<syllabus>\n${text}\n</syllabus>`,
      },
    ],
    response_format: zodResponseFormat(parsedSyllabusSchema, "syllabus"),
  });

  const message = completion.choices[0]?.message;
  if (!message?.parsed) {
    throw new Error(message?.refusal ?? "The model did not return structured output");
  }
  return postProcess(message.parsed);
}

/**
 * Vision fallback for photos where OCR failed. Costs more, so it is only used
 * when PARSE_VISION_FALLBACK=true and OCR produced nothing useful.
 */
export async function parseSyllabusImage(buf: Buffer, mime: string): Promise<ParsedSyllabus> {
  const openai = getClient();
  const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
  const completion = await openai.chat.completions.parse({
    model: VISION_MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt(todayString()) },
      {
        role: "user",
        content: [
          { type: "text", text: "This is a photo of a course syllabus. Extract it into the schema." },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
    response_format: zodResponseFormat(parsedSyllabusSchema, "syllabus"),
  });
  const message = completion.choices[0]?.message;
  if (!message?.parsed) {
    throw new Error(message?.refusal ?? "The model did not return structured output");
  }
  return postProcess(message.parsed);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Light cleanup so the review screen always receives well-formed values. */
export function postProcess(p: ParsedSyllabus): ParsedSyllabus {
  const gradingNames = new Set(p.grading.map((g) => g.name.trim().toLowerCase()));
  return {
    ...p,
    course: {
      ...p.course,
      name: p.course.name.trim() || "Untitled course",
      term_start: p.course.term_start && DATE_RE.test(p.course.term_start) ? p.course.term_start : null,
      term_end: p.course.term_end && DATE_RE.test(p.course.term_end) ? p.course.term_end : null,
    },
    grading: p.grading
      .filter((g) => g.name.trim())
      .map((g) => ({ ...g, name: g.name.trim(), weight_percent: Math.max(0, Math.min(100, g.weight_percent)) })),
    assignments: p.assignments
      .filter((a) => a.title.trim())
      .map((a) => {
        const component = a.component?.trim() ?? null;
        return {
          ...a,
          title: a.title.trim(),
          due_date: a.due_date && DATE_RE.test(a.due_date) ? a.due_date : null,
          due_time: a.due_time && TIME_RE.test(a.due_time) ? a.due_time : null,
          component: component && gradingNames.has(component.toLowerCase()) ? component : null,
        };
      }),
    meetings: p.meetings.filter((m) => TIME_RE.test(m.start_time) && TIME_RE.test(m.end_time)),
    notes: p.notes.filter((n) => n.content.trim()).map((n) => ({ ...n, content: n.content.trim() })),
  };
}
