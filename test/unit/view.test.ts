import { describe, expect, it } from 'vitest'
import { FilterStack, Selection, SortState, virtualWindow } from '@shared/view'
import { leaf, and, isGroup } from '@shared/filter'

describe('virtual window', () => {
  it('renders only what the viewport needs, plus overscan', () => {
    const w = virtualWindow(250_000, 28, 0, 800, 8)
    expect(w.start).toBe(0)
    expect(w.end).toBeLessThan(60)
    expect(w.totalPx).toBe(250_000 * 28)
  })

  it('offsets correctly when scrolled deep into a large library', () => {
    const w = virtualWindow(250_000, 28, 1_000_000, 800, 8)
    expect(w.start).toBe(Math.floor(1_000_000 / 28) - 8)
    expect(w.offsetPx).toBe(w.start * 28)
    expect(w.end - w.start).toBeLessThan(60)
  })

  it('clamps at both ends', () => {
    expect(virtualWindow(10, 28, -500, 800).start).toBe(0)
    expect(virtualWindow(10, 28, 999_999, 800).end).toBe(10)
  })

  it('rejects a non-positive row height rather than dividing by zero', () => {
    expect(() => virtualWindow(10, 0, 0, 100)).toThrow(/rowHeight/)
  })
})

describe('selection', () => {
  const ordered = [10, 20, 30, 40, 50]

  it('replaces on a plain click', () => {
    const s = new Selection()
    s.apply(ordered, 1, 'replace')
    s.apply(ordered, 3, 'replace')
    expect(s.ids()).toEqual([40])
  })

  it('toggles individual rows', () => {
    const s = new Selection()
    s.apply(ordered, 0, 'replace')
    s.apply(ordered, 2, 'toggle')
    expect(s.ids().sort()).toEqual([10, 30])
    s.apply(ordered, 2, 'toggle')
    expect(s.ids()).toEqual([10])
  })

  it('extends a range from the anchor, in either direction', () => {
    const s = new Selection()
    s.apply(ordered, 3, 'replace')
    s.apply(ordered, 1, 'range')
    expect(s.ids().sort((a, b) => a - b)).toEqual([20, 30, 40])
  })

  it('shrinks when the range reverses, because a range replaces rather than accumulates', () => {
    const s = new Selection()
    s.apply(ordered, 0, 'replace')
    s.apply(ordered, 4, 'range')
    expect(s.size).toBe(5)

    // Walking back with shift held should give back the rows, not keep them.
    s.apply(ordered, 2, 'range')
    expect(s.ids().sort((a, b) => a - b)).toEqual([10, 20, 30])
  })

  it('keeps the anchor put, so every extension measures from the same origin', () => {
    const s = new Selection()
    s.apply(ordered, 2, 'replace')
    s.apply(ordered, 4, 'range')
    s.apply(ordered, 0, 'range')
    expect(s.ids().sort((a, b) => a - b)).toEqual([10, 20, 30])
  })

  it('adds to the existing selection with range-add, for ctrl+shift', () => {
    const s = new Selection()
    s.apply(ordered, 0, 'replace')
    s.apply(ordered, 4, 'toggle')
    s.apply(ordered, 2, 'range-add')
    expect(s.ids().sort((a, b) => a - b)).toEqual([10, 30, 40, 50])
  })

  it('inverts within the current result set', () => {
    const s = new Selection()
    s.apply(ordered, 0, 'replace')
    s.invert(ordered)
    expect(s.ids().sort((a, b) => a - b)).toEqual([20, 30, 40, 50])
  })

  it('drops ids that a narrowed filter removed', () => {
    const s = new Selection()
    s.selectAll(ordered)
    s.retain([10, 30])
    expect(s.ids().sort((a, b) => a - b)).toEqual([10, 30])
  })
})

describe('filter stack', () => {
  it('collapses to a single AST', () => {
    const st = new FilterStack()
    st.push({ id: 'genre', label: 'Jazz', node: leaf('genre', 'any', ['Jazz']), removable: true })
    st.push({ id: 'rating', label: '4+', node: leaf('rating', '>=', 80), removable: true })

    const f = st.toFilter()
    expect(isGroup(f) && f.op === 'and').toBe(true)
    expect(isGroup(f) && f.children).toHaveLength(2)
  })

  it('replaces a chip with the same id rather than stacking duplicates', () => {
    const st = new FilterStack()
    st.push({ id: 'genre', label: 'Jazz', node: leaf('genre', 'any', ['Jazz']), removable: true })
    st.push({ id: 'genre', label: 'Rock', node: leaf('genre', 'any', ['Rock']), removable: true })
    expect(st.list()).toHaveLength(1)
    expect(st.list()[0]!.label).toBe('Rock')
  })

  it('keeps non-removable chips when cleared', () => {
    const st = new FilterStack()
    st.push({ id: 'root', label: 'Library', node: and(), removable: false })
    st.push({ id: 'genre', label: 'Jazz', node: leaf('genre', 'any', ['Jazz']), removable: true })
    st.clear()
    expect(st.list()).toHaveLength(1)
    expect(st.list()[0]!.id).toBe('root')
  })
})

describe('sort state', () => {
  it('replaces keys on a plain click and flips direction on repeat', () => {
    const s = new SortState()
    s.toggle('album', false)
    expect(s.list()).toEqual([{ field: 'album', dir: 'asc' }])
    s.toggle('album', false)
    expect(s.list()).toEqual([{ field: 'album', dir: 'desc' }])
  })

  it('adds a secondary key on shift-click and reports priority', () => {
    const s = new SortState()
    s.toggle('album', false)
    s.toggle('track_number', true)
    expect(s.list()).toHaveLength(2)
    expect(s.priority('album')).toBe(1)
    expect(s.priority('track_number')).toBe(2)
    expect(s.priority('year')).toBe(0)
  })
})
