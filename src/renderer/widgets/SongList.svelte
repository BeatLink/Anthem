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

  const mmss = (ms: number | null): string => {
    if (ms === null) return ''
    const s = Math.round(ms / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }
</script>

<section class="songlist" aria-label="Song list">
  <div class="head" style:grid-template-columns={template}>
    {#each columns as c (c)}
      <div class="cell head-cell" style:text-align={align(c)}>{heading(c)}</div>
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
        <p>No tracks yet.</p>
        <p class="hint">
          The library database is the source of truth — tracks live here even when their files move,
          change format, or go missing.
        </p>
        {#if library.lastSql}
          <pre>{library.lastSql}</pre>
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  .songlist {
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 0;
  }

  .head {
    display: grid;
    background: var(--column-header);
    border-bottom: 1px solid var(--column-separator);
  }

  .head-cell {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-secondary);
    border-right: 1px solid var(--column-separator);
  }

  .body { overflow-y: auto; }

  .row {
    display: grid;
    height: var(--row-height);
    align-items: center;
  }

  .row:nth-child(odd) { background: var(--row-odd); }
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

  pre {
    padding: var(--space-3);
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    background: var(--surface-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
  }
</style>
