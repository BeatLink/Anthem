// Playback decisions — what plays next, when a play counts, which file gets used — are tested
// against a fake engine, so none of this depends on an audio backend being present.

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { NullEngine } from '@main/play/engine'
import { Player, countsAsPlay, shuffleOrder } from '@main/play/player'
import { freshDb, type TestDb } from '../helpers/sqlite'

let db: TestDb
let engine: NullEngine
let player: Player

const lastId = (): number =>
  (db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id

function makeTrack(o: {
  title?: string; lengthMs?: number | null; files?: { uri: string; present?: boolean; rank?: number }[]
  trackGain?: number | null
} = {}): number {
  db.prepare(`INSERT INTO tracks (title, length_ms, rg_track_gain, added, modified)
              VALUES (?, ?, ?, 0, 0)`)
    .run(o.title ?? 'Song', o.lengthMs === undefined ? 200_000 : o.lengthMs, o.trackGain ?? null)
  const id = lastId()

  for (const f of o.files ?? [{ uri: `/music/${id}.flac` }]) {
    db.prepare(`INSERT INTO media (track_id, kind, uri, present, quality_rank, added)
                VALUES (?, 'file', ?, ?, ?, 0)`)
      .run(id, f.uri, f.present === false ? 0 : 1, f.rank ?? 0)
  }
  return id
}

const stat = (id: number): { play_count: number; skip_count: number; last_played: number | null } =>
  db.prepare('SELECT play_count, skip_count, last_played FROM tracks WHERE id = ?')
    .get(id) as never

beforeEach(() => {
  db = freshDb()
  engine = new NullEngine()
  player = new Player(db as never, engine)
})

afterEach(async () => {
  await player.dispose()
  db.close()
})

describe('play thresholds', () => {
  it('counts a play at half the track', () => {
    expect(countsAsPlay(99_000, 200_000)).toBe(false)
    expect(countsAsPlay(100_000, 200_000)).toBe(true)
  })

  it('counts a play after four minutes regardless of length', () => {
    expect(countsAsPlay(240_000, 3_600_000)).toBe(true)
  })

  it('cannot count a play when the duration is unknown and little was heard', () => {
    expect(countsAsPlay(1000, null)).toBe(false)
  })
})

describe('playing a track', () => {
  it('loads the track\'s file and starts', async () => {
    const id = makeTrack({ title: 'So What' })
    await player.playTrack(id)

    expect(engine.loaded).toEqual([`/music/${id}.flac`])
    expect(player.status().state).toBe('playing')
    expect(player.status().track?.title).toBe('So What')
  })

  it('prefers a present file over a missing one, and higher quality over lower', async () => {
    const id = makeTrack({ files: [
      { uri: '/gone.flac', present: false, rank: 10_000 },
      { uri: '/here.mp3', present: true, rank: 100 }
    ]})
    await player.playTrack(id)
    expect(engine.loaded).toEqual(['/here.mp3'])
  })

  it('reports a track with no playable file instead of failing silently', async () => {
    db.prepare("INSERT INTO tracks (title, added, modified) VALUES ('orphan', 0, 0)").run()
    await player.playTrack(lastId())

    const s = player.status()
    expect(s.state).toBe('error')
    expect(s.error).toMatch(/No playable file/)
  })

  it('applies ReplayGain only when asked', async () => {
    const id = makeTrack({ trackGain: -6 })

    const off = new NullEngine()
    const p1 = new Player(db as never, off)
    await p1.playTrack(id)
    expect(p1.status().media?.gainDb).toBeNull()

    const on = new NullEngine()
    const p2 = new Player(db as never, on, { replayGain: 'track', preampDb: 2 })
    await p2.playTrack(id)
    expect(p2.status().media?.gainDb).toBe(-4)

    await p1.dispose(); await p2.dispose()
  })
})

describe('statistics', () => {
  it('counts a play once the threshold is passed, and only once', async () => {
    const id = makeTrack({ lengthMs: 200_000 })
    await player.playTrack(id)

    engine.tick(50_000)
    expect(stat(id).play_count).toBe(0)

    engine.tick(120_000)
    expect(stat(id).play_count).toBe(1)

    engine.tick(180_000)
    expect(stat(id).play_count).toBe(1)
  })

  it('counts a play when the track simply ends', async () => {
    const id = makeTrack({ lengthMs: 200_000 })
    await player.playTrack(id)
    engine.tick(10_000)
    engine.finish()

    await new Promise((r) => setTimeout(r, 0))
    expect(stat(id).play_count).toBe(1)
  })

  it('records a skip when a track is abandoned part way', async () => {
    const a = makeTrack()
    const b = makeTrack()
    await player.playTrack(a)
    engine.tick(20_000)
    await player.next()

    expect(stat(a).skip_count).toBe(1)
    expect(stat(a).play_count).toBe(0)
    expect(b).toBeGreaterThan(0)
  })

  it('does not record a skip for a track that barely started', async () => {
    const a = makeTrack()
    await player.playTrack(a)
    engine.tick(500)
    await player.next()
    expect(stat(a).skip_count).toBe(0)
  })

  it('does not let seeking backwards fake a second play', async () => {
    const id = makeTrack({ lengthMs: 200_000 })
    await player.playTrack(id)
    engine.tick(150_000)
    expect(stat(id).play_count).toBe(1)

    await player.seek(0)
    engine.tick(150_000)
    expect(stat(id).play_count).toBe(1)
  })
})

describe('queue and context', () => {
  it('drains the queue before the standing list', async () => {
    const [a, b, q] = [makeTrack(), makeTrack(), makeTrack()]
    player.setContext([a, b], 0)
    await player.playTrack(a, 0)
    player.enqueue([q])

    expect(player.peekNext()).toBe(q)
    await player.next()
    expect(player.status().track?.id).toBe(q)

    // With the queue drained, playback returns to where the context left off.
    await player.next()
    expect(player.status().track?.id).toBe(b)
  })

  it('queues next ahead of what is already queued', async () => {
    const [a, b, c] = [makeTrack(), makeTrack(), makeTrack()]
    player.enqueue([a, b])
    player.enqueue([c], 'next')
    expect(player.status().queue).toEqual([c, a, b])
  })

  it('stops at the end of the context when repeat is off', async () => {
    const [a, b] = [makeTrack(), makeTrack()]
    player.setContext([a, b], 0)
    await player.playTrack(a, 0)
    await player.next()
    await player.next()
    expect(player.status().state).toBe('idle')
  })

  it('wraps to the start when repeat is all', async () => {
    const [a, b] = [makeTrack(), makeTrack()]
    player.setContext([a, b], 0)
    player.setRepeat('all')
    await player.playTrack(a, 0)
    await player.next()
    await player.next()
    expect(player.status().track?.id).toBe(a)
  })

  it('repeats one track when the track ends, but a manual skip still moves on', async () => {
    const [a, b] = [makeTrack(), makeTrack()]
    player.setContext([a, b], 0)
    player.setRepeat('one')
    await player.playTrack(a, 0)

    engine.finish()
    await new Promise((r) => setTimeout(r, 0))
    expect(player.status().track?.id).toBe(a)

    await player.next(true)
    expect(player.status().track?.id).toBe(b)
  })

  it('previous restarts the track before stepping back', async () => {
    const [a, b] = [makeTrack(), makeTrack()]
    player.setContext([a, b], 0)
    await player.playTrack(b, 1)
    engine.tick(30_000)

    await player.previous()
    expect(player.status().track?.id).toBe(b)
    expect(player.status().positionMs).toBe(0)

    await player.previous()
    expect(player.status().track?.id).toBe(a)
  })

  it('removes a queued track by position', async () => {
    const [a, b, c] = [makeTrack(), makeTrack(), makeTrack()]
    player.enqueue([a, b, c])
    player.dequeue(1)
    expect(player.status().queue).toEqual([a, c])
  })
})

describe('shuffle', () => {
  it('produces a reproducible permutation containing every index', () => {
    const order = shuffleOrder(20, 42)
    expect([...order].sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i))
    expect(shuffleOrder(20, 42)).toEqual(order)
    expect(shuffleOrder(20, 43)).not.toEqual(order)
  })

  it('visits every track in the context exactly once', async () => {
    const ids = [makeTrack(), makeTrack(), makeTrack(), makeTrack(), makeTrack()]
    player.setContext(ids, 0)
    player.setShuffle(true)
    await player.playTrack(ids[0]!, 0)

    const seen = [player.status().track!.id]
    for (let i = 0; i < ids.length - 1; i++) {
      await player.next(false)
      const id = player.status().track?.id
      if (id) seen.push(id)
    }

    expect(new Set(seen).size).toBe(ids.length)
  })
})

describe('engine hand-off', () => {
  it('tells the engine what is coming, for a gapless transition', async () => {
    const [a, b] = [makeTrack(), makeTrack()]
    player.setContext([a, b], 0)
    await player.playTrack(a, 0)
    await new Promise((r) => setTimeout(r, 0))

    expect(engine.preloaded).toContain(`/music/${b}.flac`)
  })

  it('surfaces an engine error in the status', async () => {
    const id = makeTrack()
    await player.playTrack(id)
    engine.fail('decoder exploded')

    expect(player.status().state).toBe('error')
    expect(player.status().error).toBe('decoder exploded')
  })

  it('notifies subscribers when the status changes', async () => {
    const seen: string[] = []
    player.subscribe((e, p) => { if (e === 'status') seen.push((p as { state: string }).state) })

    await player.playTrack(makeTrack())
    expect(seen).toContain('playing')
  })
})
