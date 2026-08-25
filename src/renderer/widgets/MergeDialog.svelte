<script lang="ts">
  // Resolution is per field, following Thunderbird CardBook: the right answer is usually spread
  // across sources rather than concentrated in one winning record.

  import { onMount } from 'svelte'
  import type { MergePreview, MergeResult, Resolution } from '@shared/ipc'
  import { library } from '../stores/library.svelte'

  let { ids, onclose }: { ids: number[]; onclose?: (merged: boolean) => void } = $props()

  let preview = $state<MergePreview | null>(null)
  let survivor = $state<number | null>(null)
  let choices = $state<Record<string, Resolution>>({})
  let busy = $state(false)
  let error = $state<string | null>(null)
  let result = $state<MergeResult | null>(null)
  let undoing = $state(false)

  onMount(async () => {
    try {
      preview = await window.anthem['tracks:mergePreview'](ids)
      survivor = preview.survivor
    } catch (err) {
      error = (err as Error).message
    }
  })

  const label = (id: number): string => {
    const n = preview?.ids.indexOf(id) ?? -1
    return n >= 0 ? `Source ${n + 1}` : `#${id}`
  }

  function show(v: unknown): string {
    if (v === null || v === undefined || v === '') return '—'
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—'
    return String(v)
  }

  function choose(fieldId: string, res: Resolution): void {
    choices = { ...choices, [fieldId]: res }
  }

  const chosen = (fieldId: string): Resolution | undefined => choices[fieldId]

  async function apply(): Promise<void> {
    if (!preview || survivor === null) return
    busy = true
    error = null
    try {
      result = await window.anthem['tracks:merge']({
        ids: preview.ids, survivor, resolutions: choices
      })
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
      await window.anthem['tracks:unmerge'](result.batchId)
      await library.refresh()
      onclose?.(false)
    } catch (err) {
      error = (err as Error).message
    } finally {
      undoing = false
    }
  }

  const unresolved = $derived(
    preview?.fields.filter((f) => f.conflict && !chosen(f.field)) ?? []
  )
</script>

