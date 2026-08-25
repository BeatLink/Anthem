<script lang="ts">
  // Sources side by side, one column each, one row per field — so a disagreement reads as a diff
  // rather than as a list of options. Resolution stays per field, following Thunderbird CardBook.

  import { onMount } from 'svelte'
  import type { MergePreview, MergeResult, Resolution } from '@shared/ipc'
  import { ipc } from '../lib/ipc'
  import { library } from '../stores/library.svelte'
  import Page from '../lib/Page.svelte'
  import { pref } from '../lib/prefs.svelte'
  import { isBoolean } from '@shared/prefs'

  let { ids, onclose }: { ids: number[]; onclose?: (merged: boolean) => void } = $props()

  let preview = $state<MergePreview | null>(null)
  let survivor = $state<number | null>(null)
  let choices = $state<Record<string, Resolution>>({})
  let busy = $state(false)
  let error = $state<string | null>(null)
  let result = $state<MergeResult | null>(null)
  let undoing = $state(false)
  const onlyDifferences = pref('merge.onlyDifferences', false, isBoolean)

  onMount(async () => {
    try {
      preview = await ipc('tracks:mergePreview', ids)
      survivor = preview.survivor
    } catch (err) {
      error = (err as Error).message
    }
  })

  const sourceIndex = (id: number): number => (preview?.ids.indexOf(id) ?? -1) + 1

  function show(v: unknown): string {
    if (v === null || v === undefined || v === '') return ''
    if (Array.isArray(v)) return v.join(', ')
    return String(v)
  }

  const valueFor = (fieldId: string, from: number): unknown => {
    const f = preview?.fields.find((x) => x.field === fieldId)
    if (!f) return null
    if (!f.conflict) return f.value
    return f.options?.find((o) => o.from === from)?.value ?? null
  }

  /** What the survivor ends up with, given the current choices. */
  function resultFor(fieldId: string): unknown {
    const f = preview?.fields.find((x) => x.field === fieldId)
    if (!f) return null
    if (!f.conflict) return f.value

    const res = choices[fieldId]
    if (res?.kind === 'value') return valueFor(fieldId, res.from)
    if (f.multi) return f.union
    return valueFor(fieldId, survivor ?? preview!.ids[0]!)
  }

  const isChosen = (fieldId: string, from: number): boolean => {
    const f = preview?.fields.find((x) => x.field === fieldId)
    if (!f?.conflict) return false
    const res = choices[fieldId]
    if (res?.kind === 'value') return res.from === from
    return !f.multi && from === survivor
  }

  const unionChosen = (fieldId: string): boolean => {
    const f = preview?.fields.find((x) => x.field === fieldId)
    if (!f?.multi || !f.conflict) return false
    const res = choices[fieldId]
    return !res || res.kind === 'union'
  }

  function pick(fieldId: string, from: number): void {
    choices = { ...choices, [fieldId]: { kind: 'value', from } }
  }

  function pickUnion(fieldId: string): void {
    choices = { ...choices, [fieldId]: { kind: 'union' } }
  }

  /** Take every field from one source at once — the "this record is simply better" shortcut. */
  function takeAll(from: number): void {
    const next: Record<string, Resolution> = { ...choices }
    for (const f of preview?.fields ?? []) if (f.conflict) next[f.field] = { kind: 'value', from }
    choices = next
    survivor = from
  }

  const visibleFields = $derived(
    (preview?.fields ?? []).filter((f) => !onlyDifferences.value || f.conflict)
  )

  const conflictCount = $derived((preview?.fields ?? []).filter((f) => f.conflict).length)

  const mediaFor = (id: number): number =>
    preview?.media.filter((m) => m.from === id).length ?? 0

  const columns = $derived(
    preview ? `170px repeat(${preview.ids.length}, minmax(180px, 1fr)) minmax(200px, 1fr)` : '1fr'
  )

  async function apply(): Promise<void> {
    if (!preview || survivor === null) return
    busy = true
    error = null
    try {
      result = await ipc('tracks:merge', { ids: preview.ids, survivor, resolutions: choices })
      await library.refresh()
    } catch (err) {
      error = (err as Error).message
    } finally {
      busy = false
    }
  }

  async function undo(): Promise<void> {
    if (!result) return
    undoing = true
    try {
      await ipc('tracks:unmerge', result.batchId)
      await library.refresh()
      onclose?.(false)
    } catch (err) {
      error = (err as Error).message
    } finally {
      undoing = false
    }
  }
