import { describe, expect, it } from 'vitest'
import { dedupeCandidates, scheduleDistanceFraction } from './candidateDedup'
import type { Weekday } from '../entities/weekday'
import type { Candidate, PlacedPeriod, Schedule } from '../wasm/types'

function placement(
  classId: string,
  weekday: Weekday,
  timeSlotId: string,
  subjectId: string,
  teacherId: string,
): PlacedPeriod {
  return { classId, weekday, timeSlotId, subjectId, teacherId }
}

function schedule(placements: PlacedPeriod[]): Schedule {
  return { placements }
}

function candidate(total: number, placements: PlacedPeriod[]): Candidate {
  return {
    schedule: schedule(placements),
    score: { teacherGapPenalty: 0, subjectDistributionPenalty: 0, total },
  }
}

/** One Class, one Subject/Teacher, one placement per weekday — every test below tweaks a copy of this. */
const BASE_5: PlacedPeriod[] = [
  placement('c1', 'mon', 'ts1', 'sub1', 't1'),
  placement('c1', 'tue', 'ts1', 'sub1', 't1'),
  placement('c1', 'wed', 'ts1', 'sub1', 't1'),
  placement('c1', 'thu', 'ts1', 'sub1', 't1'),
  placement('c1', 'fri', 'ts1', 'sub1', 't1'),
]

describe('scheduleDistanceFraction', () => {
  it('is 0 for identical schedules', () => {
    expect(scheduleDistanceFraction(schedule(BASE_5), schedule(BASE_5))).toBe(0)
  })

  it('is 0 for two schedules with no placements at all (no divide-by-zero)', () => {
    expect(scheduleDistanceFraction(schedule([]), schedule([]))).toBe(0)
  })

  it('counts exactly the differing slots out of the union of both', () => {
    // Only Friday's Teacher differs (t1 -> t2): 1 of 5 slots.
    const oneSlotDifferent = [...BASE_5.slice(0, 4), placement('c1', 'fri', 'ts1', 'sub1', 't2')]
    expect(scheduleDistanceFraction(schedule(BASE_5), schedule(oneSlotDifferent))).toBeCloseTo(0.2)
  })

  it('counts a slot present in only one schedule as differing too', () => {
    const a = [placement('c1', 'mon', 'ts1', 'sub1', 't1')]
    const b = [
      placement('c1', 'mon', 'ts1', 'sub1', 't1'),
      placement('c1', 'tue', 'ts1', 'sub1', 't1'),
    ]
    // Union has 2 keys; only "tue" differs (absent in `a`).
    expect(scheduleDistanceFraction(schedule(a), schedule(b))).toBeCloseTo(0.5)
  })

  it('is 1 when the schedules share no slot at all', () => {
    const a = [placement('c1', 'mon', 'ts1', 'sub1', 't1')]
    const b = [placement('c1', 'mon', 'ts2', 'sub1', 't1')]
    expect(scheduleDistanceFraction(schedule(a), schedule(b))).toBe(1)
  })
})

describe('dedupeCandidates', () => {
  it('returns an empty array unchanged', () => {
    expect(dedupeCandidates([])).toEqual([])
  })

  it('returns a single candidate unchanged', () => {
    const only = candidate(1, BASE_5)
    expect(dedupeCandidates([only])).toEqual([only])
  })

  it('keeps only the better-scoring one of two identical schedules, regardless of input order', () => {
    const better = candidate(1, BASE_5)
    const worse = candidate(5, BASE_5)
    expect(dedupeCandidates([worse, better])).toEqual([better])
    expect(dedupeCandidates([better, worse])).toEqual([better])
  })

  it('keeps both when the schedules are meaningfully different', () => {
    const a = candidate(1, BASE_5)
    const mostlyDifferent = [
      placement('c1', 'mon', 'ts1', 'sub1', 't2'),
      placement('c1', 'tue', 'ts1', 'sub1', 't2'),
      placement('c1', 'wed', 'ts1', 'sub1', 't2'),
      placement('c1', 'thu', 'ts1', 'sub1', 't1'),
      placement('c1', 'fri', 'ts1', 'sub1', 't1'),
    ]
    const b = candidate(2, mostlyDifferent) // 3/5 = 0.6, well above the default 5% threshold
    expect(dedupeCandidates([a, b])).toHaveLength(2)
  })

  it('drops a near-duplicate of an already-kept, better candidate', () => {
    const best = candidate(0, BASE_5)
    const nearDuplicate = candidate(1, [
      ...BASE_5.slice(0, 4),
      placement('c1', 'fri', 'ts1', 'sub1', 't2'),
    ]) // 0.2 from `best`
    expect(dedupeCandidates([nearDuplicate, best], 0.25)).toEqual([best])
  })

  it('a smaller threshold keeps a candidate a looser one would have dropped', () => {
    const best = candidate(0, BASE_5)
    const slightlyDifferent = candidate(1, [
      ...BASE_5.slice(0, 4),
      placement('c1', 'fri', 'ts1', 'sub1', 't2'),
    ]) // 0.2 from `best`
    expect(dedupeCandidates([slightlyDifferent, best], 0.25)).toEqual([best])
    expect(dedupeCandidates([slightlyDifferent, best], 0.1)).toHaveLength(2)
  })

  it('never re-compares a candidate against one that was itself already dropped', () => {
    // A (best, score 0) and C (score 2) are far apart (0.4). B (score 1)
    // sits close to A (0.2, so B gets dropped as A's near-duplicate) and
    // also close to C (0.2). If dedup wrongly compared C against the
    // *dropped* B instead of only the surviving *kept* set {A}, C would be
    // wrongly dropped too, even though it isn't actually near A.
    const a = candidate(0, BASE_5)
    const b = candidate(1, [...BASE_5.slice(0, 4), placement('c1', 'fri', 'ts1', 'sub1', 't2')])
    const c = candidate(2, [
      ...BASE_5.slice(0, 3),
      placement('c1', 'thu', 'ts1', 'sub1', 't2'),
      placement('c1', 'fri', 'ts1', 'sub1', 't2'),
    ])

    expect(scheduleDistanceFraction(a.schedule, b.schedule)).toBeCloseTo(0.2)
    expect(scheduleDistanceFraction(a.schedule, c.schedule)).toBeCloseTo(0.4)
    expect(scheduleDistanceFraction(b.schedule, c.schedule)).toBeCloseTo(0.2)

    expect(dedupeCandidates([a, b, c], 0.25)).toEqual([a, c])
  })
})
