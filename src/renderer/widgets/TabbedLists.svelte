<script lang="ts">
  // gmb's TabbedLists(pages="+PlayList +QueueList +@song_info +PictureBrowser").
  let tab = $state<'playlist' | 'queue' | 'info' | 'pictures'>('playlist')

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
    <p class="placeholder">
      {tabs.find((t) => t.id === tab)?.label} — wired up when playback lands (M3).
    </p>
  </div>
</section>

<style>
  .tabbed { display: grid; grid-template-rows: auto 1fr; min-height: 0; }

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

  .body { overflow-y: auto; padding: var(--space-4); }
  .placeholder { margin: 0; color: var(--text-tertiary); font-size: var(--font-size-sm); }
</style>
