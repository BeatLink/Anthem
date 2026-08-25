<script lang="ts">
  // Cover art for a track. Resolution is lazy in the main process, so this asks and waits; a track
  // with no art shows a stable placeholder rather than a broken image or a flicker.

  import { ipc } from '../lib/ipc'

  let {
    trackId = null,
    size = 88,
    rounded = true
  }: { trackId?: number | null; size?: number; rounded?: boolean } = $props()

  let url = $state<string | null>(null)
  let loading = $state(false)

  $effect(() => {
    const id = trackId
    url = null

    if (id === null || id === undefined) return

    let cancelled = false
    loading = true

    void ipc('art:forTrack', id)
      .then((art) => {
        // A slower earlier request must not overwrite a newer track's cover.
        if (!cancelled) url = art.url
      })
      .catch(() => { if (!cancelled) url = null })
      .finally(() => { if (!cancelled) loading = false })

    return () => { cancelled = true }
  })
</script>

<div
  class="cover"
  class:rounded
  class:empty={!url}
  style:width="{size}px"
  style:height="{size}px"
>
  {#if url}
    <img src={url} alt="" loading="lazy" />
  {:else if !loading}
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 18V5l10-2v13" fill="none" stroke="currentColor" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="6.5" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5" />
      <circle cx="16.5" cy="16" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
  {/if}
</div>

<style>
  .cover {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    overflow: hidden;
    background: var(--surface-secondary);
    border: 1px solid var(--border-default);
  }

  .rounded { border-radius: var(--radius-sm); }

  img { width: 100%; height: 100%; object-fit: cover; display: block; }

  svg { width: 45%; height: 45%; color: var(--text-tertiary); opacity: 0.55; }
</style>
