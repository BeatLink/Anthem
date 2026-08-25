<script lang="ts">
  // gmb's TabbedLists(pages="+PlayList +QueueList +@song_info +PictureBrowser").
  import { player } from '../stores/player.svelte'
  import { library } from '../stores/library.svelte'

  let tab = $state<'playlist' | 'queue' | 'info' | 'pictures'>('queue')

  const titleOf = (id: number): string =>
    library.tracks.find((t) => t.id === id)?.title ?? `Track ${id}`

  const artistOf = (id: number): string =>
    library.tracks.find((t) => t.id === id)?.artist ?? ''

  const tabs = [
    { id: 'playlist', label: 'Playlist' },
    { id: 'queue', label: 'Queue' },
    { id: 'info', label: 'Song info' },
    { id: 'pictures', label: 'Pictures' }
  ] as const
</script>

<section class="tabbed">
  <div class="tabs">
    {#each tabs as t (t.id)}
      <button class:active={tab === t.id} onclick={() => (tab = t.id)}>{t.label}</button>
    {/each}
  </div>
  <div class="body">
    {#if tab === 'queue'}
      {#if (player.status?.queue.length ?? 0) === 0}
        <p class="placeholder">
          Queue is empty. Select tracks and press Queue, and they play before the list resumes.
        </p>
      {:else}
        <div class="qhead">
          <span>{player.status!.queue.length} queued</span>
          <button onclick={() => player.clearQueue()}>Clear</button>
        </div>
        <ul>
          {#each player.status!.queue as id, i (`${id}-${i}`)}
            <li>
              <span class="pos">{i + 1}</span>
              <span class="qtitle" title={titleOf(id)}>{titleOf(id)}</span>
              <span class="qartist">{artistOf(id)}</span>
              <button class="drop" title="Remove" onclick={() => player.dequeue(i)}>✕</button>
            </li>
          {/each}
        </ul>
      {/if}
    {:else if tab === 'info'}
      {#if player.status?.track}
        <dl class="info">
          <dt>Title</dt><dd>{player.status.track.title ?? '—'}</dd>
          <dt>Artist</dt><dd>{player.status.track.artist ?? '—'}</dd>
          <dt>Album</dt><dd>{player.status.track.album ?? '—'}</dd>
          <dt>File</dt><dd class="path">{player.status.media?.uri ?? '—'}</dd>
        </dl>
      {:else}
        <p class="placeholder">Nothing playing.</p>
      {/if}
    {:else}
      <p class="placeholder">
        {tabs.find((t) => t.id === tab)?.label} — a later milestone.
      </p>
    {/if}
  </div>
</section>

<style>
  .tabbed { display: grid; grid-template-rows: auto 1fr; height: 100%; min-height: 0; }

  .tabs {
    display: flex;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-2) 0;
    border-bottom: 1px solid var(--border-default);
  }

  .tabs button {
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--text-tertiary);
    background: transparent;
    border: 0;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    cursor: pointer;
  }

  .tabs button.active { color: var(--text-heading); background: var(--surface-default); }

  .body { min-height: 0; overflow-y: auto; padding: var(--space-4); }
  .placeholder { margin: 0; color: var(--text-tertiary); font-size: var(--font-size-sm); }

  .qhead {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--text-tertiary);
  }

  .qhead button {
    height: var(--control-height-sm);
    padding: 0 var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-full);
    cursor: pointer;
  }

  ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 1px; }

  li {
    display: grid;
    grid-template-columns: 22px 1fr auto auto;
    gap: var(--space-2);
    align-items: center;
    height: var(--row-height);
    padding: 0 var(--space-2);
    font-size: var(--font-size-sm);
    border-radius: var(--radius-sm);
  }

  li:hover { background: var(--row-hover); }

  .pos { color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
  .qtitle { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .qartist { color: var(--text-tertiary); }

  .drop {
    width: 20px; height: 20px; padding: 0;
    color: var(--text-tertiary); background: transparent; border: 0;
    border-radius: var(--radius-sm); cursor: pointer;
  }

  .drop:hover { color: var(--status-danger); background: var(--surface-secondary); }

  .info { display: grid; grid-template-columns: auto 1fr; gap: var(--space-2) var(--space-3);
          margin: 0; font-size: var(--font-size-sm); }
  dt { color: var(--text-tertiary); }
  dd { margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .path { font-family: var(--font-mono); font-size: 11px; word-break: break-all; }
</style>
