<script lang="ts">
  // gmb's VolumeIcon: a button that reveals a slider, rather than a slider taking up bar space
  // permanently. Scrolling the button adjusts volume without opening anything, which is how most
  // players behave and is the fastest path for small changes.

  let {
    volume = 80,
    onchange
  }: { volume?: number; onchange?: (v: number) => void } = $props()

  let open = $state(false)
  let wrapper = $state<HTMLElement | null>(null)
  /** Remembers the level before muting, so unmuting returns to it. */
  let beforeMute = $state(80)

  const icon = $derived(
    volume === 0 ? '🔇' : volume < 34 ? '🔈' : volume < 67 ? '🔉' : '🔊'
  )

  function set(v: number): void {
    onchange?.(Math.max(0, Math.min(100, Math.round(v))))
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault()
    set(volume + (e.deltaY < 0 ? 5 : -5))
  }

  function toggleMute(): void {
    if (volume > 0) {
      beforeMute = volume
      set(0)
    } else {
      set(beforeMute || 80)
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && open) {
      open = false
      return
    }
    if (!open) return
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); set(volume + 5) }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); set(volume - 5) }
  }

  // Clicking anywhere else dismisses the popover, which is what makes it feel like a menu.
  $effect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent): void => {
      if (wrapper && !wrapper.contains(e.target as Node)) open = false
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  })
</script>

<svelte:window onkeydown={onKeydown} />

<div class="wrap" bind:this={wrapper}>
  <button
    class="trigger"
    class:open
    aria-label="Volume {volume}%"
    aria-expanded={open}
    title="Volume {volume}% — scroll to adjust, middle-click to mute"
    onclick={() => (open = !open)}
    onauxclick={(e) => { if (e.button === 1) { e.preventDefault(); toggleMute() } }}
    onwheel={onWheel}
  >{icon}</button>

  {#if open}
    <div class="popover" role="group" aria-label="Volume">
      <button class="mute" onclick={toggleMute} title={volume === 0 ? 'Unmute' : 'Mute'}>
        {volume === 0 ? '🔇' : '🔊'}
      </button>
      <input
        type="range" min="0" max="100"
        value={volume}
        aria-label="Volume"
        oninput={(e) => set(Number(e.currentTarget.value))}
      />
      <span class="pct">{volume}%</span>
    </div>
  {/if}
</div>

<style>
  .wrap { position: relative; display: inline-flex; }

  .trigger {
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

  .trigger:hover, .trigger.open { background: var(--surface-navigation-hover); }

  .popover {
    position: absolute;
    bottom: calc(100% + var(--space-2));
    right: 0;
    z-index: 5;
    display: flex;
    gap: var(--space-2);
    align-items: center;
    padding: var(--space-2) var(--space-3);
    background: var(--surface-default);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: 0 8px 24px var(--shadow-floating);
  }

  .mute {
    width: var(--control-height-sm);
    height: var(--control-height-sm);
    padding: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    background: transparent;
    border: 0;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .mute:hover { background: var(--surface-secondary); }

  input[type='range'] { width: 120px; accent-color: var(--media-progress); }

  .pct {
    min-width: 3.2em;
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
    color: var(--text-tertiary);
    text-align: right;
  }
</style>
