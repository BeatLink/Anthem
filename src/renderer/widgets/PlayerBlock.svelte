<script lang="ts">
  // gmb's VBplayer: indicator row, transport, the three text lines, and the time bar.

  import { player } from '../stores/player.svelte'
  import Stars from './Stars.svelte'

  const mmss = (ms: number | null | undefined): string => {
    if (ms === null || ms === undefined || !Number.isFinite(ms)) return '0:00'
    const s = Math.max(0, Math.round(ms / 1000))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = String(s % 60).padStart(2, '0')
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
  }

  const track = $derived(player.status?.track ?? null)
  const durationMs = $derived(player.status?.durationMs ?? track?.lengthMs ?? null)

  const progress = $derived(
    durationMs && durationMs > 0
      ? Math.min(1000, Math.max(0, (player.positionMs / durationMs) * 1000))
      : 0
  )

  const repeatLabel = $derived(
    player.status?.repeat === 'one' ? '🔂' : player.status?.repeat === 'all' ? '🔁' : '🔁'
  )

  function cycleRepeat(): void {
    const next = player.status?.repeat === 'off' ? 'all'
      : player.status?.repeat === 'all' ? 'one' : 'off'
    void player.setRepeat(next)
  }

  function onSeek(e: Event): void {
    const value = Number((e.currentTarget as HTMLInputElement).value)
    if (durationMs) void player.seek((value / 1000) * durationMs)
  }
</script>

<section class="vbplayer">
  <div class="indicators">
    <button
      class="chip"
      class:on={player.status?.shuffle}
      title="Shuffle"
      onclick={() => player.setShuffle(!player.status?.shuffle)}
    >🔀</button>
    <button
      class="chip"
      class:on={player.status?.repeat !== 'off'}
      title="Repeat: {player.status?.repeat ?? 'off'}"
      onclick={cycleRepeat}
    >{repeatLabel}{player.status?.repeat === 'one' ? '' : ''}</button>
    {#if (player.status?.queue.length ?? 0) > 0}
      <span class="chip queued">{player.status!.queue.length} queued</span>
    {/if}
    <span class="spacer"></span>
    <Stars value={track?.rating ?? null} />
  </div>

  <div class="main">
    <div class="text">
      <div class="transport">
        <button aria-label="Previous" onclick={() => player.previous()}>⏮</button>
        <button aria-label="Stop" onclick={() => player.stop()}>⏹</button>
        <button
          class="primary"
          aria-label={player.playing ? 'Pause' : 'Play'}
          onclick={() => player.toggle()}
        >{player.playing ? '⏸' : '▶'}</button>
        <button aria-label="Next" onclick={() => player.next()}>⏭</button>
        <span class="spacer"></span>
        <input
          class="vol"
          type="range" min="0" max="100"
          value={player.status?.volume ?? 80}
          aria-label="Volume"
          oninput={(e) => player.setVolume(Number(e.currentTarget.value))}
        />
      </div>

      <div class="line title" title={track?.title ?? ''}>
        {track?.title ?? 'Nothing playing'}
      </div>
      <div class="line artist" title={track?.artist ?? ''}>{track?.artist ?? '—'}</div>
      <div class="line album" title={track?.album ?? ''}>{track?.album ?? '—'}</div>

      {#if player.status?.error}
        <div class="line err">{player.status.error}</div>
      {/if}

      <div class="time">
        <span class="clock">{mmss(player.positionMs)}</span>
        <input
          type="range" min="0" max="1000"
          value={progress}
          disabled={!durationMs}
          aria-label="Seek"
          oninput={onSeek}
        />
        <span class="clock">{mmss(durationMs)}</span>
      </div>
    </div>

    <div class="cover" aria-hidden="true"></div>
  </div>
</section>

<style>
  .vbplayer {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border-bottom: 1px solid var(--border-default);
  }

  .indicators { display: flex; align-items: center; gap: var(--space-2); }

  .chip {
    flex: 0 0 auto;
    height: var(--control-height-sm);
    padding: 0 var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--text-on-navigation);
    background: var(--surface-navigation-hover);
    border: 0;
    border-radius: var(--radius-full);
    cursor: pointer;
  }

  .chip.on { color: var(--text-on-fill); background: var(--accent); }
  .queued { cursor: default; }

  .main { display: grid; grid-template-columns: 1fr 88px; gap: var(--space-3); }
  .text { display: grid; gap: var(--space-1); min-width: 0; }
  .transport { display: flex; align-items: center; gap: var(--space-1); }

  button {
    min-width: var(--control-height);
    height: var(--control-height);
    padding: 0 var(--space-2);
    font-size: var(--font-size-md);
    color: var(--text-on-navigation);
    background: transparent;
    border: 0;
    border-radius: var(--radius-full);
    cursor: pointer;
  }

  button:hover { background: var(--surface-navigation-hover); }
  .primary { color: var(--text-on-fill); background: var(--accent); }
  .primary:hover { background: var(--accent); filter: brightness(1.08); }

  .line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title { font-weight: 600; color: var(--text-heading); }
  .artist { color: var(--text-secondary); }
  .album { color: var(--text-tertiary); font-size: var(--font-size-sm); }
  .err { color: var(--status-danger); font-size: var(--font-size-sm); }

  .time {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--space-2);
    align-items: center;
  }

  .clock {
    font-variant-numeric: tabular-nums;
    font-size: var(--font-size-sm);
    color: var(--text-tertiary);
  }

  input[type='range'] { width: 100%; accent-color: var(--media-progress); }
  .vol { width: 90px; }

  .cover {
    width: 88px;
    height: 88px;
    background: var(--surface-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
  }

  .spacer { flex: 1; }
</style>
