// Framework-free view state: selection, the filter stack, sort state, and virtualization maths.
//
// This is deliberately plain TypeScript with no reactivity primitives. Whatever UI framework sits
// on top only needs to observe `version` and re-read; swapping Svelte for React (or adding a second
// front end, such as a remote web UI) does not touch anything in this file.

import { and, isGroup, type FilterNode, type SortKey } from './filter'

export interface FilterChip {
  id: string
  label: string
  node: FilterNode
  removable: boolean
}

export interface VirtualWindow {
  /** First row index to render, including overscan. */
  start: number
  /** Exclusive end index. */
  end: number
  /** Pixel offset of `start`, for the spacer transform. */
  offsetPx: number
  /** Total scrollable height. */
  totalPx: number
}

/**
 * Which rows a viewport needs. Pure arithmetic — the UI supplies numbers and applies the result;
 * no DOM measurement happens here, so it is unit-testable and framework-neutral.
 */
export function virtualWindow(
  totalRows: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
  overscan = 8
): VirtualWindow {
  if (rowHeight <= 0) throw new Error('rowHeight must be positive')

  const totalPx = totalRows * rowHeight
  const firstVisible = Math.floor(Math.max(0, scrollTop) / rowHeight)
  const visibleCount = Math.ceil(viewportHeight / rowHeight)

  const start = Math.max(0, firstVisible - overscan)
  const end = Math.min(totalRows, firstVisible + visibleCount + overscan)

  return { start, end, offsetPx: start * rowHeight, totalPx }
}

export type SelectionIntent = 'replace' | 'toggle' | 'range'

/**
 * The selection model every list widget shares. Anchored ranges, toggles and inversion behave the
 * same in the song list, the queue and the filter panes because they all use this.
 */
export class Selection {
  private readonly set = new Set<number>()
  private anchor: number | null = null
  version = 0

  get size(): number { return this.set.size }

  /** Internal state, for diagnostics: a wrong range is usually a wrong anchor. */
  inspect(): { size: number; anchor: number | null } {
    return { size: this.set.size, anchor: this.anchor }
  }
  has(id: number): boolean { return this.set.has(id) }
  ids(): number[] { return [...this.set] }

  private bump(): void { this.version++ }

  clear(): void { this.set.clear(); this.anchor = null; this.bump() }

  /** Applies a click at `index` within `ordered`, honouring the modifier intent. */
  apply(ordered: readonly number[], index: number, intent: SelectionIntent): void {
    const id = ordered[index]
    if (id === undefined) return

    if (intent === 'replace') {
      this.set.clear()
      this.set.add(id)
      this.anchor = index
    } else if (intent === 'toggle') {
      if (this.set.has(id)) this.set.delete(id)
      else this.set.add(id)
      this.anchor = index
    } else {
      const from = this.anchor ?? index
      const [lo, hi] = from <= index ? [from, index] : [index, from]
      for (let i = lo; i <= hi; i++) {
        const rid = ordered[i]
        if (rid !== undefined) this.set.add(rid)
      }
    }

    this.bump()
  }

  selectAll(ordered: readonly number[]): void {
    ordered.forEach((id) => this.set.add(id))
    this.bump()
  }

  invert(ordered: readonly number[]): void {
    const next = ordered.filter((id) => !this.set.has(id))
    this.set.clear()
    next.forEach((id) => this.set.add(id))
    this.bump()
  }

  /** Drops ids that are no longer present, which happens after a filter narrows. */
  retain(ordered: readonly number[]): void {
    const keep = new Set(ordered)
    let changed = false
    for (const id of this.set) {
      if (!keep.has(id)) { this.set.delete(id); changed = true }
    }
    if (changed) this.bump()
  }
}

/**
 * The visible query, expressed as a stack of removable chips. The stack IS the filter AST, which is
 * what lets any browse state be saved as a smart playlist unchanged.
 */
export class FilterStack {
  private chips: FilterChip[] = []
  version = 0

  list(): readonly FilterChip[] { return this.chips }

  push(chip: FilterChip): void {
    this.chips = [...this.chips.filter((c) => c.id !== chip.id), chip]
    this.version++
  }

  remove(id: string): void {
    this.chips = this.chips.filter((c) => c.id !== id)
    this.version++
  }

  clear(): void { this.chips = this.chips.filter((c) => !c.removable); this.version++ }

  /** Collapses the stack into a single AST; an empty stack means the whole library. */
  toFilter(): FilterNode {
    const nodes = this.chips.map((c) => c.node).filter((n) => !(isGroup(n) && n.children.length === 0))
    return nodes.length === 1 ? nodes[0]! : and(...nodes)
  }
}

/** Multi-key sort with shift-click semantics, shared by every column header. */
export class SortState {
  private keys: SortKey[] = []
  version = 0

  list(): readonly SortKey[] { return this.keys }

  toggle(fieldId: string, additive: boolean): void {
    const existing = this.keys.find((k) => k.field === fieldId)

    if (!additive) {
      this.keys = [{ field: fieldId, dir: existing?.dir === 'asc' ? 'desc' : 'asc' }]
    } else if (existing) {
      existing.dir = existing.dir === 'asc' ? 'desc' : 'asc'
      this.keys = [...this.keys]
    } else {
      this.keys = [...this.keys, { field: fieldId, dir: 'asc' }]
    }

    this.version++
  }

  /** Sort priority of a field, 1-based; 0 when the field is not a sort key. */
  priority(fieldId: string): number {
    return this.keys.findIndex((k) => k.field === fieldId) + 1
  }

  set(keys: readonly SortKey[]): void { this.keys = [...keys]; this.version++ }
}
