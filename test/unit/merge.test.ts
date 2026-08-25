// Merging deletes rows holding ratings and play history that cannot be rebuilt from the files, so
// the round-trip through unmerge is the test that matters most here.

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mergePreview, mergeTracks, unmerge } from '@main/library/merge'
import { field } from '@shared/fields'
import { freshDb, type TestDb } from '../helpers/sqlite'

let db: TestDb

const lastId = (): number =>
  (db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id

interface Spec {
  title?: string | null
  year?: number | null
  rating?: number | null
  playCount?: number
  skipCount?: number
  lastPlayed?: number | null
  album?: string | null
  genres?: string[]
  artist?: string
  comment?: string
}

function makeTrack(s: Spec = {}): number {
  let albumId: number | null = null
  if (s.album) {
    db.prepare('INSERT OR IGNORE INTO albums (match_key, name, added) VALUES (?, ?, 0)')
      .run(s.album, s.album)
    albumId = (db.prepare('SELECT id FROM albums WHERE match_key = ?').get(s.album) as { id: number }).id
  }

  db.prepare(`INSERT INTO tracks (title, album_id, year, rating, play_count, skip_count,
                                  last_played, added, modified)
              VALUES (?, ?, ?, ?, ?, ?, ?, 1000, 0)`)
    .run(s.title ?? 'Song', albumId, s.year ?? null, s.rating ?? null,
         s.playCount ?? 0, s.skipCount ?? 0, s.lastPlayed ?? null)
  const id = lastId()

  const addValue = (fieldId: string, value: string, ordinal: number): void => {
    const fid = field(fieldId).fieldId!
    db.prepare('INSERT OR IGNORE INTO values_ (field_id, value) VALUES (?, ?)').run(fid, value)
    const vid = (db.prepare('SELECT id FROM values_ WHERE field_id = ? AND value = ?')
      .get(fid, value) as { id: number }).id
    db.prepare('INSERT INTO track_values (track_id, field_id, value_id, ordinal) VALUES (?, ?, ?, ?)')
      .run(id, fid, vid, ordinal)
  }

  if (s.artist) addValue('artist', s.artist, 0)
  ;(s.genres ?? []).forEach((g, i) => addValue('genre', g, i))

  if (s.comment) {
    db.prepare('INSERT INTO track_extras (track_id, field_id, value) VALUES (?, ?, ?)')
      .run(id, field('comment').fieldId!, s.comment)
  }

  return id
}

const addMedia = (trackId: number, uri: string, codec = 'flac'): number => {
  db.prepare(`INSERT INTO media (track_id, kind, uri, codec, present, added)
              VALUES (?, 'file', ?, ?, 1, 0)`).run(trackId, uri, codec)
  return lastId()
}

const addHistory = (trackId: number, at: number): void => {
  db.prepare('INSERT OR IGNORE INTO play_history (track_id, at, kind) VALUES (?, ?, 0)')
    .run(trackId, at)
}

const one = <T>(sql: string, ...args: unknown[]): T =>
  db.prepare(sql).get(...(args as never[])) as T

const count = (sql: string, ...args: unknown[]): number =>
  (one<{ n: number }>(sql, ...args)).n

beforeEach(() => { db = freshDb() })
afterEach(() => db.close())

describe('merge preview', () => {
  it('marks agreeing fields as settled and disagreeing ones as conflicts', () => {
    const a = makeTrack({ title: 'So What', year: 1959, artist: 'Miles Davis' })
    const b = makeTrack({ title: 'So What', year: 1997, artist: 'Miles Davis' })

    const p = mergePreview(db as never, [a, b])
    const title = p.fields.find((f) => f.field === 'title')!
    const year = p.fields.find((f) => f.field === 'year')!

    expect(title.conflict).toBe(false)
    expect(title.value).toBe('So What')
    expect(year.conflict).toBe(true)
    expect(year.options!.map((o) => o.value).sort()).toEqual([1959, 1997])
  })

  it('offers the union of multi-value fields', () => {
    const a = makeTrack({ genres: ['Jazz'] })
    const b = makeTrack({ genres: ['Jazz', 'Modal'] })

    const genre = mergePreview(db as never, [a, b]).fields.find((f) => f.field === 'genre')!
    expect(genre.multi).toBe(true)
    expect(genre.union!.sort()).toEqual(['Jazz', 'Modal'])
  })

  it('proposes the richest source as the survivor', () => {
    const thin = makeTrack({ playCount: 1 })
    const rich = makeTrack({ playCount: 50 })
    addMedia(rich, '/a.flac')
    addMedia(rich, '/a.mp3', 'mp3')
    addMedia(thin, '/b.flac')

    expect(mergePreview(db as never, [thin, rich]).survivor).toBe(rich)
  })

  it('sums counts and takes the highest rating', () => {
    const a = makeTrack({ rating: 80, playCount: 10, skipCount: 1 })
    const b = makeTrack({ rating: null, playCount: 5, skipCount: 2 })

    const stats = mergePreview(db as never, [a, b]).statistics
    expect(stats).toMatchObject({ playCount: 15, skipCount: 3, rating: 80 })
  })

  it('flags pinned sources, since merging overrides a human decision', () => {
    const a = makeTrack()
    const b = makeTrack()
    db.prepare('UPDATE tracks SET pinned = 1 WHERE id = ?').run(b)
    expect(mergePreview(db as never, [a, b]).pinnedSources).toEqual([b])
  })

  it('refuses fewer than two tracks', () => {
    expect(() => mergePreview(db as never, [makeTrack()])).toThrow(/at least two/)
  })
})

describe('merging', () => {
  it('moves every media source onto the survivor', () => {
    const a = makeTrack()
    const b = makeTrack()
    addMedia(a, '/a.flac')
    addMedia(b, '/b.mp3', 'mp3')

    const r = mergeTracks(db as never, { ids: [a, b], survivor: a })

    expect(r.mediaMoved).toBe(1)
    expect(count('SELECT COUNT(*) AS n FROM media WHERE track_id = ?', a)).toBe(2)
    expect(count('SELECT COUNT(*) AS n FROM tracks')).toBe(1)
  })

  it('applies per-field resolutions', () => {
    const a = makeTrack({ title: 'so what', year: 1997 })
    const b = makeTrack({ title: 'So What', year: 1959 })

    mergeTracks(db as never, {
      ids: [a, b], survivor: a,
      resolutions: { title: { kind: 'value', from: b }, year: { kind: 'value', from: b } }
    })

    const t = one<{ title: string; year: number }>('SELECT title, year FROM tracks WHERE id = ?', a)
    expect(t).toEqual({ title: 'So What', year: 1959 })
  })

  it('unions multi-value fields by default', () => {
    const a = makeTrack({ genres: ['Jazz'] })
    const b = makeTrack({ genres: ['Modal', 'Cool'] })

    mergeTracks(db as never, { ids: [a, b], survivor: a })

    const genres = db.prepare(
      `SELECT vv.value FROM track_values tv JOIN values_ vv ON vv.id = tv.value_id
       WHERE tv.track_id = ? AND tv.field_id = ? ORDER BY vv.value`
    ).all(a, field('genre').fieldId!) as { value: string }[]
    expect(genres.map((g) => g.value)).toEqual(['Cool', 'Jazz', 'Modal'])
  })

  it('can take one source\'s set instead of the union', () => {
    const a = makeTrack({ genres: ['Jazz'] })
    const b = makeTrack({ genres: ['Modal'] })

    mergeTracks(db as never, {
      ids: [a, b], survivor: a, resolutions: { genre: { kind: 'value', from: b } }
    })

    const genres = db.prepare(
      `SELECT vv.value FROM track_values tv JOIN values_ vv ON vv.id = tv.value_id
       WHERE tv.track_id = ? AND tv.field_id = ?`
    ).all(a, field('genre').fieldId!) as { value: string }[]
    expect(genres.map((g) => g.value)).toEqual(['Modal'])
  })

  it('sums play counts and keeps the highest rating', () => {
    const a = makeTrack({ rating: 40, playCount: 3 })
    const b = makeTrack({ rating: 100, playCount: 9 })

    mergeTracks(db as never, { ids: [a, b], survivor: a })

    expect(one<{ rating: number; play_count: number }>(
      'SELECT rating, play_count FROM tracks WHERE id = ?', a))
      .toEqual({ rating: 100, play_count: 12 })
  })

  it('unions play history and drops exact duplicates', () => {
    const a = makeTrack()
    const b = makeTrack()
    addHistory(a, 1000); addHistory(a, 2000)
    addHistory(b, 2000); addHistory(b, 3000)

    mergeTracks(db as never, { ids: [a, b], survivor: a })

    const at = db.prepare('SELECT at FROM play_history WHERE track_id = ? ORDER BY at')
      .all(a) as { at: number }[]
    expect(at.map((r) => r.at)).toEqual([1000, 2000, 3000])
  })

  it('repoints playlist entries without listing the survivor twice', () => {
    const a = makeTrack()
    const b = makeTrack()
    db.prepare("INSERT INTO playlists (name, kind, created, modified) VALUES ('p', 'static', 0, 0)").run()
    const pl = lastId()
    db.prepare('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, 0)').run(pl, a)
    db.prepare('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, 1)').run(pl, b)

    mergeTracks(db as never, { ids: [a, b], survivor: a })

    expect(count('SELECT COUNT(*) AS n FROM playlist_tracks WHERE playlist_id = ?', pl)).toBe(1)
  })

  it('pins the survivor so an automated pass cannot re-split it', () => {
    const a = makeTrack()
    const b = makeTrack()
    mergeTracks(db as never, { ids: [a, b], survivor: a })

    const t = one<{ pinned: number; identity_source: string }>(
      'SELECT pinned, identity_source FROM tracks WHERE id = ?', a)
    expect(t).toEqual({ pinned: 1, identity_source: 'manual' })
  })

  it('refuses a survivor that is not part of the merge', () => {
    const a = makeTrack()
    const b = makeTrack()
    expect(() => mergeTracks(db as never, { ids: [a, b], survivor: 9999 })).toThrow(/survivor/)
  })
})

describe('unmerge', () => {
  it('restores tracks, media, statistics and history exactly', () => {
    const a = makeTrack({ title: 'A', rating: 40, playCount: 3, genres: ['Jazz'], comment: 'first' })
    const b = makeTrack({ title: 'B', rating: 100, playCount: 9, genres: ['Modal'] })
    const ma = addMedia(a, '/a.flac')
    const mb = addMedia(b, '/b.mp3', 'mp3')
    addHistory(a, 1000)
    addHistory(b, 2000)

    const snapshot = {
      tracks: db.prepare('SELECT id, title, rating, play_count FROM tracks ORDER BY id').all(),
      media: db.prepare('SELECT id, track_id FROM media ORDER BY id').all(),
      history: db.prepare('SELECT track_id, at FROM play_history ORDER BY track_id, at').all(),
      values: db.prepare('SELECT track_id, field_id, value_id FROM track_values ORDER BY track_id, field_id').all(),
      extras: db.prepare('SELECT track_id, field_id, value FROM track_extras ORDER BY track_id').all()
    }

    const result = mergeTracks(db as never, { ids: [a, b], survivor: a })
    expect(count('SELECT COUNT(*) AS n FROM tracks')).toBe(1)

    const undone = unmerge(db as never, result.batchId)
    expect(undone.restored).toEqual([b])

    expect(db.prepare('SELECT id, title, rating, play_count FROM tracks ORDER BY id').all())
      .toEqual(snapshot.tracks)
    expect(db.prepare('SELECT id, track_id FROM media ORDER BY id').all()).toEqual(snapshot.media)
    expect(db.prepare('SELECT track_id, at FROM play_history ORDER BY track_id, at').all())
      .toEqual(snapshot.history)
    expect(db.prepare('SELECT track_id, field_id, value_id FROM track_values ORDER BY track_id, field_id').all())
      .toEqual(snapshot.values)
    expect(db.prepare('SELECT track_id, field_id, value FROM track_extras ORDER BY track_id').all())
      .toEqual(snapshot.extras)

    expect(ma).toBeGreaterThan(0)
    expect(mb).toBeGreaterThan(0)
  })

  it('restores history that was dropped as a duplicate', () => {
    const a = makeTrack()
    const b = makeTrack()
    addHistory(a, 5000)
    addHistory(b, 5000)

    const r = mergeTracks(db as never, { ids: [a, b], survivor: a })
    expect(count('SELECT COUNT(*) AS n FROM play_history')).toBe(1)

    unmerge(db as never, r.batchId)
    expect(count('SELECT COUNT(*) AS n FROM play_history')).toBe(2)
  })

  it('restores playlist membership', () => {
    const a = makeTrack()
    const b = makeTrack()
    db.prepare("INSERT INTO playlists (name, kind, created, modified) VALUES ('p', 'static', 0, 0)").run()
    const pl = lastId()
    db.prepare('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, 0)').run(pl, a)
    db.prepare('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, 1)').run(pl, b)

    const r = mergeTracks(db as never, { ids: [a, b], survivor: a })
    unmerge(db as never, r.batchId)

    expect(db.prepare('SELECT track_id, position FROM playlist_tracks ORDER BY position').all())
      .toEqual([{ track_id: a, position: 0 }, { track_id: b, position: 1 }])
  })

  it('refuses to undo the same merge twice', () => {
    const a = makeTrack()
    const b = makeTrack()
    const r = mergeTracks(db as never, { ids: [a, b], survivor: a })
    unmerge(db as never, r.batchId)
    expect(() => unmerge(db as never, r.batchId)).toThrow(/already been undone/)
  })

  it('rejects an unknown batch', () => {
    expect(() => unmerge(db as never, 'nope')).toThrow(/no merge recorded/)
  })
})
