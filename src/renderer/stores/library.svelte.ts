import { ipc } from '../lib/ipc'
// View-model state for the library.
//
// The filter stack and sort state come from shared/view.ts, which is framework-free; this class is
// only the thin reactive wrapper that a Svelte component can observe. Replacing the UI framework
// means rewriting this file, not the logic inside it.

import type { FilterNode } from '@shared/filter'
import { leaf } from '@shared/filter'
import { FilterStack, Selection, SortState } from '@shared/view'
import type { GroupRow, LibraryStats, TrackRow } from '@shared/ipc'
import { field } from '@shared/fields'

const PAGE = 500

class LibraryStore {
  stats = $state<LibraryStats | null>(null)
  tracks = $state<TrackRow[]>([])
  lastSql = $state('')
  error = $state<string | null>(null)
  search = $state('')

  /** Bumped whenever the result set changes, so panes can re-read without deep watching. */
  version = $state(0)

  private readonly stack = new FilterStack()
  private readonly sort = new SortState()
  private readonly paneValues = new Map<string, string>()
  private readonly selection = new Selection()

  /** Bumped on selection changes, for the same reason `version` exists. */
  selectionVersion = $state(0)

  constructor() {
    this.sort.set([{ field: 'album' }, { field: 'disc_number' }, { field: 'track_number' }])
  }

  private filter(): FilterNode {
    return this.stack.toFilter()
  }

  chips(): readonly { id: string; label: string }[] {
    // FilterStack is a plain class, so reading `version` is what ties this to the reactive graph.
    void this.version
    return this.stack.list().filter((c) => c.removable).map((c) => ({ id: c.id, label: c.label }))
  }

  /**
   * The stack is the single source of truth for what is filtered, so a pane reads its own selection
   * back rather than keeping a private copy that could drift from the chips.
   */
  selectionFor(fieldId: string): string | null {
    void this.version
    return this.paneValues.get(fieldId) ?? null
  }

  hasFilters(): boolean {
    void this.version
    return this.stack.list().some((c) => c.removable)
  }

  async clearFilters(): Promise<void> {
    this.stack.clear()
    this.paneValues.clear()
    this.search = ''
    await this.refresh()
  }

  // ── selection ──────────────────────────────────────────────────────────
  isSelected(id: number): boolean {
    void this.selectionVersion
    return this.selection.has(id)
  }

  selectedIds(): number[] {
    void this.selectionVersion
    return this.selection.ids()
  }

  selectedCount(): number {
    void this.selectionVersion
    return this.selection.size
  }

  clickRow(index: number, modifiers: { shift?: boolean; ctrl?: boolean }): void {
    const ordered = this.tracks.map((t) => t.id)
    const intent = modifiers.shift ? 'range' : modifiers.ctrl ? 'toggle' : 'replace'
    this.selection.apply(ordered, index, intent)
    this.selectionVersion++
  }

  selectAll(): void {
    this.selection.selectAll(this.tracks.map((t) => t.id))
    this.selectionVersion++
  }

  clearSelection(): void {
    this.selection.clear()
    this.selectionVersion++
  }

  async refresh(): Promise<void> {
    try {
      this.error = null
      this.stats = await ipc('library:stats')

      const req = { filter: this.filter(), sort: [...this.sort.list()], limit: { count: PAGE } }
      this.tracks = await ipc('library:query', req)
      this.lastSql = (await ipc('library:explain', req)).sql

      // A narrowed result set must not leave selections pointing at rows nobody can see.
      this.selection.retain(this.tracks.map((t) => t.id))
      this.selectionVersion++
      this.version++
    } catch (err) {
      this.error = (err as Error).message
    }
  }

  async groupsFor(fieldId: string): Promise<GroupRow[]> {
    try {
      return await ipc('library:groupBy', { filter: this.filter(), field: fieldId })
    } catch (err) {
      this.error = (err as Error).message
      return []
    }
  }

  /** A filter pane selection narrows the query; deselecting removes just that chip. */
  async setPaneFilter(fieldId: string, value: string | null): Promise<void> {
    const id = `pane:${fieldId}`

    if (value === null) {
      this.stack.remove(id)
      this.paneValues.delete(fieldId)
    } else {
      this.paneValues.set(fieldId, value)
      const d = field(fieldId)
      const node = d.storage === 'multi'
        ? leaf(fieldId, 'any', [value])
        : leaf(fieldId, 'is', d.type === 'integer' ? Number(value) : value)
      this.stack.push({ id, label: `${d.name}: ${value}`, node, removable: true })
    }

    await this.refresh()
  }

  async setSearch(text: string): Promise<void> {
    this.search = text
    const id = 'search'

    if (text.trim() === '') this.stack.remove(id)
    else {
      this.stack.push({
        id,
        label: `"${text}"`,
        node: leaf('title', 'contains', text.trim()),
        removable: true
      })
    }

    await this.refresh()
  }

  async removeChip(id: string): Promise<void> {
    this.stack.remove(id)
    if (id.startsWith('pane:')) this.paneValues.delete(id.slice('pane:'.length))
    if (id === 'search') this.search = ''
    await this.refresh()
  }

  async toggleSort(fieldId: string, additive: boolean): Promise<void> {
    this.sort.toggle(fieldId, additive)
    await this.refresh()
  }

  sortPriority(fieldId: string): number {
    void this.version
    return this.sort.priority(fieldId)
  }

  sortDir(fieldId: string): 'asc' | 'desc' | null {
    void this.version
    return this.sort.list().find((k) => k.field === fieldId)?.dir ?? null
  }
}

export const library = new LibraryStore()
