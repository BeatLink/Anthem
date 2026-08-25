// Exercises the real mpv backend against the real library, because everything upstream of it is
// already covered by the fake engine and a failure here would be invisible to those tests.

import { describe, expect, it } from 'vitest'
import { existsSync, copyFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { MpvEngine, findMpv } from '@main/play/mpv'
import { Player } from '@main/play/player'

const live = join(homedir(), '.config/anthem/library.db')
const mpv = findMpv() ?? undefined

describe.runIf(existsSync(live) && mpv)('playback against the real library', () => {
  it('loads a real track and the position advances', async () => {
    const copy = join(tmpdir(), 'anthem-play-check.db')
    copyFileSync(live, copy)
    const db = new DatabaseSync(copy)

    const row = db.prepare(`
      SELECT t.id, t.title, m.uri, COUNT(m.id) AS files
      FROM tracks t JOIN media m ON m.track_id = t.id
      WHERE m.present = 1 GROUP BY t.id ORDER BY files DESC LIMIT 1`).get() as
      { id: number; title: string; uri: string; files: number }

    console.log(`  track ${row.id} "${row.title}" — ${row.files} file(s)`)
    console.log(`  uri: ${row.uri}`)
    console.log(`  exists on disk: ${existsSync(row.uri)}`)

    const engine = new MpvEngine({ binary: mpv })
    const player = new Player(db as never, engine, { replayGain: 'track' })

    const states: string[] = []
    player.subscribe((e, p) => {
      if (e === 'status') states.push((p as { state: string }).state)
    })

    await player.setVolume(0)
    await player.playTrack(row.id)

    await new Promise((r) => setTimeout(r, 2500))

    const s = player.status()
    console.log(`  state=${s.state} position=${s.positionMs}ms duration=${s.durationMs}ms`)
    console.log(`  states seen: ${[...new Set(states)].join(', ')}`)
    if (s.error) console.log(`  error: ${s.error}`)

    expect(s.error).toBeUndefined()
    expect(s.state).toBe('playing')
    expect(s.positionMs).toBeGreaterThan(0)

    await player.dispose()
    db.close()
  }, 30_000)

  it('starts up without deadlocking, and accepts load options', async () => {
    const engine = new MpvEngine({ binary: mpv })
    const seen: string[] = []
    engine.subscribe((e, p) => {
      if (e === 'state') seen.push((p as { state: string }).state)
    })

    // Start-up used to hang here: the setup commands waited on the promise start-up itself
    // resolves. A timeout rather than a hang is the point of this assertion.
    await engine.setVolume(0)

    const copy = join(tmpdir(), 'anthem-play-check.db')
    const db = new DatabaseSync(copy)
    const uri = (db.prepare('SELECT uri FROM media WHERE present = 1 LIMIT 1').get() as
      { uri: string }).uri

    // Options go in mpv's options slot, not its index slot; the wrong slot is 'invalid parameter'.
    await engine.load(uri, { startMs: 5000, gainDb: -6 })
    await new Promise((r) => setTimeout(r, 800))

    expect(seen).toContain('playing')
    await engine.dispose()
    db.close()
  }, 20_000)
})