<div class="backdrop">
  <button class="scrim" aria-label="Cancel merge" onclick={() => onclose?.(false)}></button>

  <div class="dialog" role="dialog" aria-modal="true" aria-label="Merge tracks">
    <header>
      <h2>Merge {ids.length} tracks into one</h2>
      <p class="lead">
        The surviving track keeps every file. Where sources disagree, pick which value to keep.
      </p>
    </header>

    {#if error}
      <p class="note err">{error}</p>
    {/if}

    {#if result}
      <div class="done">
        <p>
          Merged into one track holding <strong>{result.mediaMoved + 1}</strong>
          {result.mediaMoved + 1 === 1 ? 'file' : 'files'}.
          {#if result.playlistEntriesRepointed > 0}
            {result.playlistEntriesRepointed} playlist entries repointed.
          {/if}
        </p>
        <div class="actions">
          <button onclick={undo} disabled={undoing}>{undoing ? 'Undoing…' : 'Undo this merge'}</button>
          <button class="primary" onclick={() => onclose?.(true)}>Done</button>
        </div>
      </div>
    {:else if preview}
      {#if preview.pinnedSources.length}
        <p class="note warn">
          {preview.pinnedSources.length} of these was merged or split by hand before. Merging
          replaces that decision.
        </p>
      {/if}

      <section class="block">
        <h3>Which track survives</h3>
        <div class="survivors">
          {#each preview.ids as id (id)}
            <button class:sel={survivor === id} onclick={() => (survivor = id)}>
              {label(id)}
              <span class="sub">
                {preview.media.filter((m) => m.from === id).length} file(s)
              </span>
            </button>
          {/each}
        </div>
        <p class="hint">
          Statistics are combined regardless: plays and skips are summed, the highest rating wins,
          and play history is merged.
        </p>
      </section>

      <section class="block">
        <h3>
          Fields
          {#if unresolved.length}
            <span class="badge">{unresolved.length} to resolve</span>
          {/if}
        </h3>

        <table>
          <tbody>
            {#each preview.fields as f (f.field)}
              <tr class:conflict={f.conflict} class:unresolved={f.conflict && !chosen(f.field)}>
                <th scope="row">{f.name}</th>
                <td>
                  {#if !f.conflict}
                    <span class="agreed">{show(f.value)}</span>
                  {:else}
                    <div class="options">
                      {#if f.multi}
                        <button
                          class:sel={!chosen(f.field) || chosen(f.field)?.kind === 'union'}
                          onclick={() => choose(f.field, { kind: 'union' })}
                        >
                          <span class="from">Keep all</span>
                          <span class="val">{show(f.union)}</span>
                        </button>
                      {/if}
                      {#each f.options ?? [] as o (o.from)}
                        {#if !(Array.isArray(o.value) && o.value.length === 0)}
                          <button
                            class:sel={chosen(f.field)?.kind === 'value'
                              && (chosen(f.field) as { from: number }).from === o.from}
                            onclick={() => choose(f.field, { kind: 'value', from: o.from })}
                          >
                            <span class="from">{label(o.from)}</span>
                            <span class="val">{show(o.value)}</span>
                          </button>
                        {/if}
                      {/each}
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>

      <section class="block">
        <h3>Files the surviving track will hold</h3>
        <ul class="media">
          {#each preview.media as m (m.id)}
            <li>
              <span class="codec">{m.codec ?? '?'}</span>
              <span class="uri" title={m.uri}>{m.uri}</span>
              <span class="src">{label(m.from)}</span>
              {#if !m.present}<span class="missing">missing</span>{/if}
            </li>
          {/each}
        </ul>
      </section>

      <div class="actions">
        <button onclick={() => onclose?.(false)} disabled={busy}>Cancel</button>
        <button class="primary" onclick={apply} disabled={busy || survivor === null}>
          {busy ? 'Merging…' : 'Merge'}
        </button>
        <span class="hint">This can be undone straight afterwards.</span>
      </div>
    {:else}
      <p class="note">Loading…</p>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    padding: var(--space-6);
  }

  .scrim {
    position: absolute;
    inset: 0;
    padding: 0;
    background: var(--surface-overlay);
    border: 0;
    cursor: default;
  }

  .dialog {
    position: relative;
    display: grid;
    align-content: start;
    gap: var(--space-4);
    width: min(860px, 100%);
    max-height: min(700px, 100%);
    overflow-y: auto;
    padding: var(--space-5);
    background: var(--surface-default);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    box-shadow: 0 18px 48px var(--shadow-modal);
  }

  header { display: grid; gap: var(--space-2); }
  h2 { margin: 0; font-size: var(--font-size-lg); color: var(--text-heading); }
  h3 {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: 0 0 var(--space-2);
    font-size: var(--font-size-md);
    color: var(--text-heading);
  }

  .lead, .hint { margin: 0; font-size: var(--font-size-sm); color: var(--text-tertiary); }
  .block { display: grid; }

  .badge {
    padding: 1px var(--space-2);
    font-size: 11px;
    color: var(--text-on-fill);
    background: var(--status-warning);
    border-radius: var(--radius-full);
  }

  .survivors { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-2); }

  .survivors button {
    display: grid;
    gap: 2px;
    padding: var(--space-2) var(--space-4);
    text-align: left;
  }

  .sub { font-size: var(--font-size-sm); color: var(--text-tertiary); }
  .survivors button.sel .sub { color: var(--text-on-fill); opacity: 0.85; }

  table { width: 100%; border-collapse: collapse; }

  th {
    width: 130px;
    padding: var(--space-2) var(--space-3) var(--space-2) 0;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--text-tertiary);
    text-align: left;
    vertical-align: top;
  }

  td { padding: var(--space-1) 0; vertical-align: top; }
  tr.conflict th { color: var(--text-body); font-weight: 600; }
  tr.unresolved th::after { content: ' •'; color: var(--status-warning); }

  .agreed { color: var(--text-body); }

  .options { display: flex; flex-wrap: wrap; gap: var(--space-2); }

  .options button {
    display: grid;
    gap: 1px;
    padding: var(--space-2) var(--space-3);
    text-align: left;
    max-width: 320px;
  }

  .from { font-size: 11px; color: var(--text-tertiary); }
  .options button.sel .from { color: var(--text-on-fill); opacity: 0.8; }
  .val { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .media { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }

  .media li {
    display: grid;
    grid-template-columns: 52px 1fr auto auto;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-sm);
    border-radius: var(--radius-sm);
  }

  .media li:nth-child(odd) { background: var(--surface-secondary); }

  .codec { color: var(--text-tertiary); text-transform: uppercase; font-size: 11px; }
  .uri { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
         font-family: var(--font-mono); }
  .src { color: var(--text-tertiary); }
  .missing { color: var(--status-warning-text); }

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
  button.sel, .primary { color: var(--text-on-fill); background: var(--accent); border-color: transparent; }

  .done {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    background: color-mix(in srgb, var(--status-success) 12%, transparent);
    border-radius: var(--radius-md);
  }

  .done p { margin: 0; }

  .note { margin: 0; font-size: var(--font-size-sm); color: var(--text-tertiary); }
  .note.warn { color: var(--status-warning-text); }
  .note.err { color: var(--status-danger); }
</style>
