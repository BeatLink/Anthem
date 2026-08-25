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
}

export type Channel = keyof AnthemApi
export type ApiArgs<C extends Channel> = Parameters<AnthemApi[C]>
export type ApiResult<C extends Channel> = ReturnType<AnthemApi[C]>

export const CHANNELS: readonly Channel[] = [
  'app:info', 'library:stats', 'library:query', 'library:groupBy',
  'library:explain', 'fields:list', 'theme:list'
]
