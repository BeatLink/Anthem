// gmb's VBplayer: indicator row, transport, the three text lines, and the time bar.

import { player } from '../stores/player'
import { cx } from '../lib/cx'
import { Stars } from './Stars'
import { VolumeButton } from './VolumeButton'
import { Cover } from './Cover'
import s from './PlayerBlock.module.css'

const mmss = (ms: number | null | undefined): string => {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '0:00'
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** The only part that reads the playback position, so each clock tick re-renders just this row. */
function TimeBar({ durationMs }: { durationMs: number | null }) {
  const progress = durationMs && durationMs > 0
    ? Math.min(1000, Math.max(0, (player.positionMs / durationMs) * 1000))
    : 0

  function onSeek(e: Event): void {
    const value = Number((e.currentTarget as HTMLInputElement).value)
    if (durationMs) void player.seek((value / 1000) * durationMs)
  }

  return (
    <div class={s.time}>
      <span class={s.clock}>{mmss(player.positionMs)}</span>
      <input
        class={s.range}
        type="range" min="0" max="1000"
        value={progress}
        disabled={!durationMs}
        aria-label="Seek"
        onInput={onSeek}
      />
      <span class={s.clock}>{mmss(durationMs)}</span>
    </div>
  )
}

export function PlayerBlock() {
  const status = player.status
  const track = status?.track ?? null
  const durationMs = status?.durationMs ?? track?.lengthMs ?? null

  const repeatLabel = status?.repeat === 'one' ? '🔂' : status?.repeat === 'all' ? '🔁' : '🔁'

  function cycleRepeat(): void {
    const next = player.status?.repeat === 'off' ? 'all'
      : player.status?.repeat === 'all' ? 'one' : 'off'
    void player.setRepeat(next)
  }

  return (
    <section class={s.vbplayer}>
      <div class={s.indicators}>
        <button
          class={cx(s.button, s.chip, status?.shuffle && s.on)}
          title="Shuffle"
          onClick={() => player.setShuffle(!player.status?.shuffle)}
        >🔀</button>
        <button
          class={cx(s.button, s.chip, status?.repeat !== 'off' && s.on)}
          title={`Repeat: ${status?.repeat ?? 'off'}`}
          onClick={cycleRepeat}
        >{repeatLabel}</button>
        {(status?.queue.length ?? 0) > 0 && (
          <span class={cx(s.chip, s.queued)}>{status!.queue.length} queued</span>
        )}
        <span class={s.spacer}></span>
        <Stars value={track?.rating ?? null} />
      </div>

      <div class={s.main}>
        <div class={s.text}>
          <div class={s.transport}>
            <button class={s.button} aria-label="Previous" onClick={() => player.previous()}>⏮</button>
            <button class={s.button} aria-label="Stop" onClick={() => player.stop()}>⏹</button>
            <button
              class={cx(s.button, s.primary)}
              aria-label={player.playing ? 'Pause' : 'Play'}
              onClick={() => player.toggle()}
            >{player.playing ? '⏸' : '▶'}</button>
            <button class={s.button} aria-label="Next" onClick={() => player.next()}>⏭</button>
            <span class={s.spacer}></span>
            <VolumeButton
              volume={status?.volume ?? 80}
              onchange={(v) => player.setVolume(v)}
            />
          </div>

          <div class={cx(s.line, s.title)} title={track?.title ?? ''}>
            {track?.title ?? 'Nothing playing'}
          </div>
          <div class={cx(s.line, s.artist)} title={track?.artist ?? ''}>{track?.artist ?? '—'}</div>
          <div class={cx(s.line, s.album)} title={track?.album ?? ''}>{track?.album ?? '—'}</div>

          {status?.error && (
            <div class={cx(s.line, s.err)}>{status.error}</div>
          )}

          <TimeBar durationMs={durationMs} />
        </div>

        <Cover trackId={track?.id ?? null} size={88} />
      </div>
    </section>
  )
}
