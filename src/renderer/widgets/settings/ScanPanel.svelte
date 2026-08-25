<script lang="ts">
  import { onMount } from 'svelte'
  import type { Root, ScanProgress, ScanReport } from '@shared/ipc'
  import { library } from '../../stores/library.svelte'

  let roots = $state<Root[]>([])
  let progress = $state<ScanProgress | null>(null)
  let report = $state<ScanReport | null>(null)
  let error = $state<string | null>(null)
  let scanning = $state(false)

  onMount(() => {
    void load()
    const offProgress = window.anthemEvents.on('scan:progress', (p) => (progress = p))
    const offDone = window.anthemEvents.on('scan:done', (r) => {
      report = r
      progress = null
      scanning = false
      void library.refresh()
    })
    return () => { offProgress(); offDone() }
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
    p ? (p.length > 64 ? `…${p.slice(-63)}` : p) : ''

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
          <span class="path">{short(progress.currentPath)}</span>
        {/if}
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
  .path { font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

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
