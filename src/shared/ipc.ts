// The IPC contract. Both the main process and the renderer import this module, so the boundary is
// type-checked end to end with no codegen step.

import type { FilterNode, SortKey, Limit } from './filter'
import type { FieldDescriptor } from './fields'

export interface LibraryStats {
  tracks: number
  media: number
  albums: number
  missing: number
  totalMs: number
  schemaVersion: number
  path: string
}

export interface TrackRow {
  id: number
  title: string | null
  artist: string | null
  album: string | null
  year: number | null
  track_number: number | null
  length_ms: number | null
  rating: number | null
  play_count: number
}

export interface GroupRow {
  gid: number | string | null
  label: string | null
  n: number
  total_ms: number
}

export interface QueryRequest {
  filter: FilterNode
  sort?: readonly SortKey[]
  limit?: Limit
  offset?: number
}

export interface SafetyStatus {
  readOnly: boolean
  pinned: boolean
  reason: string
}

export interface GmbPreview {
  path: string
  exists: boolean
  version?: string
  baseFolder?: string
  songs: number
  savedFilters: number
  savedLists: number
  playHistoryEntries: number
  unmappedColumns: string[]
  error?: string
}

export interface ImportReport {
  songsRead: number
  tracksCreated: number
  mediaCreated: number
  missingFlagged: number
  playHistoryRows: number
  playlistsCreated: number
  savedFiltersFound: number
  unmappedColumns: string[]
  notes: string[]
}

export interface Root {
  id: number
  path: string
  enabled: boolean
  slow: boolean
  lastScan: number | null
}

export interface ScanProgress {
  phase: 'walking' | 'reading' | 'finishing'
  found: number
  processed: number
  currentPath?: string
}

export interface ScanReport {
  filesFound: number
  filesRead: number
  filesSkipped: number
  tracksCreated: number
  tracksMatched: number
  movesDetected: number
  markedMissing: number
  errors: { path: string; message: string }[]
  durationMs: number
}

export interface AppInfo {
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
}

/** Every channel the renderer may invoke, with its argument and result types. */
export interface AnthemApi {
  'app:info': () => AppInfo
  'library:stats': () => LibraryStats
  'library:query': (req: QueryRequest) => TrackRow[]
  'library:groupBy': (req: { filter: FilterNode; field: string }) => GroupRow[]
  'library:explain': (req: QueryRequest) => { sql: string; params: unknown[] }
  'fields:list': () => FieldDescriptor[]
  'theme:list': () => string[]
  'app:safety': () => SafetyStatus
  'import:gmbDefaultPath': () => string
  'import:gmbBrowse': () => string | null
  'import:gmbPreview': (path: string) => GmbPreview
  'import:gmbRun': (req: { path: string; statistics?: boolean; labels?: boolean; playlists?: boolean }) => ImportReport
  'library:reset': () => { cleared: boolean }
  'library:roots': () => Root[]
  'library:addRoot': () => Root | null
  'library:removeRoot': (id: number) => { removed: boolean }
  'library:scan': () => ScanReport
  'library:scanCancel': () => { cancelled: boolean }
}

/** Pushed from the main process; the renderer subscribes rather than polling. */
export interface AnthemEvents {
  'scan:progress': ScanProgress
  'scan:done': ScanReport
}

export type EventName = keyof AnthemEvents
export const EVENT_CHANNEL = 'anthem:event'

export type Channel = keyof AnthemApi
export type ApiArgs<C extends Channel> = Parameters<AnthemApi[C]>
export type ApiResult<C extends Channel> = ReturnType<AnthemApi[C]>

export const CHANNELS: readonly Channel[] = [
  'app:info', 'app:safety', 'library:stats', 'library:query', 'library:groupBy',
  'library:explain', 'library:reset', 'fields:list', 'theme:list',
  'import:gmbDefaultPath', 'import:gmbBrowse', 'import:gmbPreview', 'import:gmbRun',
  'library:roots', 'library:addRoot', 'library:removeRoot', 'library:scan', 'library:scanCancel'
]
