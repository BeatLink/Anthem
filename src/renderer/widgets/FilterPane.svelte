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
  let selected = $state<string | null>(null)

  async function load(): Promise<void> {
    rows = await library.groupsFor(current)
  }

  $effect(() => { void current; void library.version; void load() })

  async function pick(row: GroupRow): Promise<void> {
    const label = row.label ?? null
    selected = selected === label ? null : label
    await library.setPaneFilter(current, selected)
  }

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
    min-height: 0;
    min-width: 0;
    border-right: 1px solid var(--border-default);
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

  li:nth-child(odd) .row { background: var(--row-odd); }
  .row:hover { background: var(--row-hover); }
  .row.sel { background: var(--row-selected); color: var(--text-heading); }

  .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .n { font-variant-numeric: tabular-nums; color: var(--text-secondary); }
  .empty {
    display: block;
    height: auto;
    padding: var(--space-5) var(--space-4);
    color: var(--text-tertiary);
    background: none;
  }
</style>
