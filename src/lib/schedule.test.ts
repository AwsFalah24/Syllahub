import { strict as assert } from 'node:assert';
import { test } from 'node:test';
// @ts-expect-error Node's TypeScript runner requires the explicit extension.
import { blockSchema, overlaps } from './schedule.ts';

const block = { title: 'Study', kind: 'study' as const, date: '2026-09-18', start_time: '09:00', end_time: '10:00' };
test('validates actual dates, clock times and supported categories', () => {
  assert.equal(blockSchema.safeParse(block).success, true);
  for (const patch of [{ date: '2026-02-30' }, { start_time: '25:00' }, { title: '  ' }, { kind: 'unknown' }]) {
    assert.equal(blockSchema.safeParse({ ...block, ...patch }).success, false);
  }
});
test('detects overlap but permits adjacent blocks and different days', () => {
  assert.equal(overlaps(block, { ...block, start_time: '09:30', end_time: '10:30' }), true);
  assert.equal(overlaps(block, { ...block, start_time: '10:00', end_time: '11:00' }), false);
  assert.equal(overlaps(block, { ...block, date: '2026-09-19' }), false);
});
