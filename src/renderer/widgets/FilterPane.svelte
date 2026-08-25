<script lang="ts">
  import { library } from '../stores/library.svelte'
  import type { GroupRow } from '@shared/ipc'
  import { untrack } from 'svelte'
  import { field as fieldDef } from '@shared/fields'

  let { field = 'genre' }: { field?: string } = $props()

  const groupable = ['genre', 'album_artist', 'artist', 'album', 'grouping', 'year', 'codec']

  // The prop is fixed configuration; the select then owns the value.
  let current = $state(untrack(() => field))
  let rows = $state<GroupRow[]>([])

  // Read the selection back from the filter stack so a chip removal updates the pane too.
  const selected = $derived(library.selectionFor(current))

  async function load(): Promise<void> {
    rows = await library.groupsFor(current)
  }

  $effect(() => { void current; void library.version; void load() })

  async function pick(row: GroupRow): Promise<void> {
    const label = row.label ?? null
    await library.setPaneFilter(current, selected === label ? null : label)
  }

  async function clear(): Promise<void> {
    await library.setPaneFilter(current, null)
  }

  const total = $derived(rows.reduce((n, r) => n + r.n, 0))

</script>

<section class="pane" aria-label="Filter pane">
  <header>
    <select value={current} onchange={(e) => (current = e.currentTarget.value)}>
      {#each groupable as f (f)}
        <option value={f}>{fieldDef(f).name}</option>
      {/each}
    </select>
    <span class="count">{rows.length}</span>
  </header>

  <ul>
    <li>
      <button class="row all" class:sel={selected === null} onclick={clear}>
        <span class="label">All</span>
        <span class="n">{total.toLocaleString()}</span>
      </button>
    </li>
    {#each rows as g (g.gid)}
      <li>
        <button class="row" class:sel={selected === (g.label ?? null)} onclick={() => pick(g)}>
          <span class="label">{g.label ?? '(none)'}</span>
          <span class="n">{g.n}</span>
        </button>
      </li>
    {:else}
      <li class="empty">No values</li>
    {/each}
  </ul>
</section>

<style>
  .pane {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100%;
    min-height: 0;
    min-width: 0;
    border-right: 1px solid var(--border-default);
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    height: var(--row-height);
    padding: 0 var(--space-3);
    background: var(--column-header);
    border-bottom: 1px solid var(--column-separator);
  }

  select {
    min-width: 0;
    height: calc(var(--row-height) - 8px);
    font: inherit;
    color: var(--text-body);
    background: transparent;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-sm);
  }

  .count { font-size: var(--font-size-sm); color: var(--text-tertiary); }

  ul { margin: 0; padding: 0; min-height: 0; overflow-y: auto; list-style: none; }

  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-3);
    align-items: center;
    width: 100%;
    height: var(--row-height);
    padding: 0 var(--space-3);
    font: inherit;
    color: inherit;
    text-align: left;
    background: transparent;
    border: 0;
    cursor: pointer;
  }

  .row:hover { background: var(--row-hover); }
  .row.sel { background: var(--row-selected); color: var(--text-heading); }
  .all { font-style: italic; color: var(--text-secondary); }
  .all.sel { font-style: normal; }

  .label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .n { flex: 0 0 auto; font-variant-numeric: tabular-nums; color: var(--text-secondary); }
  .empty {
    display: block;
    height: auto;
    padding: var(--space-5) var(--space-4);
    color: var(--text-tertiary);
    background: none;
  }
</style>
