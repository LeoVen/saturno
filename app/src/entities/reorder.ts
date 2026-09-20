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
