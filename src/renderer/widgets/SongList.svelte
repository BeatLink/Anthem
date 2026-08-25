<script lang="ts">
  import { library } from '../stores/library.svelte'
  import { field } from '@shared/fields'
  import Stars from './Stars.svelte'

  // Column set is data, so the header context menu can edit it without touching this component.
  let columns = $state(['track_number', 'title', 'artist', 'album', 'year', 'length', 'rating', 'play_count'])

  const heading = (id: string): string => field(id).name
  const align = (id: string): string => field(id).align ?? 'left'
  const width = (id: string): string => (id === 'title' || id === 'album' || id === 'artist' ? '1fr' : `${field(id).width ?? 80}px`)

  const template = $derived(columns.map(width).join(' '))

  const arrow = (id: string): string => {
    const dir = library.sortDir(id)
    if (!dir) return ''
    const p = library.sortPriority(id)
    return `${dir === 'asc' ? '▲' : '▼'}${p > 1 ? p : ''}`
  }

  const mmss = (ms: number | null): string => {
    if (ms === null) return ''
    const s = Math.round(ms / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }
</script>

<section class="songlist" aria-label="Song list">
  <div class="hbsonglist">
    <input
      class="search"
      type="search"
      placeholder="Search…"
      value={library.search}
      oninput={(e) => library.setSearch(e.currentTarget.value)}
    />
    {#each library.chips() as chip (chip.id)}
      <button class="chip" onclick={() => library.removeChip(chip.id)} title="Remove filter">
        {chip.label} ✕
      </button>
    {/each}
    {#if library.hasFilters()}
      <button class="clear" onclick={() => library.clearFilters()}>Clear all</button>
    {/if}
    <span class="spacer"></span>
    <span class="count">{library.tracks.length.toLocaleString()} shown</span>
  </div>

  <div class="head" style:grid-template-columns={template}>
    {#each columns as c (c)}
      <button
        class="cell head-cell"
        style:text-align={align(c)}
        onclick={(e) => library.toggleSort(c, e.shiftKey)}
      >{heading(c)} <span class="arrow">{arrow(c)}</span></button>
    {/each}
  </div>

  <div class="body">
    {#each library.tracks as t (t.id)}
      <div class="row" style:grid-template-columns={template}>
        <div class="cell num">{t.track_number ?? ''}</div>
        <div class="cell">{t.title ?? ''}</div>
        <div class="cell">{t.artist ?? ''}</div>
        <div class="cell">{t.album ?? ''}</div>
        <div class="cell num">{t.year ?? ''}</div>
        <div class="cell num">{mmss(t.length_ms)}</div>
        <div class="cell"><Stars value={t.rating} /></div>
        <div class="cell num">{t.play_count}</div>
      </div>
    {:else}
      <div class="empty">
        <p>No tracks match.</p>
        <p class="hint">
          Import your gmusicbrowser library from the Library menu, or clear the active filters.
        </p>
      </div>
    {/each}
  </div>
</section>

<style>
  .songlist {
    display: grid;
    grid-template-rows: auto auto 1fr;
    height: 100%;
    min-height: 0;
  }

  .hbsonglist {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--border-default);
  }

  .search {
    width: 240px;
    height: var(--control-height-sm);
    padding: 0 var(--space-3);
    font: inherit;
    color: var(--text-body);
    background: var(--surface-secondary);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
  }

  .search:focus { background: var(--surface-default); border-color: var(--border-focus); outline: none; }

  .chip {
    flex: 0 0 auto;
    height: var(--control-height-sm);
    padding: 0 var(--space-3);
    max-width: 260px;
    font-size: var(--font-size-sm);
    color: var(--text-on-fill);
    background: var(--accent);
    border: 0;
    border-radius: var(--radius-full);
    cursor: pointer;
  }

  .clear {
    flex: 0 0 auto;
    height: var(--control-height-sm);
    padding: 0 var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-full);
    cursor: pointer;
  }

  .clear:hover { color: var(--text-body); border-color: var(--border-focus); }

  .count { font-size: var(--font-size-sm); color: var(--text-tertiary); }
  .spacer { flex: 1; }
  .arrow { color: var(--accent); font-size: 9px; }

  .head {
    display: grid;
    height: var(--row-height);
    background: var(--column-header);
    border-bottom: 1px solid var(--column-separator);
  }

  .head-cell {
    height: 100%;
    justify-content: flex-start;
    gap: var(--space-1);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-secondary);
    background: transparent;
    border: 0;
    border-right: 1px solid var(--column-separator);
    cursor: pointer;
  }

  .head-cell:hover { background: var(--surface-navigation-hover); color: var(--text-body); }

  .body { overflow-y: auto; }

  .row {
    display: grid;
    height: var(--row-height);
    align-items: center;
  }

  .row:hover { background: var(--row-hover); }

  .cell {
    padding: 0 var(--space-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .num { text-align: right; font-variant-numeric: tabular-nums; }

  .empty {
    padding: var(--space-7) var(--space-6);
    color: var(--text-tertiary);
    max-width: 62ch;
  }

  .empty p { margin: 0 0 var(--space-3); }
  .hint { color: var(--text-tertiary); }

</style>