</script>

<Page
  title="Merge {ids.length} tracks into one"
  subtitle={conflictCount > 0
    ? `${conflictCount} field${conflictCount === 1 ? '' : 's'} disagree — pick which value to keep`
    : 'Every field agrees; merging keeps all files under one track'}
  onclose={() => onclose?.(false)}
>
  {#snippet actions()}
    {#if !result && preview}
      <label class="toggle">
        <input type="checkbox" bind:checked={onlyDifferences.value} /> Only differences
      </label>
      <button class="primary" onclick={apply} disabled={busy || survivor === null}>
        {busy ? 'Merging…' : 'Merge'}
      </button>
    {/if}
  {/snippet}

  {#if error}
    <p class="note err">{error}</p>
  {/if}

  {#if result}
    <div class="done">
      <h2>Merged</h2>
      <p>
        One track now holds <strong>{result.mediaMoved + 1}</strong>
        {result.mediaMoved + 1 === 1 ? 'file' : 'files'}.
        {#if result.playlistEntriesRepointed > 0}
          {result.playlistEntriesRepointed} playlist entries repointed.
        {/if}
      </p>
      <div class="row-actions">
        <button onclick={undo} disabled={undoing}>{undoing ? 'Undoing…' : 'Undo this merge'}</button>
        <button class="primary" onclick={() => onclose?.(true)}>Done</button>
      </div>
    </div>
  {:else if preview}
    {#if preview.pinnedSources.length}
      <p class="note warn">
        {preview.pinnedSources.length} of these was merged or split by hand before. Merging replaces
        that decision.
      </p>
    {/if}

    <div class="grid" style:grid-template-columns={columns}>
      <!-- header: one column per source, plus the result -->
      <div class="cell head corner">Field</div>
      {#each preview.ids as id (id)}
        <div class="cell head source" class:survivor={survivor === id}>
          <div class="shead">
            <button class="pick-survivor" class:on={survivor === id} onclick={() => (survivor = id)}>
              {survivor === id ? '● Survivor' : '○ Make survivor'}
            </button>
            <span class="sname">Source {sourceIndex(id)}</span>
          </div>
          <div class="smeta">
            {mediaFor(id)} file{mediaFor(id) === 1 ? '' : 's'}
          </div>
          <button class="takeall" onclick={() => takeAll(id)}>Take all from this</button>
        </div>
      {/each}
      <div class="cell head result">Result</div>

      {#each visibleFields as f (f.field)}
        <div class="cell label" class:conflict={f.conflict}>{f.name}</div>

        {#each preview.ids as id (id)}
          {@const v = valueFor(f.field, id)}
          {@const text = show(v)}
          {#if f.conflict}
            <button
              class="cell value clickable"
              class:chosen={isChosen(f.field, id)}
              class:empty={text === ''}
              onclick={() => pick(f.field, id)}
              title={text || 'empty'}
            >{text || '—'}</button>
          {:else}
            <div class="cell value same" title={text}>{text || '—'}</div>
          {/if}
        {/each}

        <div class="cell result-cell">
          {#if f.conflict && f.multi}
            <button class="union" class:on={unionChosen(f.field)} onclick={() => pickUnion(f.field)}>
              Keep all
            </button>
          {/if}
          <span class="rval">{show(resultFor(f.field)) || '—'}</span>
        </div>
      {/each}
    </div>

    <section class="stats">
      <h2>Combined statistics</h2>
      <p class="hint">
        These are not a choice: plays and skips are summed, the highest rating wins, and play
        history is merged and deduplicated.
      </p>
      <div class="statgrid">
        <div><strong>{preview.statistics.playCount}</strong><span>plays</span></div>
        <div><strong>{preview.statistics.skipCount}</strong><span>skips</span></div>
        <div><strong>{preview.statistics.rating ?? '—'}</strong><span>rating</span></div>
      </div>
    </section>

    <section class="files">
      <h2>Files the surviving track will hold</h2>
      <ul>
        {#each preview.media as m (m.id)}
          <li>
            <span class="codec">{m.codec ?? '?'}</span>
            <span class="uri" title={m.uri}>{m.uri}</span>
            <span class="src">Source {sourceIndex(m.from)}</span>
            {#if !m.present}<span class="missing">missing</span>{/if}
          </li>
        {/each}
      </ul>
    </section>
  {:else}
    <p class="note">Loading…</p>
  {/if}
</Page>

<style>
  .grid { display: grid; border: 1px solid var(--border-default); border-radius: var(--radius-md);
          overflow: hidden; }

  .cell {
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--border-default);
    border-right: 1px solid var(--border-default);
    min-width: 0;
    font-size: var(--font-size-sm);
  }

  .head {
    background: var(--column-header);
    font-weight: 600;
    color: var(--text-secondary);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .source { display: grid; gap: var(--space-2); }
  .source.survivor { background: color-mix(in srgb, var(--accent) 10%, var(--column-header)); }

  .shead { display: flex; gap: var(--space-2); align-items: center; justify-content: space-between; }
  .sname { color: var(--text-tertiary); font-weight: 500; }
  .smeta { font-weight: 400; color: var(--text-tertiary); }

  .pick-survivor, .takeall, .union {
    height: var(--control-height-sm);
    padding: 0 var(--space-2);
    font: inherit;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    background: var(--surface-default);
    border: 1px solid var(--border-control);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .pick-survivor.on { color: var(--text-on-fill); background: var(--accent); border-color: transparent; }
  .takeall { font-weight: 400; }
  .takeall:hover, .pick-survivor:hover, .union:hover { border-color: var(--border-focus); }

  .label { color: var(--text-tertiary); background: var(--surface-secondary); }
  .label.conflict { color: var(--text-body); font-weight: 600; }

  .value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
    color: var(--text-body);
    background: transparent;
    border-top: 0;
    border-left: 0;
  }

  .value.same { color: var(--text-tertiary); }
  .value.empty { color: var(--text-tertiary); }

  .clickable { cursor: pointer; width: 100%; font: inherit; font-size: var(--font-size-sm);
               border-radius: 0; }
  .clickable:hover { background: var(--row-hover); }

  .chosen {
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    color: var(--text-heading);
    box-shadow: inset 2px 0 0 var(--accent);
  }

  .result-cell {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    border-right: 0;
    background: var(--surface-secondary);
  }

  .union.on { color: var(--text-on-fill); background: var(--accent); border-color: transparent; }
  .rval { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          color: var(--text-heading); }

  .result { border-right: 0; }
  .corner { background: var(--column-header); }

  .toggle { display: flex; gap: var(--space-2); align-items: center; font-size: var(--font-size-sm);
            color: var(--text-on-navigation); }

  h2 { margin: var(--space-6) 0 var(--space-2); font-size: var(--font-size-md);
       color: var(--text-heading); }

  .hint, .note { margin: 0; font-size: var(--font-size-sm); color: var(--text-tertiary); }
  .note.warn { color: var(--status-warning-text); }
  .note.err { color: var(--status-danger); }

  .statgrid { display: flex; gap: var(--space-6); margin-top: var(--space-3); }
  .statgrid div { display: grid; }
  .statgrid strong { font-size: var(--font-size-lg); color: var(--text-heading);
                     font-variant-numeric: tabular-nums; }
  .statgrid span { font-size: var(--font-size-sm); color: var(--text-tertiary); }

  .files ul { display: grid; gap: 2px; margin: var(--space-2) 0 0; padding: 0; list-style: none; }

  .files li {
    display: grid;
    grid-template-columns: 56px 1fr auto auto;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-sm);
    border-radius: var(--radius-sm);
  }

  .files li:nth-child(odd) { background: var(--surface-secondary); }

  .codec { color: var(--text-tertiary); text-transform: uppercase; font-size: 11px; }
  .uri { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
         font-family: var(--font-mono); }
  .src { color: var(--text-tertiary); }
  .missing { color: var(--status-warning-text); }

  .primary {
    height: var(--control-height);
    padding: 0 var(--space-5);
    font: inherit;
    color: var(--text-on-fill);
    background: var(--accent);
    border: 0;
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .primary:disabled { opacity: 0.5; cursor: default; }

  .done { display: grid; gap: var(--space-3); max-width: 60ch; }
  .done p { margin: 0; }
  .row-actions { display: flex; gap: var(--space-3); }

  .row-actions button {
    height: var(--control-height);
    padding: 0 var(--space-4);
    font: inherit;
    color: var(--text-body);
    background: var(--surface-default);
    border: 1px solid var(--border-control);
    border-radius: var(--radius-md);
    cursor: pointer;
  }
</style>
