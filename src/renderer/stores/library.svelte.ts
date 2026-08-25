// View-model state for the library. Svelte 5 runes keep the reactive graph explicit, which matters
// on a virtualized list where an accidental dependency costs frames.

import type { FilterNode, SortKey } from '@shared/filter'
import type { GroupRow, LibraryStats, TrackRow } from '@shared/ipc'
import { and } from '@shared/filter'

class LibraryStore {
  stats = $state<LibraryStats | null>(null)
  tracks = $state<TrackRow[]>([])
  groups = $state<GroupRow[]>([])
  groupField = $state('genre')
  filter = $state<FilterNode>(and())
  sort = $state<SortKey[]>([{ field: 'album' }, { field: 'track_number' }])
  lastSql = $state<string>('')
  error = $state<string | null>(null)

  async refresh(): Promise<void> {
    try {
      this.error = null
      this.stats = await window.anthem['library:stats']()

      const req = { filter: this.filter, sort: this.sort, limit: { count: 500 } }
      this.tracks = await window.anthem['library:query'](req)
      this.groups = await window.anthem['library:groupBy']({
        filter: this.filter,
        field: this.groupField
      })
      this.lastSql = (await window.anthem['library:explain'](req)).sql
    } catch (err) {
      this.error = (err as Error).message
    }
  }
}

export const library = new LibraryStore()
