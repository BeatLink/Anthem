<script lang="ts">
  import { onMount } from 'svelte'
  import type { FileOutcome, FileResult, Root, ScanProgress, ScanReport } from '@shared/ipc'
  import { library } from '../../stores/library.svelte'
  import { virtualWindow } from '@shared/view'

  let roots = $state<Root[]>([])
  let progress = $state<ScanProgress | null>(null)
  let report = $state<ScanReport | null>(null)
  let error = $state<string | null>(null)
  let scanning = $state(false)

  // Every file's outcome is kept; the table renders only the rows in view.
  let results = $state<FileResult[]>([])
  let filter = $state<FileOutcome | 'all'>('all')
  let follow = $state(true)
  let scrollTop = $state(0)
  let viewport = $state(320)
  let body = $state<HTMLElement | null>(null)

  const ROW = 24

  const OUTCOMES: { id: FileOutcome; label: string }[] = [
    { id: 'new', label: 'New' },
    { id: 'matched', label: 'Matched' },
    { id: 'moved', label: 'Moved' },
    { id: 'unchanged', label: 'Unchanged' },
    { id: 'missing', label: 'Missing' },
    { id: 'error', label: 'Failed' }
  ]

  const tally = $derived.by(() => {
    const t: Record<string, number> = {}
    for (const r of results) t[r.outcome] = (t[r.outcome] ?? 0) + 1
    return t
  })

  const shown = $derived(filter === 'all' ? results : results.filter((r) => r.outcome === filter))
  const win = $derived(virtualWindow(shown.length, ROW, scrollTop, viewport))
  const slice = $derived(shown.slice(win.start, win.end))

  $effect(() => {
    // Following the tail is only helpful while rows are still arriving.
    void results.length
    if (follow && scanning && body) body.scrollTop = body.scrollHeight
  })

  onMount(() => {
    void load()
    const offProgress = window.anthemEvents.on('scan:progress', (p) => (progress = p))
    const offFiles = window.anthemEvents.on('scan:files', (batch) => {
      results = [...results, ...batch]
    })
    const offDone = window.anthemEvents.on('scan:done', (r) => {
      report = r
      progress = null
      scanning = false
      void library.refresh()
    })
    return () => { offProgress(); offFiles(); offDone() }
  })

  async function load(): Promise<void> {
    try {
      roots = await window.anthem['library:roots']()
    } catch (err) {
      error = (err as Error).message
    }
  }

  async function add(): Promise<void> {
    try {
      error = null
      const added = await window.anthem['library:addRoot']()
      if (added) await load()
    } catch (err) {
      error = (err as Error).message
    }
  }

  async function remove(id: number): Promise<void> {
    await window.anthem['library:removeRoot'](id)
    await load()
  }

  async function scan(): Promise<void> {
    error = null
    report = null
    results = []
    filter = 'all'
    follow = true
    scanning = true
    try {
      await window.anthem['library:scan']()
    } catch (err) {
      error = (err as Error).message
      scanning = false
      progress = null
    }
  }

  async function cancel(): Promise<void> {
    await window.anthem['library:scanCancel']()
  }

  const pct = $derived(
    progress && progress.found > 0
      ? Math.round((progress.processed / progress.found) * 100)
      : 0
  )

  const short = (p: string | undefined): string =>
    p ? (p.length > 72 ? `…${p.slice(-71)}` : p) : ''

  const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`
</script>

<section class="scan">
  <header>
    <h2>Music folders</h2>
    <p class="lead">
      Anthem reads these folders to build the library. Files are only ever read, never modified.
    </p>
  </header>

  {#if roots.length}
    <ul class="roots">
      {#each roots as r (r.id)}
        <li>
          <code>{r.path}</code>
          <span class="when">
            {r.lastScan ? `scanned ${new Date(r.lastScan).toLocaleString()}` : 'never scanned'}
          </span>
          <button class="remove" onclick={() => remove(r.id)} disabled={scanning}>Remove</button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="note">No folders yet. Add one to scan, or import from gmusicbrowser instead.</p>
  {/if}

  <div class="actions">
    <button onclick={add} disabled={scanning}>Add folder…</button>
    <button class="primary" onclick={scan} disabled={scanning || roots.length === 0}>
      {scanning ? 'Scanning…' : 'Scan now'}
    </button>
    {#if scanning}
      <button onclick={cancel}>Cancel</button>
    {/if}
  </div>

  {#if progress}
    <div class="progress">
      <div class="bar"><div class="fill" style:width="{pct}%"></div></div>
      <div class="detail">
        {#if progress.phase === 'walking'}
          Finding files… {progress.found.toLocaleString()}
        {:else if progress.phase === 'finishing'}
          Checking for files that disappeared…
        {:else}
          {progress.processed.toLocaleString()} / {progress.found.toLocaleString()}
        {/if}
      </div>
    </div>
  {/if}

  {#if results.length > 0}
    <div class="results">
      <div class="filters">
        <button class:sel={filter === 'all'} onclick={() => (filter = 'all')}>
          All <span class="n">{results.length.toLocaleString()}</span>
        </button>
        {#each OUTCOMES as o (o.id)}
          {#if tally[o.id]}
            <button class="{o.id}" class:sel={filter === o.id} onclick={() => (filter = o.id)}>
              {o.label} <span class="n">{tally[o.id]!.toLocaleString()}</span>
            </button>
          {/if}
        {/each}
        <span class="grow"></span>
        <label class="follow">
          <input type="checkbox" bind:checked={follow} disabled={!scanning} /> Follow
        </label>
      </div>

      <div
        class="body"
        bind:this={body}
        bind:clientHeight={viewport}
        onscroll={(e) => {
          scrollTop = e.currentTarget.scrollTop
          // Scrolling up by hand means the user wants to read, not chase the tail.
          if (scanning && e.currentTarget.scrollTop + e.currentTarget.clientHeight
              < e.currentTarget.scrollHeight - 8) follow = false
        }}
      >
        <div class="spacer" style:height="{win.totalPx}px">
          <div class="rows" style:transform="translateY({win.offsetPx}px)">
            {#each slice as r, i (win.start + i)}
              <div class="row" style:height="{ROW}px">
                <span class="badge {r.outcome}">{r.outcome}</span>
                <span class="file" title={r.path}>{short(r.path)}</span>
                <span class="why">{r.detail ?? ''}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if error}<p class="note err">{error}</p>{/if}

  {#if report}
    <div class="report">
      <p>
        Scanned <strong>{report.filesFound.toLocaleString()}</strong> files in
        {seconds(report.durationMs)} —
        <strong>{report.tracksCreated.toLocaleString()}</strong> new,
        <strong>{report.tracksMatched.toLocaleString()}</strong> already known,
        <strong>{report.filesSkipped.toLocaleString()}</strong> unchanged.
      </p>
      {#if report.movesDetected > 0}
        <p class="note">
          {report.movesDetected} moved or renamed file{report.movesDetected === 1 ? '' : 's'}
          recognised by audio content, keeping ratings and play history.
        </p>
      {/if}
      {#if report.markedMissing > 0}
        <p class="note warn">
          {report.markedMissing} file{report.markedMissing === 1 ? '' : 's'} no longer on disk.
          Flagged as missing; their tracks and statistics are kept.
        </p>
      {/if}
      {#if report.errors.length > 0}
        <p class="note warn">{report.errors.length} file(s) could not be read:</p>
        <ul class="errors">
          {#each report.errors.slice(0, 5) as e (e.path)}
            <li><code>{short(e.path)}</code> — {e.message}</li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</section>

<style>
  .scan { display: grid; gap: var(--space-4); max-width: 70ch; }

  header { display: grid; gap: var(--space-2); }
  h2 { margin: 0; font-size: var(--font-size-lg); color: var(--text-heading); }
  .lead { margin: 0; font-size: var(--font-size-sm); color: var(--text-secondary); }

  .roots { display: grid; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }

  .roots li {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-2) var(--space-3);
    background: var(--surface-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
  }

  code { font-family: var(--font-mono); font-size: var(--font-size-sm); word-break: break-all; }
  .when { font-size: var(--font-size-sm); color: var(--text-tertiary); white-space: nowrap; }

  .actions { display: flex; gap: var(--space-3); }

  button {
    height: var(--control-height);
    padding: 0 var(--space-4);
    font: inherit;
    color: var(--text-body);
    background: var(--surface-default);
    border: 1px solid var(--border-control);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  button:hover:not(:disabled) { border-color: var(--border-focus); }
  button:disabled { opacity: 0.5; cursor: default; }
  .primary { color: var(--text-on-fill); background: var(--accent); border-color: transparent; }
  .remove { height: var(--control-height-sm); font-size: var(--font-size-sm); }

  .progress { display: grid; gap: var(--space-2); }

  .bar {
    height: 6px;
    overflow: hidden;
    background: var(--media-progress-track);
    border-radius: var(--radius-full);
  }

  .fill {
    height: 100%;
    background: var(--media-progress);
    transition: width var(--transition-base);
  }

  .detail { display: flex; gap: var(--space-3); font-size: var(--font-size-sm); color: var(--text-tertiary); }

  .results {
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 0;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    padding: var(--space-2) var(--space-3);
    background: var(--column-header);
    border-bottom: 1px solid var(--border-default);
  }

  .filters button {
    height: var(--control-height-sm);
    padding: 0 var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-full);
    cursor: pointer;
  }

  .filters button.sel {
    color: var(--text-on-fill);
    background: var(--accent);
    border-color: transparent;
  }

  .filters .n { font-variant-numeric: tabular-nums; opacity: 0.75; }
  .grow { flex: 1; }

  .follow {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    font-size: var(--font-size-sm);
    color: var(--text-tertiary);
  }

  .body { height: 320px; overflow-y: auto; }
  .spacer { position: relative; }
  .rows { position: absolute; inset-inline: 0; top: 0; will-change: transform; }

  .row {
    display: grid;
    grid-template-columns: 76px 1fr 180px;
    gap: var(--space-3);
    align-items: center;
    padding: 0 var(--space-3);
    font-size: var(--font-size-sm);
  }

  .row:hover { background: var(--row-hover); }

  .badge {
    justify-self: start;
    padding: 1px var(--space-2);
    font-size: 11px;
    text-transform: capitalize;
    border-radius: var(--radius-full);
    color: var(--text-secondary);
    background: var(--surface-secondary);
  }

  .badge.new { color: var(--status-success); background: color-mix(in srgb, var(--status-success) 14%, transparent); }
  .badge.moved { color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }
  .badge.error { color: var(--status-danger); background: color-mix(in srgb, var(--status-danger) 14%, transparent); }
  .badge.missing { color: var(--status-warning-text); background: color-mix(in srgb, var(--status-warning) 16%, transparent); }

  .file {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
    color: var(--text-body);
  }

  .why {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-tertiary);
  }

  .note { margin: 0; font-size: var(--font-size-sm); color: var(--text-tertiary); }
  .note.warn { color: var(--status-warning-text); }
  .note.err { color: var(--status-danger); }

  .report {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    background: color-mix(in srgb, var(--status-success) 10%, transparent);
    border-radius: var(--radius-md);
  }

  .report p { margin: 0; }
  .errors { margin: 0; padding-left: var(--space-5); font-size: var(--font-size-sm); color: var(--text-tertiary); }
</style>
