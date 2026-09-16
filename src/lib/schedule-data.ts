import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ScheduleBlock } from './schedule';

export async function getScheduleBlocks(userId: string) {
  const db = await createClient();
  const { data, error } = await db.from('schedule_blocks').select('id,title,kind,date,start_time,end_time').eq('user_id', userId).order('date').order('start_time');
  return { blocks: (data ?? []).map(b => ({ ...b, start_time: b.start_time.slice(0,5), end_time: b.end_time.slice(0,5) })) as ScheduleBlock[], available: !error };
}
