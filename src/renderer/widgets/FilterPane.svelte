<script lang="ts">
  import { library } from '../stores/library.svelte'

  const groupable = ['genre', 'album_artist', 'artist', 'grouping', 'year', 'codec']

  async function setField(f: string): Promise<void> {
    library.groupField = f
    await library.refresh()
  }

  const duration = (ms: number): string => {
    const h = Math.floor(ms / 3_600_000)
    const m = Math.round((ms % 3_600_000) / 60_000)
    return h ? `${h}h ${m}m` : `${m}m`
  }
</script>

<section class="pane" aria-label="Filter pane">
  <header>
    <select value={library.groupField} onchange={(e) => setField(e.currentTarget.value)}>
      {#each groupable as f (f)}
        <option value={f}>{f}</option>
      {/each}
    </select>
    <span class="count">{library.groups.length} values</span>
  </header>

  <ul>
    {#each library.groups as g (g.gid)}
      <li>
        <span class="label">{g.label ?? '(none)'}</span>
        <span class="n">{g.n}</span>
        <span class="dur">{duration(g.total_ms)}</span>
      </li>
    {:else}
      <li class="empty">Library is empty — add a music folder to begin.</li>
    {/each}
  </ul>
</section>

<style>
  .pane {
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 0;
    border-bottom: 1px solid var(--border-default);
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    background: var(--column-header);
    border-bottom: 1px solid var(--column-separator);
  }

  select {
    height: var(--control-height-sm);
    font: inherit;
    color: var(--text-body);
    background: transparent;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-sm);
  }

  .count { font-size: var(--font-size-sm); color: var(--text-tertiary); }

  ul { margin: 0; padding: 0; overflow-y: auto; list-style: none; }

  li {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: var(--space-4);
    align-items: center;
    height: var(--row-height);
    padding: 0 var(--space-4);
  }

  li:nth-child(odd) { background: var(--row-odd); }
  li:hover { background: var(--row-hover); }

  .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .n { font-variant-numeric: tabular-nums; color: var(--text-secondary); }
  .dur { font-variant-numeric: tabular-nums; color: var(--text-tertiary); min-width: 4rem; text-align: right; }

  .empty {
    display: block;
    height: auto;
    padding: var(--space-5) var(--space-4);
    color: var(--text-tertiary);
    background: none;
  }
</style>
