<script lang="ts">
  // Transport is presentational until the mpv engine lands in M3; the widget contract is what
  // matters now, since the layout document references widgets by id.
  let playing = $state(false)
  let position = $state(0)
</script>

<footer class="player">
  <div class="transport">
    <button aria-label="Previous">⏮</button>
    <button class="primary" aria-label={playing ? 'Pause' : 'Play'} onclick={() => (playing = !playing)}>
      {playing ? '⏸' : '▶'}
    </button>
    <button aria-label="Next">⏭</button>
  </div>

  <div class="cover" aria-hidden="true"></div>

  <div class="now">
    <div class="title">Nothing playing</div>
    <div class="sub">Anthem</div>
  </div>

  <div class="seek">
    <input type="range" min="0" max="1000" bind:value={position} aria-label="Seek" />
  </div>

  <div class="right">
    <input type="range" min="0" max="100" value="80" aria-label="Volume" class="vol" />
  </div>
</footer>

<style>
  .player {
    display: grid;
    grid-template-columns: auto auto minmax(140px, 220px) 1fr auto;
    gap: var(--space-4);
    align-items: center;
    height: 64px;
    padding: 0 var(--space-4);
    background: var(--surface-navigation);
    border-top: 1px solid var(--border-default);
  }

  .transport { display: flex; gap: var(--space-2); align-items: center; }

  button {
    width: var(--control-height);
    height: var(--control-height);
    font-size: var(--font-size-md);
    color: var(--text-on-navigation);
    background: transparent;
    border: 0;
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  button:hover { background: var(--surface-navigation-hover); }

  .primary {
    width: var(--control-height-lg);
    height: var(--control-height-lg);
    color: var(--text-on-fill);
    background: var(--accent);
  }

  .primary:hover { background: var(--accent); filter: brightness(1.08); }

  .cover {
    width: 44px;
    height: 44px;
    background: var(--surface-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
  }

  .now { min-width: 0; }
  .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-heading); }
  .sub { font-size: var(--font-size-sm); color: var(--text-tertiary); }

  .seek, .right { display: flex; align-items: center; }

  input[type='range'] {
    width: 100%;
    accent-color: var(--media-progress);
  }

  .vol { width: 100px; }
</style>
