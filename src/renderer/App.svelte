<script lang="ts">
  import { onMount } from 'svelte'
  import type { AppInfo } from '@shared/ipc'
  import { library } from './stores/library.svelte'
  import Sidebar from './widgets/Sidebar.svelte'
  import SongList from './widgets/SongList.svelte'
  import FilterPane from './widgets/FilterPane.svelte'
  import PlayerBar from './widgets/PlayerBar.svelte'

  let info = $state<AppInfo | null>(null)
  let theme = $state<'light' | 'dark' | 'system'>('system')

  onMount(async () => {
    info = await window.anthem['app:info']()
    await library.refresh()
  })

  $effect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  })

  function cycleTheme(): void {
    theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
  }
</script>

<div class="shell">
  <Sidebar />

  <main class="content">
    <header class="topbar">
      <input class="search" type="search" placeholder="Search library…" aria-label="Search library" />
      <span class="spacer"></span>
      <button class="ghost" onclick={cycleTheme} title="Theme: {theme}">
        {theme === 'dark' ? '◐' : theme === 'light' ? '◑' : '◒'} {theme}
      </button>
    </header>

    <div class="panes">
      <FilterPane />
      <SongList />
    </div>

    <footer class="status">
      {#if library.error}
        <span class="err">{library.error}</span>
      {:else if library.stats}
        <span>{library.stats.tracks.toLocaleString()} tracks</span>
        <span>·</span>
        <span>{library.stats.media.toLocaleString()} media</span>
        <span>·</span>
        <span>{library.stats.albums.toLocaleString()} albums</span>
        <span>·</span>
        <span>schema v{library.stats.schemaVersion}</span>
      {/if}
      <span class="spacer"></span>
      {#if info}
        <span class="dim">Electron {info.electron} · Chromium {info.chrome} · Node {info.node}</span>
      {/if}
    </footer>
  </main>
</div>

<PlayerBar />

<style>
  .shell {
    display: grid;
    grid-template-columns: 260px 1fr;
    height: calc(100% - 64px);
    background: var(--surface-root);
  }

  .content {
    display: grid;
    grid-template-rows: auto 1fr auto;
    min-width: 0;
    background: var(--surface-default);
    border-left: 1px solid var(--border-default);
  }

  .topbar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border-default);
  }

  .search {
    width: min(420px, 50%);
    height: var(--control-height);
    padding: 0 var(--space-3);
    font: inherit;
    color: var(--text-body);
    background: var(--surface-secondary);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    transition: border-color var(--transition-fast), background var(--transition-fast);
  }

  .search:hover { border-color: var(--border-hover); }

  .search:focus {
    background: var(--surface-default);
    border-color: var(--border-focus);
    outline: none;
    box-shadow: 0 0 0 3px var(--focus-ring);
  }

  .panes {
    display: grid;
    grid-template-rows: 200px 1fr;
    min-height: 0;
  }

  .status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    border-top: 1px solid var(--border-default);
    background: var(--surface-secondary);
  }

  .spacer { flex: 1; }
  .dim { color: var(--text-tertiary); }
  .err { color: var(--status-danger); }

  .ghost {
    height: var(--control-height);
    padding: 0 var(--space-3);
    font: inherit;
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition-fast), color var(--transition-fast);
  }

  .ghost:hover {
    color: var(--text-body);
    background: var(--surface-navigation-hover);
  }
</style>
