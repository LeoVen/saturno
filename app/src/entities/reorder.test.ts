import { describe, expect, it } from 'vitest'
import { moveItem, moveItemWithinGroup } from './reorder'

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('moveItem', () => {
  it('swaps an item with its previous neighbor when moving up', () => {
    expect(moveItem(items, 'b', 'up').map((i) => i.id)).toEqual(['b', 'a', 'c'])
  })

  it('swaps an item with its next neighbor when moving down', () => {
    expect(moveItem(items, 'b', 'down').map((i) => i.id)).toEqual(['a', 'c', 'b'])
  })

  it('is a no-op moving the first item up', () => {
    expect(moveItem(items, 'a', 'up').map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op moving the last item down', () => {
    expect(moveItem(items, 'c', 'down').map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op for an unknown id', () => {
    expect(moveItem(items, 'missing', 'up').map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate the original array', () => {
    const original = [...items]
    moveItem(items, 'b', 'up')
    expect(items).toEqual(original)
  })
})

describe('moveItemWithinGroup', () => {
  // Interleaved on purpose: segX and segY's Grades are not stored
  // contiguously, mirroring how `grades` actually accumulates as the user
  // adds Grades to different Segments over time.
  const grades = [
    { id: 'x1', segmentId: 'segX' },
    { id: 'y1', segmentId: 'segY' },
    { id: 'x2', segmentId: 'segX' },
    { id: 'y2', segmentId: 'segY' },
    { id: 'x3', segmentId: 'segX' },
  ]

  it('swaps only with a neighbor in the same group, ignoring interleaved other groups', () => {
    const result = moveItemWithinGroup(grades, 'x2', 'up', (g) => g.segmentId)
    expect(result.map((g) => g.id)).toEqual(['x2', 'y1', 'x1', 'y2', 'x3'])
  })

  it('moving down likewise only reaches the next same-group item', () => {
    const result = moveItemWithinGroup(grades, 'x1', 'down', (g) => g.segmentId)
    expect(result.map((g) => g.id)).toEqual(['x2', 'y1', 'x1', 'y2', 'x3'])
  })

  it('is a no-op at the boundary of its own group, even mid-array', () => {
    // x3 is last within segX but not last in the overall array.
    expect(moveItemWithinGroup(grades, 'x3', 'down', (g) => g.segmentId)).toBe(grades)
    // y1 is first within segY but not first in the overall array.
    expect(moveItemWithinGroup(grades, 'y1', 'up', (g) => g.segmentId)).toBe(grades)
  })

  it('is a no-op for an unknown id', () => {
    expect(moveItemWithinGroup(grades, 'missing', 'up', (g) => g.segmentId)).toBe(grades)
  })

  it('does not mutate the original array', () => {
    const original = grades.map((g) => ({ ...g }))
    moveItemWithinGroup(grades, 'x2', 'up', (g) => g.segmentId)
    expect(grades).toEqual(original)
  })
})
