<script lang="ts">
  const sections = [
    { title: 'Library', items: ['All tracks', 'Albums', 'Artists', 'Genres', 'Recently added'] },
    { title: 'Smart playlists', items: ['Neglected gems', 'Top rated', 'Never played'] },
    { title: 'Playlists', items: [] as string[] },
    { title: 'Queue', items: [] as string[] }
  ]

  let active = $state('All tracks')
</script>

<nav class="sidebar" aria-label="Library navigation">
  <div class="brand">Anthem</div>

  {#each sections as section (section.title)}
    <div class="section">
      <div class="section-title">{section.title}</div>
      {#if section.items.length}
        <ul>
          {#each section.items as item (item)}
            <li>
              <button class:active={active === item} onclick={() => (active = item)}>{item}</button>
            </li>
          {/each}
        </ul>
      {:else}
        <div class="empty">None yet</div>
      {/if}
    </div>
  {/each}
</nav>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-4) var(--space-3);
    overflow-y: auto;
    background: var(--surface-navigation);
    color: var(--text-on-navigation);
  }

  .brand {
    padding: 0 var(--space-3) var(--space-2);
    font-size: var(--font-size-lg);
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--text-heading);
  }

  .section-title {
    padding: 0 var(--space-3) var(--space-2);
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-tertiary);
  }

  ul { margin: 0; padding: 0; list-style: none; }

  button {
    display: block;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    font: inherit;
    text-align: left;
    color: var(--text-on-navigation);
    background: transparent;
    border: 0;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  button:hover { background: var(--surface-navigation-hover); }

  button.active {
    color: var(--text-on-fill);
    background: var(--accent);
  }

  .empty {
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--text-tertiary);
  }
</style>
