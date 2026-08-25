import { ipcMain, app } from 'electron'

import { BUILTIN_FIELDS } from '@shared/fields'
import type { AnthemApi, Channel, GroupRow, TrackRow } from '@shared/ipc'
import { compileFilter, compileGroupBy } from './query/compile'
import { stats, type DB } from './db'

const TRACK_COLUMNS = `
  t.id, t.title, t.album, t.year, t.track_number, t.length_ms, t.rating, t.play_count,
  (SELECT vv.value FROM track_values tv JOIN values_ vv ON vv.id = tv.value_id
    WHERE tv.track_id = t.id AND tv.field_id = 1 ORDER BY tv.ordinal LIMIT 1) AS artist`

type Handlers = { [C in Channel]: (...args: Parameters<AnthemApi[C]>) => ReturnType<AnthemApi[C]> }

export function registerIpc(db: DB): void {
  const handlers: Handlers = {
    'app:info': () => ({
      version: app.getVersion(),
      electron: process.versions.electron ?? '',
      chrome: process.versions.chrome ?? '',
      node: process.versions.node,
      platform: process.platform
    }),

    'library:stats': () => stats(db),

    'library:query': (req) => {
      const { sql, params } = compileFilter(req.filter, {
        sort: req.sort,
        limit: req.limit,
        select: TRACK_COLUMNS
      })
      const paged = req.offset ? `${sql} OFFSET ${Number(req.offset)}` : sql
      return db.prepare(paged).all(...(params as never[])) as TrackRow[]
    },

    'library:groupBy': (req) => {
      const { sql, params } = compileGroupBy(req.filter, req.field)
      return db.prepare(sql).all(...(params as never[])) as GroupRow[]
    },

    'library:explain': (req) =>
      compileFilter(req.filter, { sort: req.sort, limit: req.limit }),

    'fields:list': () => [...BUILTIN_FIELDS],

    'theme:list': () => ['halon-light', 'halon-dark']
  }

  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (_event, ...args) => (handler as (...a: unknown[]) => unknown)(...args))
  }
}
