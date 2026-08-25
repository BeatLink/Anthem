import { ipcMain, app, dialog } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'

import { BUILTIN_FIELDS } from '@shared/fields'
import type { AnthemApi, Channel, GroupRow, TrackRow } from '@shared/ipc'
import { compileFilter, compileGroupBy } from './query/compile'
import { stats, type DB } from './db'
import { safetyStatus } from './safety'
import { defaultGmbrcPath, parseGmbrc } from './import/gmbrc'
import { importGmbrc } from './import/gmb-import'

// Album lives on the albums table and artist in track_values, so the row projection has to
// resolve both rather than reading columns that no longer exist on tracks.
const TRACK_COLUMNS = `
  t.id, t.title, t.year, t.track_number, t.length_ms, t.rating, t.play_count,
  (SELECT a.name FROM albums a WHERE a.id = t.album_id) AS album,
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

    'theme:list': () => ['halon-light', 'halon-dark'],

    'app:safety': () => safetyStatus(),

    'import:gmbDefaultPath': () => defaultGmbrcPath(homedir()),

    'import:gmbBrowse': () => {
      const result = dialog.showOpenDialogSync({
        title: 'Select a gmusicbrowser configuration file',
        defaultPath: defaultGmbrcPath(homedir()),
        properties: ['openFile'],
        filters: [{ name: 'gmusicbrowser config', extensions: ['*'] }]
      })
      return result?.[0] ?? null
    },

    // Reads and parses without writing anything, so the user can see what an import would do.
    'import:gmbPreview': (path) => {
      if (!existsSync(path)) {
        return { path, exists: false, songs: 0, savedFilters: 0, savedLists: 0,
                 playHistoryEntries: 0, unmappedColumns: [] }
      }
      try {
        const data = parseGmbrc(readFileSync(path, 'utf8'))
        return {
          path,
          exists: true,
          version: data.version,
          baseFolder: data.baseFolder,
          songs: data.songs.length,
          savedFilters: data.savedFilters.length,
          savedLists: data.savedLists.length,
          playHistoryEntries: data.songs.reduce((n, s) => n + s.playHistory.length, 0),
          unmappedColumns: data.unmappedColumns
        }
      } catch (err) {
        return { path, exists: true, songs: 0, savedFilters: 0, savedLists: 0,
                 playHistoryEntries: 0, unmappedColumns: [], error: (err as Error).message }
      }
    },

    'import:gmbRun': (req) => {
      const data = parseGmbrc(readFileSync(req.path, 'utf8'))
      return importGmbrc(db as never, data, {
        statistics: req.statistics,
        labels: req.labels,
        playlists: req.playlists
      })
    },

    'library:reset': () => {
      db.exec(`DELETE FROM playlist_tracks; DELETE FROM playlists; DELETE FROM play_history;
               DELETE FROM track_values; DELETE FROM track_extras; DELETE FROM media;
               DELETE FROM tracks; DELETE FROM albums; DELETE FROM values_;`)
      return { cleared: true }
    }
  }

  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (_event, ...args) => (handler as (...a: unknown[]) => unknown)(...args))
  }
}
