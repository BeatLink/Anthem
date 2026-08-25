<script lang="ts">
  // gmb's VBplayer = HBButtons3 (Sort/Filter/Queue/Pos/Stars) + HBText_Cover (text lines + cover).
  import Stars from './Stars.svelte'

  let playing = $state(false)
  let position = $state(0)
</script>

<section class="vbplayer">
  <div class="hbbuttons3">
    <button class="chip">Sort</button>
    <button class="chip">Filter</button>
    <button class="chip">Queue</button>
    <span class="spacer"></span>
    <Stars value={null} />
  </div>

  <div class="hbtext-cover">
    <div class="vbtext">
      <div class="hbbuttons1">
        <button aria-label="Previous">⏮</button>
        <button aria-label="Stop">⏹</button>
        <button class="primary" aria-label={playing ? 'Pause' : 'Play'}
                onclick={() => (playing = !playing)}>{playing ? '⏸' : '▶'}</button>
        <button aria-label="Next">⏭</button>
        <span class="spacer"></span>
        <button aria-label="Volume">🔊</button>
      </div>

      <div class="line title">Nothing playing</div>
      <div class="line artist">—</div>
      <div class="line album">—</div>

      <div class="hbtime">
        <span class="time">0:00</span>
        <input type="range" min="0" max="1000" bind:value={position} aria-label="Seek" />
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

  .hbbuttons3 { display: flex; align-items: center; gap: var(--space-2); }

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

  .hbtext-cover { display: grid; grid-template-columns: 1fr 88px; gap: var(--space-3); }
  .vbtext { display: grid; gap: var(--space-1); min-width: 0; }
  .hbbuttons1 { display: flex; align-items: center; gap: var(--space-1); }

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

  .primary {
    color: var(--text-on-fill);
    background: var(--accent);
  }

  .line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title { font-weight: 600; color: var(--text-heading); }
  .artist { color: var(--text-secondary); }
  .album { color: var(--text-tertiary); font-size: var(--font-size-sm); }

  .hbtime { display: grid; grid-template-columns: auto 1fr; gap: var(--space-2); align-items: center; }
  .time { font-variant-numeric: tabular-nums; font-size: var(--font-size-sm); color: var(--text-tertiary); }
  input[type='range'] { width: 100%; accent-color: var(--media-progress); }

  .cover {
    width: 88px;
    height: 88px;
    background: var(--surface-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
  }

  .spacer { flex: 1; }
</style>
