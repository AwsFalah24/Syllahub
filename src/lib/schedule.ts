import { z } from 'zod';

export const blockSchema = z.object({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(['work', 'volunteering', 'study', 'quiz', 'personal', 'other']),
  date: z.iso.date(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
export type BlockInput = z.infer<typeof blockSchema>;
export type ScheduleBlock = BlockInput & { id: string };
export const BLOCK_LABELS = { work: 'Work', volunteering: 'Volunteering', study: 'Studying', quiz: 'Quiz / test', personal: 'Personal', other: 'Other' };
export function overlaps(a: BlockInput, b: BlockInput) {
  return a.date === b.date && a.start_time < b.end_time && a.end_time > b.start_time;
}
