<script lang="ts">
  import type { DuplicateGroup, DuplicateReason } from '@shared/ipc'
  import MergeDialog from '../MergeDialog.svelte'
  import { library } from '../../stores/library.svelte'

  let groups = $state<DuplicateGroup[]>([])
  let busy = $state(false)
  let ran = $state(false)
  let error = $state<string | null>(null)
  let merging = $state<number[] | null>(null)
  let tolerance = $state(3)

  const REASONS: { id: DuplicateReason; label: string; hint: string }[] = [
    { id: 'audio_hash', label: 'Identical audio', hint: 'Byte-identical content' },
    { id: 'mb_recording_id', label: 'MusicBrainz id', hint: 'Same tagged recording' },
    { id: 'tags', label: 'Matching tags', hint: 'Same artist, title and album' },
    { id: 'fuzzy', label: 'Similar', hint: 'Same artist and title, similar length' }
  ]

  let enabled = $state<Record<DuplicateReason, boolean>>({
    audio_hash: true, mb_recording_id: true, tags: true, fuzzy: true
  })

  async function find(): Promise<void> {
    busy = true
    error = null
    try {
      groups = await window.anthem['tracks:duplicates']({
        reasons: REASONS.map((r) => r.id).filter((r) => enabled[r]),
        lengthToleranceMs: tolerance * 1000
      })
      ran = true
    } catch (err) {
      error = (err as Error).message
    } finally {
      busy = false
    }
  }

  const mmss = (ms: number | null): string => {
    if (ms === null) return '—'
    const s = Math.round(ms / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  const total = $derived(groups.reduce((n, g) => n + g.members.length, 0))
</script>

<section class="dupes">
  <header>
    <h2>Find duplicates</h2>
    <p class="lead">
      Anthem never merges automatically. This proposes groups with its reasoning; you decide.
    </p>
  </header>

  <div class="opts">
    {#each REASONS as r (r.id)}
      <label title={r.hint}>
        <input type="checkbox" bind:checked={enabled[r.id]} /> {r.label}
      </label>
    {/each}
    <label class="tol">
      Length tolerance
      <input type="number" min="0" max="60" bind:value={tolerance} /> s
    </label>
  </div>

  <div class="actions">
    <button class="primary" onclick={find} disabled={busy}>
      {busy ? 'Searching…' : 'Find duplicates'}
    </button>
    {#if ran && !busy}
      <span class="hint">
        {groups.length} group{groups.length === 1 ? '' : 's'} · {total} tracks
      </span>
    {/if}
  </div>

  {#if error}<p class="note err">{error}</p>{/if}

  {#if ran && groups.length === 0 && !busy}
    <p class="note">No duplicates found with these settings.</p>
  {/if}

  <div class="groups">
    {#each groups as g (g.key)}
      <article class="group {g.confidence}">
        <div class="ghead">
          <span class="conf {g.confidence}">{g.confidence}</span>
          <span class="why">{g.explanation}</span>
          <button class="merge" onclick={() => (merging = g.members.map((m) => m.trackId))}>
            Review &amp; merge
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Title</th><th>Artist</th><th>Album</th>
              <th class="num">Length</th><th class="num">Rating</th>
              <th class="num">Plays</th><th class="num">Files</th><th>Formats</th>
            </tr>
          </thead>
          <tbody>
            {#each g.members as m (m.trackId)}
              <tr>
                <td>{m.title ?? '—'}</td>
                <td>{m.artist ?? '—'}</td>
                <td>{m.album ?? '—'}</td>
                <td class="num">{mmss(m.lengthMs)}</td>
                <td class="num">{m.rating ?? '—'}</td>
                <td class="num">{m.playCount}</td>
                <td class="num">{m.mediaCount}</td>
                <td>{m.codecs ?? '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </article>
    {/each}
  </div>
</section>

{#if merging}
  <MergeDialog
    ids={merging}
    onclose={(merged) => {
      merging = null
      if (merged) {
        void library.refresh()
        void find()
      }
    }}
  />
{/if}

<style>
  .dupes { display: grid; gap: var(--space-4); }

  header { display: grid; gap: var(--space-2); }
  h2 { margin: 0; font-size: var(--font-size-lg); color: var(--text-heading); }
  .lead, .hint { margin: 0; font-size: var(--font-size-sm); color: var(--text-tertiary); }

  .opts { display: flex; flex-wrap: wrap; gap: var(--space-4); align-items: center; }
  label { display: flex; gap: var(--space-2); align-items: center; font-size: var(--font-size-sm); }
  .tol input { width: 56px; height: var(--control-height-sm); }

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

  button:disabled { opacity: 0.5; cursor: default; }
  .primary { color: var(--text-on-fill); background: var(--accent); border-color: transparent; }

  .groups { display: grid; gap: var(--space-3); }

  .group {
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .ghead {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-2) var(--space-3);
    background: var(--surface-secondary);
    border-bottom: 1px solid var(--border-default);
  }

  .conf {
    padding: 1px var(--space-2);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-radius: var(--radius-full);
    color: var(--text-secondary);
    background: var(--surface-default);
  }

  .conf.certain { color: var(--status-success); background: color-mix(in srgb, var(--status-success) 14%, transparent); }
  .conf.likely { color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }
  .conf.possible { color: var(--status-warning-text); background: color-mix(in srgb, var(--status-warning) 16%, transparent); }

  .why { font-size: var(--font-size-sm); color: var(--text-secondary); }
  .merge { height: var(--control-height-sm); font-size: var(--font-size-sm); }

  table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
  th { text-align: left; font-weight: 500; color: var(--text-tertiary); }
  th, td { padding: var(--space-1) var(--space-3); }
  td { color: var(--text-body); }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:hover { background: var(--row-hover); }

  .note { margin: 0; font-size: var(--font-size-sm); color: var(--text-tertiary); }
  .note.err { color: var(--status-danger); }
</style>
