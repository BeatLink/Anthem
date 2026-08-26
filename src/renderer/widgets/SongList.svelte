<script lang="ts">
  import { library } from '../stores/library.svelte'
  import { field } from '@shared/fields'
  import Stars from './Stars.svelte'
  import MergeView from './MergeView.svelte'
  import { player } from '../stores/player.svelte'
  import SongProperties from './SongProperties.svelte'
  import ContextMenu, { type MenuItem } from '../lib/ContextMenu.svelte'
  import { pref } from '../lib/prefs.svelte'
  import { logger } from '../lib/log'

  const log = logger('songlist')

  let merging = $state<number[] | null>(null)
  let inspecting = $state<number | null>(null)

  /** The keyboard cursor: which row arrow keys move from. */
  let cursor = $state(0)
  let bodyEl = $state<HTMLElement | null>(null)

  function focusRow(index: number): void {
    const el = bodyEl?.querySelector<HTMLElement>(`[data-row="${index}"]`)
    el?.focus({ preventScroll: true })
    el?.scrollIntoView({ block: 'nearest' })
  }

  /**
   * Arrow keys move the cursor; holding shift extends the selection from the anchor instead of
   * replacing it, which is what makes a range adjustable without the mouse.
   */
  function onListKeydown(e: KeyboardEvent): void {
    const last = library.tracks.length - 1
    if (last < 0) return

    const rowsPerPage = Math.max(1, Math.floor((bodyEl?.clientHeight ?? 400) / 28) - 1)

    let next: number | null = null
    switch (e.key) {
      case 'ArrowDown': next = Math.min(last, cursor + 1); break
      case 'ArrowUp': next = Math.max(0, cursor - 1); break
      case 'PageDown': next = Math.min(last, cursor + rowsPerPage); break
      case 'PageUp': next = Math.max(0, cursor - rowsPerPage); break
      case 'Home': next = 0; break
      case 'End': next = last; break
      case 'a':
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); library.selectAll() }
        return
      case 'Escape':
        library.clearSelection()
        return
      default:
        return
    }

    e.preventDefault()
    cursor = next

    // Ctrl alone moves the cursor without disturbing the selection, as lists conventionally do.
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey) {
      library.clickRow(next, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey })
    }
    focusRow(next)
  }
  let menu = $state<{ x: number; y: number; items: MenuItem[] } | null>(null)

  /** Right-clicking a row that is not selected selects it, as every list does. */
  function openMenu(e: MouseEvent, index: number): void {
    e.preventDefault()
    const t = library.tracks[index]
    if (!t) return
    if (!library.isSelected(t.id)) library.clickRow(index, {})

    const ids = library.selectedIds()
    const many = ids.length > 1

    menu = {
      x: e.clientX,
      y: e.clientY,
      items: [
        { id: 'play', label: 'Play', hint: 'Enter', action: () => playFrom(index) },
        { id: 'next', label: many ? `Play ${ids.length} next` : 'Play next',
          action: () => void player.enqueue(ids, 'next') },
        { id: 'queue', label: many ? `Add ${ids.length} to queue` : 'Add to queue',
          action: () => void player.enqueue(ids, 'end') },
        { id: 'props', label: 'Properties', hint: 'Alt+Enter', separatorBefore: true,
          disabled: many, action: () => (inspecting = t.id) },
        { id: 'merge', label: `Merge ${ids.length} tracks…`, disabled: !many,
          action: () => (merging = ids) }
      ]
    }
  }

  function selectRow(index: number, e: MouseEvent | KeyboardEvent): void {
    const modifiers = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }
    const anchorBefore = library.inspectSelection().anchor

    library.clickRow(index, modifiers)

    // Which rows ended up selected, not just how many: a wrong range is usually a wrong anchor.
    const ids = library.selectedIds()
    const positions = ids
      .map((id) => library.tracks.findIndex((t) => t.id === id))
      .filter((n) => n >= 0)
      .sort((a, b) => a - b)

    log.debug('row clicked', {
      clicked: index,
      shift: modifiers.shift,
      ctrl: modifiers.ctrl,
      anchorBefore,
      anchorAfter: library.inspectSelection().anchor,
      count: ids.length,
      rows: positions.length > 8
        ? `${positions[0]}..${positions[positions.length - 1]}`
        : positions.join(',')
    })
  }

  /** Playing from the list makes the whole visible list the context, as every player does. */
  function playFrom(index: number): void {
    const t = library.tracks[index]
    if (!t) return
    void player.playTrack(t.id, library.tracks.map((x) => x.id), index)
  }

  // Column set is data, so the header context menu can edit it without touching this component.
  let columns = $state(['track_number', 'title', 'artist', 'album', 'year', 'length', 'rating', 'play_count'])

  const DEFAULT_WIDTHS: Record<string, number> = {
    track_number: 56, title: 320, artist: 220, album: 220,
    year: 60, length: 70, rating: 96, play_count: 60
  }

  const MIN_WIDTH = 44

  // Widths are remembered per column id, so adding or reordering columns keeps the rest intact.
  const widths = pref<Record<string, number>>('songlist.widths', {})

  const widthOf = (id: string): number =>
    widths.value[id] ?? DEFAULT_WIDTHS[id] ?? 120

  /** The last column takes the remaining space, so the row always fills the viewport. */
  const template = $derived(
    columns.map((c, i) => (i === columns.length - 1 ? '1fr' : `${widthOf(c)}px`)).join(' ')
  )

  let dragging = $state<string | null>(null)

  function startResize(id: string, event: PointerEvent): void {
    event.preventDefault()
    event.stopPropagation()

    const handle = event.currentTarget as HTMLElement
    handle.setPointerCapture(event.pointerId)

    const originX = event.clientX
    const originWidth = widthOf(id)
    dragging = id

    const move = (e: PointerEvent): void => {
      const next = Math.max(MIN_WIDTH, Math.round(originWidth + (e.clientX - originX)))
      widths.value = { ...widths.value, [id]: next }
    }

    const done = (): void => {
      dragging = null
      handle.releasePointerCapture(event.pointerId)
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', done)
      handle.removeEventListener('pointercancel', done)
    }

    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', done)
    handle.addEventListener('pointercancel', done)
  }

  /** Double-clicking a divider restores that column's default. */
  function resetWidth(id: string): void {
    const next = { ...widths.value }
    delete next[id]
    widths.value = next
  }

  const heading = (id: string): string => field(id).name
  const align = (id: string): string => field(id).align ?? 'left'

  const hint = (id: string): string => {
    const dir = library.sortDir(id)
    const p = library.sortPriority(id)
    const state = dir === null
      ? 'Not sorted'
      : `Sorted ${dir === 'asc' ? 'ascending' : 'descending'}${p > 1 ? `, key ${p}` : ''}`
    return `${heading(id)} — ${state}\nClick to sort by this column\nShift+click to add it as an extra sort key`
  }

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
    {#if library.selectedCount() > 0}
      <button class="clear" onclick={() => library.clearSelection()}>
        {library.selectedCount()} selected ✕
      </button>
    {/if}
    {#if library.selectedCount() > 0}
      <button class="clear" onclick={() => player.enqueue(library.selectedIds())}>
        Queue {library.selectedCount()}
      </button>
    {/if}
    {#if library.selectedCount() > 1}
      <button class="merge" onclick={() => (merging = library.selectedIds())}>
        Merge {library.selectedCount()}…
      </button>
    {/if}
    <span class="spacer"></span>
    <span class="hint" title="Click a column header to sort. Shift+click another to sort by it next.">
      ↑↓ to move · shift+↑↓ to select · double-click to play · right-click for actions
    </span>
    <span class="count">{library.tracks.length.toLocaleString()} shown</span>
  </div>

  <div class="head" style:grid-template-columns={template}>
    {#each columns as c, i (c)}
      <div class="head-slot">
        <button
          class="cell head-cell"
          class:sorted={library.sortDir(c) !== null}
          style:text-align={align(c)}
          title={hint(c)}
          onclick={(e) => library.toggleSort(c, e.shiftKey)}
        >{heading(c)} <span class="arrow">{arrow(c)}</span></button>

        {#if i < columns.length - 1}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div
            class="grip"
            class:active={dragging === c}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize {heading(c)} column"
            tabindex="0"
            onpointerdown={(e) => startResize(c, e)}
            ondblclick={() => resetWidth(c)}
            onkeydown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
              e.preventDefault()
              const step = e.shiftKey ? 32 : 8
              widths.value = {
                ...widths.value,
                [c]: Math.max(MIN_WIDTH, widthOf(c) + (e.key === 'ArrowRight' ? step : -step))
              }
            }}
          ></div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="body" bind:this={bodyEl} role="rowgroup" onkeydown={onListKeydown}>
    {#each library.tracks as t, i (t.id)}
      <div
        class="row"
        class:sel={library.isSelected(t.id)}
        class:playing={player.currentId === t.id}
        style:grid-template-columns={template}
        role="row"
        tabindex={i === cursor ? 0 : -1}
        data-row={i}
        onclick={(e) => { cursor = i; selectRow(i, e) }}
        ondblclick={() => playFrom(i)}
        oncontextmenu={(e) => openMenu(e, i)}
        onkeydown={(e) => {
          if (e.key === 'Enter' && e.altKey) { e.preventDefault(); inspecting = t.id; return }
          if (e.key === 'Enter') { e.preventDefault(); playFrom(i); return }
          if (e.key !== ' ') return
          e.preventDefault()
          selectRow(i, e)
        }}
      >
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

{#if menu}
  <ContextMenu x={menu.x} y={menu.y} items={menu.items} onclose={() => (menu = null)} />
{/if}

{#if inspecting !== null}
  <SongProperties trackId={inspecting} onclose={() => (inspecting = null)} />
{/if}

{#if merging}
  <MergeView
    ids={merging}
    onclose={(merged) => {
      merging = null
      if (merged) library.clearSelection()
    }}
  />
{/if}

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

  .merge {
    flex: 0 0 auto;
    height: var(--control-height-sm);
    padding: 0 var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--text-on-fill);
    background: var(--accent);
    border: 0;
    border-radius: var(--radius-full);
    cursor: pointer;
  }

  .count { font-size: var(--font-size-sm); color: var(--text-tertiary); }
  .hint { font-size: var(--font-size-sm); color: var(--text-tertiary); opacity: 0.75; }
  .spacer { flex: 1; }
  .arrow { color: var(--accent); font-size: 9px; font-variant-numeric: tabular-nums; }

  .head {
    display: grid;
    height: var(--row-height);
    background: var(--column-header);
    border-bottom: 1px solid var(--column-separator);
  }

  .head-slot { position: relative; display: grid; min-width: 0; }

  .grip {
    position: absolute;
    top: 0;
    right: -3px;
    z-index: 1;
    width: 7px;
    height: 100%;
    cursor: col-resize;
  }

  .grip::after {
    content: '';
    position: absolute;
    inset-block: 0;
    left: 3px;
    width: 1px;
    background: transparent;
    transition: background var(--transition-fast);
  }

  .grip:hover::after, .grip:focus-visible::after, .grip.active::after { background: var(--accent); }
  .grip:focus-visible { outline: none; }

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
  .head-cell.sorted { color: var(--text-heading); }

  .body { min-height: 0; overflow-y: auto; }

  .row {
    display: grid;
    height: var(--row-height);
    align-items: center;
    cursor: default;
    user-select: none;
  }

  .row:focus-visible { outline: 2px solid var(--border-focus); outline-offset: -2px; }
  .row:hover { background: var(--row-hover); }
  /* After :hover deliberately — a selected row stays visibly selected under the pointer. */
  .row.sel { background: var(--row-selected); }
  .row.playing { box-shadow: inset 3px 0 0 var(--accent); }
  .row.playing .cell:nth-child(2) { color: var(--text-heading); font-weight: 600; }

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
