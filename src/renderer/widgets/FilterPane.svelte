<script lang="ts">
  import { library } from '../stores/library.svelte'
  import type { GroupRow } from '@shared/ipc'
  import { untrack } from 'svelte'
  import { field as fieldDef, fieldsWith } from '@shared/fields'
  import { pref } from '../lib/prefs.svelte'
  import { sanitizePaneField } from '@shared/viewstate'

  let { field = 'genre', id = 'pane' }: { field?: string; id?: string } = $props()

  // Every groupable field, per DESIGN-SPEC §3.2.1: no field is second class, so the list is
  // derived from the catalogue rather than being a hand-picked few.
  const groupable = fieldsWith('groupable')
    .map((d) => ({ id: d.id, name: d.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // The prop is the default; what the user last chose wins, if it still names a real field.
  const remembered = pref<string>(`pane.${untrack(() => id)}.field`, untrack(() => field))
  let current = $state(sanitizePaneField(remembered.value, untrack(() => field)))

  $effect(() => { remembered.value = current })
  let rows = $state<GroupRow[]>([])

  // Read the selection back from the filter stack so a chip removal updates the pane too.
  const selectedCount = $derived(library.selectionFor(current).length)

  async function load(): Promise<void> {
    rows = await library.groupsFor(current)
  }

  $effect(() => { void current; void library.version; void load() })

  async function pick(row: GroupRow, index: number, e: MouseEvent | KeyboardEvent): Promise<void> {
    await library.setPaneFilter(current, row.label ?? null, {
      shift: e.shiftKey,
      ctrl: e.ctrlKey || e.metaKey,
      index,
      ordered: rows.map((r) => r.label)
    })
  }

  async function clear(): Promise<void> {
    await library.setPaneFilter(current, null)
  }

  const total = $derived(rows.reduce((n, r) => n + r.n, 0))

  /** A rating is stored 0-100 but read as stars, so the pane shows what the user recognises. */
  function display(label: string | null): string {
    if (label === null || label === '') return '(none)'
    if (current !== 'rating') return label
    const n = Number(label)
    if (!Number.isFinite(n)) return label
    const stars = Math.round(n / 20)
    return `${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`
  }

</script>

<section class="pane" aria-label="Filter pane">
  <header>
    <select value={current} onchange={(e) => (current = e.currentTarget.value)}>
      {#each groupable as f (f.id)}
        <option value={f.id}>{f.name}</option>
      {/each}
    </select>
    <span class="count">
      {#if selectedCount > 1}{selectedCount} of {rows.length}{:else}{rows.length}{/if}
    </span>
  </header>

  <ul>
    <li>
      <button class="row all" class:sel={selectedCount === 0} onclick={clear}>
        <span class="label">All</span>
        <span class="n">{total.toLocaleString()}</span>
      </button>
    </li>
    {#each rows as g, i (g.gid)}
      <li>
        <button
          class="row"
          class:sel={library.isPaneSelected(current, g.label ?? null)}
          onclick={(e) => pick(g, i, e)}
        >
          <span class="label">{display(g.label)}</span>
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
