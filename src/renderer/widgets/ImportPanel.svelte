<script lang="ts">
  import type { GmbPreview, ImportReport } from '@shared/ipc'
  import { library } from '../stores/library.svelte'

  let { onclose }: { onclose?: () => void } = $props()

  let path = $state('')
  let preview = $state<GmbPreview | null>(null)
  let report = $state<ImportReport | null>(null)
  let busy = $state(false)
  let error = $state<string | null>(null)

  let statistics = $state(true)
  let labels = $state(true)
  let playlists = $state(true)

  $effect(() => {
    void (async () => {
      path = await window.anthem['import:gmbDefaultPath']()
      await check()
    })()
  })

  async function check(): Promise<void> {
    if (!path) return
    error = null
    preview = await window.anthem['import:gmbPreview'](path)
  }

  async function browse(): Promise<void> {
    const picked = await window.anthem['import:gmbBrowse']()
    if (picked) {
      path = picked
      await check()
    }
  }

  async function run(): Promise<void> {
    busy = true
    error = null
    try {
      report = await window.anthem['import:gmbRun']({ path, statistics, labels, playlists })
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
      await window.anthem['library:reset']()
      report = null
      await library.refresh()
    } finally {
      busy = false
    }
  }
</script>

<section class="import">
  <header>
    <h2>Import from gmusicbrowser</h2>
    <button class="close" onclick={onclose} aria-label="Close">✕</button>
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
    </div>
  {/if}
</section>

<style>
  .import {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    background: var(--surface-secondary);
    border-bottom: 1px solid var(--border-default);
  }

  header { display: flex; align-items: center; }
  h2 { margin: 0; font-size: var(--font-size-lg); color: var(--text-heading); flex: 1; }

  .close {
    width: var(--control-height);
    height: var(--control-height);
    color: var(--text-tertiary);
    background: transparent;
    border: 0;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .close:hover { background: var(--surface-navigation-hover); color: var(--text-body); }

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
  .report p:last-child { margin-bottom: 0; }
</style>
