import { describe, expect, it } from 'vitest'
import { rankCandidates } from './deepSearchCoordinator'
import type { Weekday } from '../entities/weekday'
import type { Candidate, PlacedPeriod } from '../wasm/types'

function placement(
  classId: string,
  weekday: Weekday,
  timeSlotId: string,
  subjectId: string,
  teacherId: string,
): PlacedPeriod {
  return { classId, weekday, timeSlotId, subjectId, teacherId }
}

function candidate(total: number, placements: PlacedPeriod[]): Candidate {
  return {
    schedule: { placements },
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

describe('rankCandidates', () => {
  it('returns an empty list for an empty pool result', () => {
    expect(rankCandidates([])).toEqual([])
    expect(rankCandidates([[], []])).toEqual([])
  })

  it('merges every Worker’s candidates into one list', () => {
    const workerA = [candidate(0, BASE_5)]
    const workerB = [
      candidate(5, [
        placement('c1', 'mon', 'ts1', 'sub1', 't2'),
        placement('c1', 'tue', 'ts1', 'sub1', 't2'),
        placement('c1', 'wed', 'ts1', 'sub1', 't2'),
        placement('c1', 'thu', 'ts1', 'sub1', 't2'),
        placement('c1', 'fri', 'ts1', 'sub1', 't2'),
      ]),
    ]
    expect(rankCandidates([workerA, workerB])).toHaveLength(2)
  })

  it('ranks the merged list by score.total ascending', () => {
    const meaningfullyDifferent = (teacherId: string) => [
      placement('c1', 'mon', 'ts1', 'sub1', teacherId),
      placement('c1', 'tue', 'ts1', 'sub1', teacherId),
      placement('c1', 'wed', 'ts1', 'sub1', teacherId),
    ]
    const worst = candidate(9, meaningfullyDifferent('t3'))
    const best = candidate(1, meaningfullyDifferent('t1'))
    const middle = candidate(5, meaningfullyDifferent('t2'))

    const ranked = rankCandidates([[worst], [best], [middle]])
    expect(ranked.map((c) => c.score.total)).toEqual([1, 5, 9])
  })

  it('deduplicates near-identical candidates even when they came from different Workers', () => {
    // 5 Classes x 5 weekdays = 25 slots — large enough that a single
    // differing slot (1/25 = 4%) falls under dedup's default 5%
    // threshold; BASE_5 alone (5 slots) can never do that, since its
    // smallest possible nonzero distance is 1/5 = 20%.
    const weekdays: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri']
    const gridFor = (teacherId: string): PlacedPeriod[] =>
      Array.from({ length: 5 }, (_, classIndex) =>
        weekdays.map((weekday) => placement(`c${classIndex}`, weekday, 'ts1', 'sub1', teacherId)),
      ).flat()

    const workerA = [candidate(0, gridFor('t1'))]
    // Worker B independently converged on an almost-identical schedule —
    // only one slot's Teacher differs. A naive "concat + sort" would keep
    // both; rankCandidates must not.
    const almostIdentical = gridFor('t1')
    almostIdentical[0] = placement('c0', 'mon', 'ts1', 'sub1', 't2')
    const workerB = [candidate(1, almostIdentical)]

    const ranked = rankCandidates([workerA, workerB])
    expect(ranked).toHaveLength(1)
    expect(ranked[0]!.score.total).toBe(0)
  })
})
