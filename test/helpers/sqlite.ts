// Tests reach SQLite through node:sqlite rather than better-sqlite3, so the suite never depends on
// which ABI the native module was last rebuilt for. The SQL under test is identical either way.

import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { field } from '@shared/fields'
import type { Corpus } from './corpus'

export type TestDb = InstanceType<typeof DatabaseSync>

const MIGRATIONS = [
  'src/main/db/migrations/001-initial.sql',
  'src/main/db/migrations/002-history-unique.sql',
  'src/main/db/migrations/003-merge-journal.sql',
  'src/main/db/migrations/004-artwork.sql'
].map((p) => join(process.cwd(), p))

export function freshDb(): TestDb {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  for (const m of MIGRATIONS) db.exec(readFileSync(m, 'utf8'))

  db.function('REGEXP', (pattern: unknown, value: unknown) => {
    if (value === null || value === undefined) return 0
    try { return new RegExp(String(pattern), 'u').test(String(value)) ? 1 : 0 } catch { return 0 }
  })

  return db
}

/** Loads a corpus into a real database so the SQL path can be compared to the native path. */
export function loadCorpus(db: TestDb, corpus: Corpus): void {
  const insertTrack = db.prepare(`
    INSERT INTO tracks (id, title, album_id, year, track_number, disc_number, length_ms,
                        rating, play_count, skip_count, last_played, added, bpm,
                        compilation, modified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insertAlbum = db.prepare('INSERT OR IGNORE INTO albums (match_key, name, added) VALUES (?, ?, 0)')
  const albumId = db.prepare('SELECT id FROM albums WHERE match_key = ?')
  const insertMedia = db.prepare(`
    INSERT INTO media (track_id, kind, uri, codec, bitrate, samplerate, channels,
                       filesize, mtime, quality_rank, added)
    VALUES (?, 'file', ?, ?, ?, ?, ?, ?, ?, ?, 0)`)
  const insertValue = db.prepare('INSERT OR IGNORE INTO values_ (field_id, value) VALUES (?, ?)')
  const valueId = db.prepare('SELECT id FROM values_ WHERE field_id = ? AND value = ?')
  const insertTv = db.prepare(
    'INSERT INTO track_values (track_id, field_id, value_id, ordinal) VALUES (?, ?, ?, ?)')
  const insertExtra = db.prepare(
    'INSERT INTO track_extras (track_id, field_id, value) VALUES (?, ?, ?)')

  db.exec('BEGIN')
  for (const t of corpus.tracks) {
    const s = t.scalars

    let album: number | null = null
    if (t.albumName !== null) {
      insertAlbum.run(t.albumName, t.albumName)
      album = (albumId.get(t.albumName) as { id: number }).id
    }

    insertTrack.run(
      t.id, s.title, album, s.year, s.track_number, s.disc_number, s.length,
      s.rating, s.play_count, s.skip_count, s.last_played, s.added, s.bpm,
      s.compilation, corpus.now
    )

    for (const m of t.media) {
      insertMedia.run(t.id, m.uri, m.codec, m.bitrate, m.samplerate, m.channels,
                      m.filesize, m.mtime, m.quality_rank)
    }

    for (const [fid, values] of Object.entries(t.sets)) {
      values.forEach((v, ordinal) => {
        insertValue.run(Number(fid), v)
        const row = valueId.get(Number(fid), v) as { id: number }
        insertTv.run(t.id, Number(fid), row.id, ordinal)
      })
    }

    for (const [fid, v] of Object.entries(t.extras)) {
      if (v !== null) insertExtra.run(t.id, Number(fid), v)
    }
  }
  db.exec('COMMIT')
}

export function runQuery(db: TestDb, sql: string, params: readonly unknown[]): number[] {
  const rows = db.prepare(sql).all(...(params as never[])) as { id: number }[]
  return rows.map((r) => r.id)
}

/** Column widths and field ids must stay stable; a reused field id silently corrupts a library. */
export const setFieldId = (id: string): number => field(id).fieldId!
