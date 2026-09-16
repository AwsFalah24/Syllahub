import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { getProfile } from '@/lib/supabase/server';
import { nowInTz } from '@/lib/dates';
import { getScheduleBlocks } from '@/lib/schedule-data';
import { PlanWorkspace } from '@/components/plan/plan-workspace';
import CalendarPage from '../calendar/page';

export const metadata = { title: 'Plan' };
export default async function PlanPage({ searchParams }: PageProps<'/plan'>) {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  const saved = await getScheduleBlocks(profile.id);
  return <div>
    <PlanWorkspace blocks={saved.blocks} available={saved.available} today={format(nowInTz(profile.timezone), 'yyyy-MM-dd')} hours={Number(profile.study_hours_per_day)} />
    <CalendarPage params={Promise.resolve({})} searchParams={searchParams} />
  </div>;
}
