import { describe, expect, it } from 'vitest'
import { moveItem } from './reorder'

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
