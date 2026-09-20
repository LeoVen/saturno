// Pure helper (TR-11 pattern) backing manual reordering of lists with no
// natural sort key — unlike Time Slots/Breaks (D-07: auto-sorted
// chronologically), Teachers and Subjects have no inherent order, so the
// user positions them by hand instead.

export type MoveDirection = 'up' | 'down'

/**
 * Swaps the item identified by `id` with its neighbor in `direction`.
 * Returns the original array (same reference) if `id` isn't found or the
 * move would go out of bounds — callers can compare by reference to detect
 * a no-op if needed, but in practice just reassign the result either way.
 */
export function moveItem<T extends { id: string }>(
  items: T[],
  id: string,
  direction: MoveDirection,
): T[] {
  const index = items.findIndex((item) => item.id === id)
  if (index === -1) return items
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= items.length) return items
  const copy = [...items]
  const temp = copy[index]!
  copy[index] = copy[targetIndex]!
  copy[targetIndex] = temp
  return copy
}

/**
 * Same as `moveItem`, but for a flat array that groups several independent
 * orderings together (e.g. every Segment's Grades, in one `grades` array) —
 * `groupKey` identifies the item's group (e.g. `segmentId`), and the swap
 * only ever happens against a neighbor in the *same* group, so reordering
 * one Segment's Grades can never reach into another Segment's. Items
 * outside the group keep their exact absolute position.
 */
export function moveItemWithinGroup<T extends { id: string }>(
  items: T[],
  id: string,
  direction: MoveDirection,
  groupKey: (item: T) => unknown,
): T[] {
  const target = items.find((item) => item.id === id)
  if (!target) return items
  const key = groupKey(target)
  const positions: number[] = []
  const group: T[] = []
  items.forEach((item, index) => {
    if (groupKey(item) === key) {
      positions.push(index)
      group.push(item)
    }
  })
  const reorderedGroup = moveItem(group, id, direction)
  if (reorderedGroup === group) return items
  const result = [...items]
  positions.forEach((position, i) => {
    result[position] = reorderedGroup[i]!
  })
  return result
}
