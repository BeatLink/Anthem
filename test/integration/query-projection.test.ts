// The song list's row projection is SQL written by hand, outside the compiler, so it can drift
// from the schema without any typecheck noticing. This test is what catches that.

import { describe, expect, it } from 'vitest'
import { compileFilter } from '@main/query/compile'
import { and, leaf } from '@shared/filter'
import { makeCorpus, FIXED_NOW } from '../helpers/corpus'
import { freshDb, loadCorpus } from '../helpers/sqlite'

// Kept identical to TRACK_COLUMNS in src/main/ipc.ts.
const TRACK_COLUMNS = `
  t.id, t.title, t.year, t.track_number, t.length_ms, t.rating, t.play_count,
  (SELECT a.name FROM albums a WHERE a.id = t.album_id) AS album,
  (SELECT vv.value FROM track_values tv JOIN values_ vv ON vv.id = tv.value_id
    WHERE tv.track_id = t.id AND tv.field_id = 1 ORDER BY tv.ordinal LIMIT 1) AS artist`

describe('song list row projection', () => {
  it('resolves every displayed column against the real schema', () => {
    const corpus = makeCorpus(50, 9)
    const db = freshDb()
    loadCorpus(db, corpus)

    const { sql, params } = compileFilter(and(), {
      now: FIXED_NOW,
      select: TRACK_COLUMNS,
      sort: [{ field: 'album' }, { field: 'track_number' }],
      limit: { count: 10 }
    })

    const rows = db.prepare(sql).all(...(params as never[])) as Record<string, unknown>[]
    expect(rows.length).toBeGreaterThan(0)

    for (const key of ['id', 'title', 'album', 'artist', 'year', 'track_number',
                       'length_ms', 'rating', 'play_count']) {
      expect(Object.hasOwn(rows[0]!, key), `projection is missing ${key}`).toBe(true)
    }

    // Album and artist must actually resolve, not come back null for everything.
    expect(rows.some((r) => r.album !== null)).toBe(true)
    expect(rows.some((r) => r.artist !== null)).toBe(true)
    db.close()
  })

  it('still projects correctly under a filter that joins other tables', () => {
    const corpus = makeCorpus(50, 11)
    const db = freshDb()
    loadCorpus(db, corpus)

    const { sql, params } = compileFilter(
      and(leaf('genre', 'any', ['Jazz', 'Rock']), leaf('codec', 'is', 'flac')),
      { now: FIXED_NOW, select: TRACK_COLUMNS }
    )
    expect(() => db.prepare(sql).all(...(params as never[]))).not.toThrow()
    db.close()
  })
})
