// Playback view state. The decisions all live in the main process; this mirrors status and
// interpolates the position between ticks so the seek bar moves smoothly without a 60 Hz IPC feed.

import type { PlayerStatus, RepeatMode } from '@shared/ipc'
import { ipc } from '../lib/ipc'

class PlayerStore {
  status = $state<PlayerStatus | null>(null)
  /** Interpolated locally between position events. */
  positionMs = $state(0)
  private lastTickAt = 0
  private timer: ReturnType<typeof setInterval> | null = null

  init(): () => void {
    void this.refresh()

    const offStatus = window.anthemEvents.on('player:status', (s) => {
      this.status = s
      this.positionMs = s.positionMs
      this.lastTickAt = performance.now()
    })

    const offPosition = window.anthemEvents.on('player:position', (p) => {
      this.positionMs = p.positionMs
      this.lastTickAt = performance.now()
      if (this.status) this.status = { ...this.status, durationMs: p.durationMs ?? this.status.durationMs }
    })

    // Between ticks, advance the clock locally rather than asking the main process every frame.
    this.timer = setInterval(() => {
      if (this.status?.state !== 'playing') return
      const elapsed = performance.now() - this.lastTickAt
      if (elapsed > 0 && elapsed < 2000) this.positionMs = this.positionMs + elapsed
      this.lastTickAt = performance.now()
    }, 250)

    return () => {
      offStatus()
      offPosition()
      if (this.timer) clearInterval(this.timer)
    }
  }

  private apply(s: PlayerStatus): void {
    this.status = s
    this.positionMs = s.positionMs
  }

  async refresh(): Promise<void> {
    this.apply(await ipc('player:status'))
  }

  async playTrack(trackId: number, context?: number[], index?: number): Promise<void> {
    this.apply(await ipc('player:playTrack', { trackId, context, index }))
  }

  async toggle(): Promise<void> { this.apply(await ipc('player:toggle')) }
  async next(): Promise<void> { this.apply(await ipc('player:next')) }
  async previous(): Promise<void> { this.apply(await ipc('player:previous')) }
  async stop(): Promise<void> { this.apply(await ipc('player:stop')) }
  async seek(ms: number): Promise<void> { this.positionMs = ms; this.apply(await ipc('player:seek', ms)) }
  async setVolume(v: number): Promise<void> { this.apply(await ipc('player:volume', v)) }

  async enqueue(trackIds: number[], position: 'end' | 'next' = 'end'): Promise<void> {
    this.apply(await ipc('player:enqueue', { trackIds, position }))
  }

  async dequeue(index: number): Promise<void> { this.apply(await ipc('player:dequeue', index)) }
  async clearQueue(): Promise<void> { this.apply(await ipc('player:clearQueue')) }
  async setRepeat(mode: RepeatMode): Promise<void> { this.apply(await ipc('player:repeat', mode)) }
  async setShuffle(on: boolean): Promise<void> { this.apply(await ipc('player:shuffle', on)) }

  get playing(): boolean { return this.status?.state === 'playing' }
  get currentId(): number | null { return this.status?.track?.id ?? null }
}

export const player = new PlayerStore()
