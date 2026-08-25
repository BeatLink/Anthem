<script lang="ts">
  // Everything Anthem knows about one track. This is the first place the entity model is visible:
  // a track is a piece of music, and the files are sources hanging off it (DESIGN-SPEC §6.5).

  import { onMount } from 'svelte'
  import type { TrackDetails } from '@shared/ipc'
  import { ipc } from '../lib/ipc'
  import Page from '../lib/Page.svelte'
  import Stars from './Stars.svelte'

  let { trackId, onclose }: { trackId: number; onclose?: () => void } = $props()

  let details = $state<TrackDetails | null>(null)
  let error = $state<string | null>(null)
  let section = $state<'overview' | 'sources' | 'tags' | 'history'>('overview')

  onMount(async () => {
    try {
      details = await ipc('tracks:details', trackId)
      if (!details) error = 'This track no longer exists.'
    } catch (err) {
      error = (err as Error).message
    }
  })

  const when = (ms: number | null): string =>
    ms === null || ms === 0 ? 'never' : new Date(ms).toLocaleString()

  const bytes = (n: number | null): string => {
    if (n === null) return '—'
    const units = ['B', 'KB', 'MB', 'GB']
    let v = n
    let u = 0
    while (v >= 1024 && u < units.length - 1) { v /= 1024; u++ }
    return `${v.toFixed(u === 0 ? 0 : 1)} ${units[u]}`
  }

  const mmss = (ms: number | null): string => {
    if (ms === null) return '—'
    const s = Math.round(ms / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = String(s % 60).padStart(2, '0')
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
  }

  /** Plain language for how this track came to be one track. */
  const identityExplanation = (source: string): string => ({
    manual: 'Merged or split by hand. Automated passes leave it alone.',
    mbid: 'Identified by its MusicBrainz recording id.',
    acoustid: 'Identified by an acoustic fingerprint.',
    audio_hash: 'Identified by matching audio content.',
    heuristic: 'Grouped by its path and tags; no stronger evidence was available.'
  }[source] ?? source)

  const hashExplanation = (algo: string | null): string => ({
    'flac-streaminfo-md5': "FLAC's own checksum of the decoded audio. Exact, and free to read.",
    'sha256-frames': 'Hashed over the audio frames with tag regions excluded, so retagging does not change it.',
    'sha256-file': 'Hashed over the whole file, so editing tags will change it. Weaker for move detection.'
  }[algo ?? ''] ?? 'Not hashed yet; scan this folder to enable move detection.')

  const totalPlays = $derived(details?.history.filter((h) => h.kind === 'play').length ?? 0)
  const totalSkips = $derived(details?.history.filter((h) => h.kind === 'skip').length ?? 0)
</script>

<Page
  title={details?.title ?? 'Track'}
  subtitle={details
    ? `${details.media.length} source${details.media.length === 1 ? '' : 's'} · ` +
      `${details.statistics.playCount} play${details.statistics.playCount === 1 ? '' : 's'}`
    : undefined}
  {onclose}
>
  {#snippet nav()}
    {#each [
      { id: 'overview', label: 'Overview' },
      { id: 'sources', label: `Sources (${details?.media.length ?? 0})` },
      { id: 'tags', label: 'Raw tags' },
      { id: 'history', label: 'History' }
    ] as s (s.id)}
      <button class:active={section === s.id} onclick={() => (section = s.id as never)}>
        {s.label}
      </button>
    {/each}
  {/snippet}

  {#if error}
    <p class="note err">{error}</p>
  {:else if !details}
    <p class="note">Loading…</p>
  {:else if section === 'overview'}
    <section>
      <h2>Metadata</h2>
      <dl>
        {#each details.fields as f (f.field)}
          {#if f.value !== null}
            <dt>{f.name}{#if f.multi}<span class="multi">set</span>{/if}</dt>
            <dd>{f.field === 'length' ? mmss(Number(f.value)) : f.value}</dd>
          {/if}
        {/each}
      </dl>

      <h2>Identity</h2>
      <p class="hint">{identityExplanation(details.identity.source)}</p>
      <dl>
        <dt>Decided by</dt><dd><code>{details.identity.source}</code></dd>
        <dt>Pinned</dt>
        <dd>{details.identity.pinned ? 'Yes — a person decided this' : 'No'}</dd>
        {#if details.identity.mbRecordingId}
          <dt>MusicBrainz</dt><dd><code>{details.identity.mbRecordingId}</code></dd>
        {/if}
        {#if details.identity.acoustid}
          <dt>AcoustID</dt><dd><code>{details.identity.acoustid}</code></dd>
        {/if}
        {#if details.identity.key}
          <dt>Match key</dt><dd><code class="key">{details.identity.key}</code></dd>
        {/if}
      </dl>

      <h2>Statistics</h2>
      <p class="hint">These belong to the track, not to any one file, so they survive a re-rip.</p>
      <dl>
        <dt>Rating</dt>
        <dd><Stars value={details.statistics.rating} /></dd>
        <dt>Plays</dt><dd>{details.statistics.playCount}</dd>
        <dt>Skips</dt><dd>{details.statistics.skipCount}</dd>
        <dt>First played</dt><dd>{when(details.statistics.firstPlayed)}</dd>
        <dt>Last played</dt><dd>{when(details.statistics.lastPlayed)}</dd>
        <dt>Added</dt><dd>{when(details.statistics.added)}</dd>
      </dl>

      {#if details.loudness.rgTrackGain !== null || details.loudness.rgAlbumGain !== null}
        <h2>Loudness</h2>
        <dl>
          <dt>Track gain</dt><dd>{details.loudness.rgTrackGain ?? '—'} dB</dd>
          <dt>Album gain</dt><dd>{details.loudness.rgAlbumGain ?? '—'} dB</dd>
        </dl>
      {/if}

      {#if details.merges.length}
        <h2>Merge history</h2>
        {#each details.merges as m (m.batchId)}
          <p class="hint">
            Absorbed {m.absorbed} track{m.absorbed === 1 ? '' : 's'} on {when(m.at)}
            — <code>{m.batchId}</code>
          </p>
        {/each}
      {/if}
    </section>

  {:else if section === 'sources'}
    <section>
      <h2>Sources</h2>
      <p class="hint">
        Every file or stream backing this track. The preferred one is what plays; the rest are kept
        so nothing is lost when formats or drives change.
      </p>

      {#each details.media as m (m.id)}
        <article class="source" class:missing={!m.present}>
          <header>
            {#if m.preferred}<span class="tag pref">plays</span>{/if}
            {#if !m.present}<span class="tag gone">missing</span>{/if}
            <span class="codec">{(m.codec ?? m.kind).toUpperCase()}</span>
            <span class="path" title={m.uri}>{m.uri}</span>
            <button onclick={() => ipc('tracks:reveal', m.uri)} disabled={!m.present}>
              Show in folder
            </button>
          </header>

          <dl class="tech">
            <dt>Bitrate</dt><dd>{m.bitrate ? `${m.bitrate} kbps` : '—'}{m.bitrateMode ? ` ${m.bitrateMode}` : ''}</dd>
            <dt>Sample rate</dt><dd>{m.samplerate ? `${m.samplerate} Hz` : '—'}</dd>
            <dt>Channels</dt><dd>{m.channels ?? '—'}</dd>
            <dt>Bit depth</dt><dd>{m.bitsPerSample ?? '—'}</dd>
            <dt>Size</dt><dd>{bytes(m.filesize)}</dd>
            <dt>Modified</dt><dd>{when(m.mtime)}</dd>
            <dt>Last seen</dt><dd>{when(m.lastSeen)}</dd>
            <dt>Quality rank</dt><dd>{m.qualityRank}</dd>
            {#if m.startMs !== null || m.endMs !== null}
              <dt>Range</dt>
              <dd>{mmss(m.startMs)} – {mmss(m.endMs)} (index {m.subtrackIndex})</dd>
            {/if}
          </dl>

          <div class="hash">
            <span class="hlabel">Audio hash</span>
            <code>{m.audioHashHex ? `${m.audioHashHex.slice(0, 32)}…` : 'none'}</code>
            <span class="halgo">{m.audioHashAlgo ?? ''}</span>
            <p class="hint">{hashExplanation(m.audioHashAlgo)}</p>
          </div>
        </article>
      {:else}
        <p class="note">
          No sources. The track and its statistics are kept; add the files back and a scan will
          reattach them.
        </p>
      {/each}
    </section>

  {:else if section === 'tags'}
    <section>
      <h2>Raw tags, per source</h2>
      <p class="hint">
        What each file actually carries. Two files backing one track can disagree, and Anthem stores
        both rather than losing the disagreement.
      </p>

      {#each details.media as m (m.id)}
        <article class="source">
          <header><span class="path" title={m.uri}>{m.uri}</span></header>
          {#if m.tags.length}
            <dl>
              {#each m.tags as t, i (`${t.field}-${i}`)}
                <dt>{t.field}</dt><dd>{t.value}</dd>
              {/each}
            </dl>
          {:else}
            <p class="note">
              No raw tags stored. The gmusicbrowser import records values on the track rather than
              per file; a scan fills these in.
            </p>
          {/if}
        </article>
      {/each}
    </section>

  {:else}
    <section>
      <h2>Play history</h2>
      <p class="hint">
        {details.historyTotal} recorded event{details.historyTotal === 1 ? '' : 's'}
        {#if details.historyTotal > details.history.length}
          — showing the most recent {details.history.length}
        {/if}
        · {totalPlays} played, {totalSkips} skipped
      </p>

      {#if details.history.length}
        <ul class="history">
          {#each details.history as h, i (`${h.at}-${i}`)}
            <li>
              <span class="kind {h.kind}">{h.kind}</span>
              <span>{when(h.at)}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="note">Never played.</p>
      {/if}
    </section>
  {/if}
</Page>

<style>
  section { display: grid; gap: var(--space-2); max-width: 90ch; }

  h2 {
    margin: var(--space-5) 0 var(--space-1);
    font-size: var(--font-size-md);
    color: var(--text-heading);
  }

  h2:first-child { margin-top: 0; }

  dl {
    display: grid;
    grid-template-columns: 150px 1fr;
    gap: var(--space-1) var(--space-4);
    margin: 0;
    font-size: var(--font-size-sm);
  }

  dt { color: var(--text-tertiary); display: flex; gap: var(--space-2); align-items: center; }
  dd { margin: 0; min-width: 0; color: var(--text-body); word-break: break-word; }

  .multi {
    padding: 0 var(--space-2);
    font-size: 10px;
    text-transform: uppercase;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    border-radius: var(--radius-full);
  }

  .hint, .note { margin: 0; font-size: var(--font-size-sm); color: var(--text-tertiary); }
  .note.err { color: var(--status-danger); }

  code { font-family: var(--font-mono); font-size: var(--font-size-sm); word-break: break-all; }
  .key { color: var(--text-tertiary); }

  .source {
    display: grid;
    gap: var(--space-3);
    margin-top: var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
  }

  .source.missing { border-color: var(--status-warning); }

  .source header {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    min-width: 0;
  }

  .tag {
    padding: 1px var(--space-2);
    font-size: 10px;
    text-transform: uppercase;
    border-radius: var(--radius-full);
  }

  .pref { color: var(--status-success); background: color-mix(in srgb, var(--status-success) 14%, transparent); }
  .gone { color: var(--status-warning-text); background: color-mix(in srgb, var(--status-warning) 16%, transparent); }

  .codec { font-size: 11px; color: var(--text-tertiary); }

  .path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
  }

  .source header button {
    height: var(--control-height-sm);
    padding: 0 var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-full);
    cursor: pointer;
  }

  .source header button:disabled { opacity: 0.4; cursor: default; }

  .tech { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
  .tech dt { grid-column: auto; }

  .hash { display: grid; gap: var(--space-1); }
  .hlabel { font-size: var(--font-size-sm); color: var(--text-tertiary); }
  .halgo { font-size: 11px; color: var(--accent); }

  .history { display: grid; gap: 1px; margin: var(--space-2) 0 0; padding: 0; list-style: none; }

  .history li {
    display: grid;
    grid-template-columns: 60px 1fr;
    gap: var(--space-3);
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-sm);
    border-radius: var(--radius-sm);
  }

  .history li:hover { background: var(--row-hover); }

  .kind { font-size: 10px; text-transform: uppercase; color: var(--text-tertiary); }
  .kind.play { color: var(--status-success); }
  .kind.skip { color: var(--status-warning-text); }
</style>
