// Imports a parsed gmbrc into Anthem's entity model.
//
// gmusicbrowser has one row per file; Anthem has a track plus its media. The import creates one
// track and one file-media per gmusicbrowser song, which is correct but conservative: it does not
// try to merge two files that are the same recording. Deduplication is a separate, reviewable
// operation, and silently merging someone's library on import would be the wrong default.

import { join } from 'node:path'
import { field } from '@shared/fields'
import type { GmbrcData, GmbSong } from './gmbrc'

type Statement = {
  run: (...args: never[]) => unknown
  get: (...args: never[]) => unknown
  all: (...args: never[]) => unknown[]
}

type Db = {
  prepare: (sql: string) => Statement
  exec: (sql: string) => unknown
}

export interface ImportOptions {
  /** Import ratings, play counts and history. */
  statistics?: boolean
  /** Import genre, grouping and label as multi-value fields. */
  labels?: boolean
  /** Import SavedLists as static playlists. */
  playlists?: boolean
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

const FIELD_IDS = {
  artist: field('artist').fieldId!,
  albumArtist: field('album_artist').fieldId!,
  genre: field('genre').fieldId!,
  grouping: field('grouping').fieldId!,
  tags: field('tags').fieldId!,
  comment: field('comment').fieldId!
}

/** Unit separator, so an album name containing the artist name cannot forge a match key. */
const KEY_SEP = ''

/** gmusicbrowser timestamps are unix seconds; Anthem stores milliseconds. */
const toMs = (secs: number | undefined): number | null =>
  secs === undefined || secs <= 0 ? null : secs * 1000

const norm = (s: string): string => s.trim().toLocaleLowerCase().replace(/\s+/g, ' ')

const albumMatchKey = (song: GmbSong): string | null => {
  if (!song.album) return null
  const artist = song.albumArtist ?? song.artist ?? ''
  return [norm(artist), norm(song.album), song.year ?? ''].join(KEY_SEP)
}

export function importGmbrc(db: Db, data: GmbrcData, opts: ImportOptions = {}): ImportReport {
  const withStats = opts.statistics ?? true
  const withLabels = opts.labels ?? true
  const withPlaylists = opts.playlists ?? true

  const report: ImportReport = {
    songsRead: data.songs.length,
    tracksCreated: 0,
    mediaCreated: 0,
    missingFlagged: 0,
    playHistoryRows: 0,
    playlistsCreated: 0,
    savedFiltersFound: data.savedFilters.length,
    unmappedColumns: data.unmappedColumns,
    notes: []
  }

  const now = Date.now()

  const insertAlbum = db.prepare(
    'INSERT OR IGNORE INTO albums (match_key, name, year, added) VALUES (?, ?, ?, ?)')
  const selectAlbum = db.prepare('SELECT id FROM albums WHERE match_key = ?')
  const insertTrack = db.prepare(`
    INSERT INTO tracks (title, album_id, year, track_number, disc_number, length_ms, compilation,
                        rating, play_count, skip_count, last_played, last_skipped,
                        rg_track_gain, rg_album_gain, identity_source, added, modified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'heuristic', ?, ?)`)
  const insertMedia = db.prepare(`
    INSERT OR IGNORE INTO media (track_id, kind, uri, codec, bitrate, samplerate, channels,
                                 filesize, mtime, present, added)
    VALUES (?, 'file', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insertValue = db.prepare('INSERT OR IGNORE INTO values_ (field_id, value) VALUES (?, ?)')
  const selectValue = db.prepare('SELECT id FROM values_ WHERE field_id = ? AND value = ?')
  const insertTv = db.prepare(
    'INSERT OR IGNORE INTO track_values (track_id, field_id, value_id, ordinal) VALUES (?, ?, ?, ?)')
  const insertExtra = db.prepare(
    'INSERT OR IGNORE INTO track_extras (track_id, field_id, value) VALUES (?, ?, ?)')
  const insertHistory = db.prepare(
    'INSERT INTO play_history (track_id, at, kind) VALUES (?, ?, ?)')
  const insertPlaylist = db.prepare(
    "INSERT INTO playlists (name, kind, created, modified) VALUES (?, 'static', ?, ?)")
  const insertPlaylistTrack = db.prepare(
    'INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)')
  const lastId = db.prepare('SELECT last_insert_rowid() AS id')

  const rowId = (): number => (lastId.get() as { id: number }).id

  const valueCache = new Map<string, number>()
  const internValue = (fieldId: number, value: string): number => {
    const key = `${fieldId}${KEY_SEP}${value}`
    const cached = valueCache.get(key)
    if (cached !== undefined) return cached

    insertValue.run(fieldId as never, value as never)
    const id = (selectValue.get(fieldId as never, value as never) as { id: number }).id
    valueCache.set(key, id)
    return id
  }

  const addSet = (trackId: number, fieldId: number, values: readonly string[]): void => {
    values.forEach((v, ordinal) => {
      insertTv.run(
        trackId as never, fieldId as never, internValue(fieldId, v) as never, ordinal as never)
    })
  }

  /** gmusicbrowser song id to Anthem track id, so SavedLists can be resolved afterwards. */
  const trackByGmbId = new Map<number, number>()

  db.exec('BEGIN')
  try {
    for (const song of data.songs) {
      let albumId: number | null = null
      const key = albumMatchKey(song)
      if (key !== null) {
        insertAlbum.run(key as never, song.album as never, (song.year ?? null) as never, now as never)
        albumId = (selectAlbum.get(key as never) as { id: number }).id
      }

      insertTrack.run(
        (song.title ?? null) as never,
        albumId as never,
        (song.year ?? null) as never,
        (song.track ?? null) as never,
        (song.disc ?? null) as never,
        (song.length !== undefined ? song.length * 1000 : null) as never,
        (song.compilation ? 1 : 0) as never,
        (withStats ? song.rating ?? null : null) as never,
        (withStats ? song.playCount ?? 0 : 0) as never,
        (withStats ? song.skipCount ?? 0 : 0) as never,
        (withStats ? toMs(song.lastPlay) : null) as never,
        (withStats ? toMs(song.lastSkip) : null) as never,
        (song.rgTrackGain ?? null) as never,
        (song.rgAlbumGain ?? null) as never,
        (toMs(song.added) ?? now) as never,
        now as never
      )

      const trackId = rowId()
      report.tracksCreated++
      trackByGmbId.set(song.gmbId, trackId)

      if (song.path && song.file) {
        insertMedia.run(
          trackId as never,
          join(song.path, song.file) as never,
          (song.filetype?.split(/\s+/)[0] ?? null) as never,
          (song.bitrate ?? null) as never,
          (song.sampleRate ?? null) as never,
          (song.channels ?? null) as never,
          (song.size ?? null) as never,
          toMs(song.modif) as never,
          (song.missing ? 0 : 1) as never,
          now as never
        )
        report.mediaCreated++
        if (song.missing) report.missingFlagged++
      }

      if (song.artist) addSet(trackId, FIELD_IDS.artist, [song.artist])
      if (song.albumArtist) addSet(trackId, FIELD_IDS.albumArtist, [song.albumArtist])

      if (withLabels) {
        addSet(trackId, FIELD_IDS.genre, song.genre)
        addSet(trackId, FIELD_IDS.grouping, song.grouping)
        addSet(trackId, FIELD_IDS.tags, song.label)
      }

      if (song.comment) {
        insertExtra.run(trackId as never, FIELD_IDS.comment as never, song.comment as never)
      }

      if (withStats) {
        for (const at of song.playHistory) {
          insertHistory.run(trackId as never, (at * 1000) as never, 0 as never)
          report.playHistoryRows++
        }
      }
    }

    if (withPlaylists) {
      for (const list of data.savedLists) {
        insertPlaylist.run(list.name as never, now as never, now as never)
        const playlistId = rowId()
        let position = 0
        for (const gmbId of list.gmbIds) {
          const trackId = trackByGmbId.get(gmbId)
          if (trackId !== undefined) {
            insertPlaylistTrack.run(playlistId as never, trackId as never, position++ as never)
          }
        }
        report.playlistsCreated++
      }
    }

    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  if (data.savedFilters.length > 0) {
    report.notes.push(
      `${data.savedFilters.length} saved filters found but not translated. gmusicbrowser filter ` +
      'strings map onto the Anthem filter AST, which is a separate import step (DESIGN-SPEC 9.3).'
    )
  }
  if (report.missingFlagged > 0) {
    report.notes.push(
      `${report.missingFlagged} files were flagged missing by gmusicbrowser. Their tracks were ` +
      'imported with the media marked not present, so ratings and history are preserved.'
    )
  }
  if (data.unmappedColumns.length > 0) {
    report.notes.push(`Unmapped gmbrc columns ignored: ${data.unmappedColumns.join(', ')}`)
  }

  return report
}
