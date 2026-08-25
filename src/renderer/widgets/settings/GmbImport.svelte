<script lang="ts">
  import { ipc } from '../../lib/ipc'
  import { onMount } from 'svelte'
  import type { GmbPreview, ImportReport } from '@shared/ipc'
  import { library } from '../../stores/library.svelte'

  let { ondone }: { ondone?: () => void } = $props()

  let path = $state('')
  let preview = $state<GmbPreview | null>(null)
  let report = $state<ImportReport | null>(null)
  let busy = $state(false)
  let error = $state<string | null>(null)

  let statistics = $state(true)
  let labels = $state(true)
  let playlists = $state(true)

  onMount(async () => {
    try {
      path = await ipc('import:gmbDefaultPath')
      await check()
    } catch (err) {
      error = `Could not reach the main process: ${(err as Error).message}`
    }
  })

  async function check(): Promise<void> {
    if (!path) return
    try {
      error = null
      preview = await ipc('import:gmbPreview', path)
    } catch (err) {
      error = (err as Error).message
    }
  }

  async function browse(): Promise<void> {
    try {
      const picked = await ipc('import:gmbBrowse')
      if (picked) {
        path = picked
        await check()
      }
    } catch (err) {
      error = (err as Error).message
    }
  }

  async function run(): Promise<void> {
    busy = true
    error = null
    try {
      report = await ipc('import:gmbRun', { path, statistics, labels, playlists })
      await library.refresh()
    } catch (err) {
      error = (err as Error).message
    } finally {
      busy = false
    }
  }

  async function reset(): Promise<void> {
    busy = true
    try {
      await ipc('library:reset')
      report = null
      await library.refresh()
    } finally {
      busy = false
    }
  }
</script>

<section class="import">
  <header>
    <h2>gmusicbrowser</h2>
    <p class="lead">
      Imports ratings, play counts, full play history, genres, groupings, labels and saved lists.
      Your music files are only ever read.
    </p>
  </header>

  <div class="row">
    <label for="gmbrc">Configuration file</label>
    <input id="gmbrc" bind:value={path} onchange={check} spellcheck="false" />
    <button onclick={browse}>Browse…</button>
  </div>

  {#if preview && !preview.exists}
    <p class="note warn">No file at that path. gmusicbrowser keeps it at
      <code>~/.config/gmusicbrowser/gmbrc</code> by default.</p>
  {:else if preview?.error}
    <p class="note err">Could not parse: {preview.error}</p>
  {:else if preview}
    <div class="preview">
      <div><strong>{preview.songs.toLocaleString()}</strong><span>songs</span></div>
      <div><strong>{preview.playHistoryEntries.toLocaleString()}</strong><span>play events</span></div>
      <div><strong>{preview.savedLists}</strong><span>saved lists</span></div>
      <div><strong>{preview.savedFilters}</strong><span>saved filters</span></div>
    </div>
    {#if preview.baseFolder}
      <p class="note">Music root: <code>{preview.baseFolder}</code>{#if preview.version} · gmbrc {preview.version}{/if}</p>
    {/if}
    {#if preview.unmappedColumns.length}
      <p class="note warn">Unrecognised columns will be ignored: {preview.unmappedColumns.join(', ')}</p>
    {/if}

    <div class="opts">
      <label><input type="checkbox" bind:checked={statistics} /> Ratings, play counts and history</label>
      <label><input type="checkbox" bind:checked={labels} /> Genres, groupings and labels</label>
      <label><input type="checkbox" bind:checked={playlists} /> Saved lists as playlists</label>
    </div>

    <div class="actions">
      <button class="primary" disabled={busy || preview.songs === 0} onclick={run}>
        {busy ? 'Importing…' : `Import ${preview.songs.toLocaleString()} songs`}
      </button>
      <button disabled={busy} onclick={reset}>Clear library</button>
      <span class="readonly">Reads only — your music files are never modified.</span>
    </div>
  {/if}

  {#if error}<p class="note err">{error}</p>{/if}

  {#if report}
    <div class="report">
      <p>
        Imported <strong>{report.tracksCreated.toLocaleString()}</strong> tracks and
        <strong>{report.mediaCreated.toLocaleString()}</strong> files,
        with <strong>{report.playHistoryRows.toLocaleString()}</strong> play events and
        <strong>{report.playlistsCreated}</strong> playlists.
      </p>
      {#each report.notes as note (note)}
        <p class="note">{note}</p>
      {/each}

      <button class="primary big" onclick={ondone}>Show my library →</button>
    </div>
  {/if}
</section>

<style>
  .import { display: grid; gap: var(--space-4); max-width: 70ch; }

  header { display: grid; gap: var(--space-2); }
  h2 { margin: 0; font-size: var(--font-size-lg); color: var(--text-heading); }
  .lead { margin: 0; font-size: var(--font-size-sm); color: var(--text-secondary); }

  .row { display: grid; grid-template-columns: auto 1fr auto; gap: var(--space-3); align-items: center; }

  label { font-size: var(--font-size-sm); color: var(--text-secondary); }

  input:not([type='checkbox']) {
    height: var(--control-height);
    padding: 0 var(--space-3);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-body);
    background: var(--surface-default);
    border: 1px solid var(--border-control);
    border-radius: var(--radius-md);
  }

  input:focus { border-color: var(--border-focus); outline: none; box-shadow: 0 0 0 3px var(--focus-ring); }

  .preview { display: flex; gap: var(--space-6); }
  .preview div { display: grid; }
  .preview strong { font-size: var(--font-size-lg); color: var(--text-heading); font-variant-numeric: tabular-nums; }
  .preview span { font-size: var(--font-size-sm); color: var(--text-tertiary); }

  .opts { display: flex; gap: var(--space-5); flex-wrap: wrap; }
  .opts label { display: flex; gap: var(--space-2); align-items: center; color: var(--text-body); }

  .actions { display: flex; gap: var(--space-3); align-items: center; }

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

  .readonly { font-size: var(--font-size-sm); color: var(--status-success); }

  .note { margin: 0; font-size: var(--font-size-sm); color: var(--text-tertiary); }
  .note.warn { color: var(--status-warning-text); }
  .note.err { color: var(--status-danger); }

  code { font-family: var(--font-mono); }

  .report {
    padding: var(--space-3);
    background: color-mix(in srgb, var(--status-success) 10%, transparent);
    border-radius: var(--radius-md);
  }

  .report p { margin: 0 0 var(--space-2); }
  .big { margin-top: var(--space-2); height: var(--control-height-lg); }
</style>
