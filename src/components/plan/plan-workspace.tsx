'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { BLOCK_LABELS, type BlockInput, type ScheduleBlock } from '@/lib/schedule';
import { saveScheduleBlocks, deleteScheduleBlock, suggestSchedule } from '@/actions/schedule';

export function PlanWorkspace({ blocks, available, today, hours }: { blocks: ScheduleBlock[]; available: boolean; today: string; hours: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<BlockInput & { id?: string } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [goals, setGoals] = useState('');
  const [start, setStart] = useState(today);
  const [budget, setBudget] = useState(hours);
  const [draft, setDraft] = useState<{ explanation: string; blocks: BlockInput[] } | null>(null);
  return <section className="mb-10">
    <h1 className="text-h1 font-semibold">Your plan</h1>
    <p className="mt-2 text-ink-muted">Make room for classes, work and everything else. Plan it yourself, or ask AI for a suggestion.</p>
    {!available && <p role="alert" className="mt-4 rounded-xl bg-warning-soft p-4">Schedule storage needs to be enabled. Apply the 0002_schedule_blocks.sql migration in Supabase.</p>}
    <div className="my-5 flex flex-wrap gap-3">
      <Button disabled={!available} onClick={() => setEditing({ title: '', kind: 'study', date: today, start_time: '09:00', end_time: '10:00' })}>Add block</Button>
      <Button variant="outline" disabled={!available} onClick={() => setAiOpen(true)}>Plan with AI</Button>
    </div>
    <details className="rounded-xl bg-surface p-4">
      <summary className="cursor-pointer font-medium">Manage your blocks ({blocks.length})</summary>
      <div className="mt-3 space-y-2">
        {!blocks.length && <p className="text-ink-muted">No personal blocks yet. Add a work shift, volunteering, study session or anything else.</p>}
        {blocks.map(b => <button key={b.id} onClick={() => setEditing(b)} className="flex w-full flex-wrap justify-between gap-2 rounded-lg bg-bg p-3 text-left hover:bg-brand-50"><span>{b.title} · {BLOCK_LABELS[b.kind]}</span><span className="text-caption text-ink-muted">{b.date} · {b.start_time}–{b.end_time} · Edit</span></button>)}
      </div>
    </details>
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !pending) setEditing(null); }}>
      <DialogContent title={editing?.id ? 'Edit block' : 'Add a block'} description="Choose a date and time in your profile’s timezone.">
        {editing && <form className="space-y-4" onSubmit={e => { e.preventDefault(); startTransition(async () => { const r = await saveScheduleBlocks([editing], editing.id); if (r.error) toast.error(r.error); else { setEditing(null); router.refresh(); toast.success('Block saved'); } }); }}>
          <label className="block">Title<input required maxLength={200} className="inline-field border-line" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Work shift, volunteering, quiz…" /></label>
          <label className="block">Category<select className="inline-field" value={editing.kind} onChange={e => setEditing({ ...editing, kind: e.target.value as BlockInput['kind'] })}>{Object.entries(BLOCK_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="block">Date<input required type="date" className="inline-field" value={editing.date} onChange={e => setEditing({ ...editing, date: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">{(['start_time','end_time'] as const).map(k => <label key={k}>{k === 'start_time' ? 'Start' : 'End'}<input required type="time" className="inline-field" value={editing[k]} onChange={e => setEditing({ ...editing, [k]: e.target.value })} /></label>)}</div>
          <div className="flex justify-between gap-3">
            {editing.id && <Button variant="ghost" disabled={pending} onClick={() => { if (!window.confirm('Delete this block?')) return; startTransition(async () => { const r = await deleteScheduleBlock(editing.id!); if (r.error) toast.error(r.error); else { setEditing(null); router.refresh(); } }); }}>Delete</Button>}
            <Button type="submit" loading={pending}>Save block</Button>
          </div>
        </form>}
      </DialogContent>
    </Dialog>
    <Dialog open={aiOpen} onOpenChange={open => { if (!pending) setAiOpen(open); }}>
      <DialogContent title="Let’s plan your week" description="Add your commitments first. AI uses your saved classes, blocks and deadlines. Nothing is saved without your approval.">
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); startTransition(async () => { setDraft(null); const r = await suggestSchedule({ date: start, goals, hours: budget }); if (r.error) toast.error(r.error); else if (r.suggestion) setDraft(r.suggestion); }); }}>
          <label className="block">What should we focus on? Any times to keep free?<textarea required maxLength={2000} className="inline-field min-h-24 bg-surface" value={goals} onChange={e => setGoals(e.target.value)} placeholder="Prepare for Friday’s quiz. Keep evenings free and include breaks." /></label>
          <label className="block">Week starting<input required type="date" min={today} className="inline-field" value={start} onChange={e => setStart(e.target.value)} /></label>
          <label className="block">Maximum study hours per day<input required type="number" min={0.5} max={12} step={0.5} className="inline-field" value={budget} onChange={e => setBudget(Number(e.target.value))} /></label>
          <Button type="submit" loading={pending}>{draft ? 'Revise suggestion' : 'Suggest a timetable'}</Button>
        </form>
        {draft && <div className="mt-6 border-t border-line pt-4">
          <p className="text-caption text-ink-muted">{draft.explanation}</p>
          <p className="my-3 font-medium">Review suggested blocks</p>
          {!draft.blocks.length && <p>No blocks fit. Adjust your preferences and try again.</p>}
          {draft.blocks.map((b,i) => <div key={i} className="my-2 rounded-lg bg-surface p-3"><p>{b.title}</p><p className="text-caption">{b.date} · {b.start_time}–{b.end_time}</p><button disabled={pending} className="text-caption text-danger" onClick={() => setDraft({ ...draft, blocks: draft.blocks.filter((_,j) => j !== i) })}>Remove</button></div>)}
          <Button className="mt-3" loading={pending} disabled={!draft.blocks.length} onClick={() => startTransition(async () => { const r = await saveScheduleBlocks(draft.blocks); if (r.error) toast.error(r.error); else { setDraft(null); setAiOpen(false); router.refresh(); toast.success('Timetable added'); } })}>Accept and add to schedule</Button>
        </div>}
      </DialogContent>
    </Dialog>
  </section>;
}
