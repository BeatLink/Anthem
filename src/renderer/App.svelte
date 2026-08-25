<script lang="ts">
  import { onMount } from 'svelte'
  import type { AppInfo, SafetyStatus } from '@shared/ipc'
  import { library } from './stores/library.svelte'
  import PlayerBlock from './widgets/PlayerBlock.svelte'
  import TabbedLists from './widgets/TabbedLists.svelte'
  import FilterPane from './widgets/FilterPane.svelte'
  import SongList from './widgets/SongList.svelte'
  import SettingsPage from './widgets/settings/SettingsPage.svelte'
  import Split from './lib/Split.svelte'

  let info = $state<AppInfo | null>(null)
  let safety = $state<SafetyStatus | null>(null)
  let theme = $state<'light' | 'dark' | 'system'>('system')
  let rightTab = $state<'library' | 'context'>('library')
  let density = $state<'compact' | 'normal' | 'comfortable'>('normal')
  let showSettings = $state(false)
  let settingsSection = $state<'library' | 'folders' | 'import' | 'duplicates' | 'appearance' | 'about'>('library')

  onMount(async () => {
    info = await window.anthem['app:info']()
    safety = await window.anthem['app:safety']()
    await library.refresh()
    // Open settings on the Import tab when there is nothing to look at yet.
    if ((library.stats?.tracks ?? 0) === 0) {
      settingsSection = 'import'
      showSettings = true
    }
  })

  $effect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  })

  $effect(() => {
    document.documentElement.setAttribute('data-density', density)
  })

  const cycleTheme = (): void => {
    theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
  }

  const duration = (ms: number): string => {
    const h = Math.floor(ms / 3_600_000)
    const d = Math.floor(h / 24)
    return d > 0 ? `${d}d ${h % 24}h` : `${h}h`
  }
</script>

<!--
  Structure follows gmusicbrowser's default layout, "Lists, Library & Context":

    VBmain = HBmenu _HPmain Progress
     HPmain = VBLeft _TBRight
      VBLeft  = VBplayer _TabbedLists(PlayList, QueueList, song info, pictures)
      TBRight = "Library" VPRight | "Context"
       VPRight = HPfp0(genre | artist | album) _VBSongList
        VBSongList = HBSongList(search, filter actions) _SongList
-->
{#snippet leftPane()}
  <div class="vbleft">
    <Split
      id="vbleft"
      dir="vertical"
      specs={[{ min: 150, max: 320 }, { min: 120, grow: true }]}
      preferred={[196, undefined]}
      panes={[playerPane, listsPane]}
    />
  </div>
{/snippet}

{#snippet playerPane()}<PlayerBlock />{/snippet}
{#snippet listsPane()}<TabbedLists />{/snippet}

{#snippet rightPane()}
  <div class="tbright">
    <div class="tabs">
      <button class:active={rightTab === 'library'} onclick={() => (rightTab = 'library')}>
        Library
      </button>
      <button class:active={rightTab === 'context'} onclick={() => (rightTab = 'context')}>
        Context
      </button>
    </div>

    {#if rightTab === 'library'}
      <Split
        id="vpright"
        dir="vertical"
        specs={[{ min: 90, max: 480 }, { min: 160, grow: true }]}
        preferred={[190, undefined]}
        panes={[panesRow, songListPane]}
      />
    {:else}
      <div class="context">
        <p>Context panel — lyrics, artist info and related tracks land in a later milestone.</p>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet panesRow()}
  <Split
    id="hpfp"
    dir="horizontal"
    specs={[{ min: 90 }, { min: 90 }, { min: 90, grow: true }]}
    panes={[genrePane, artistPane, albumPane]}
  />
{/snippet}

{#snippet genrePane()}<FilterPane field="genre" />{/snippet}
{#snippet artistPane()}<FilterPane field="album_artist" />{/snippet}
{#snippet albumPane()}<FilterPane field="album" />{/snippet}
{#snippet songListPane()}<SongList />{/snippet}

<div class="vbmain">
  {#if showSettings}
    <SettingsPage
      {info}
      {safety}
      {theme}
      {density}
      initialSection={settingsSection}
      onclose={() => (showSettings = false)}
      onTheme={(t) => (theme = t)}
      onDensity={(d) => (density = d)}
    />
  {/if}

  <div class="hbmenu">
    <button class="menu-item"
            onclick={() => { settingsSection = 'library'; showSettings = true }}>Settings</button>
    <span class="spacer"></span>

    {#if safety}
      <span class="safety" class:pinned={safety.pinned} title={safety.reason}>
        {safety.readOnly ? '🔒 Read-only' : '⚠ Writes enabled'}
      </span>
    {/if}

    <button class="menu-item" onclick={cycleTheme} title="Theme: {theme}">
      {theme === 'dark' ? '◐' : theme === 'light' ? '◑' : '◒'}
    </button>
  </div>

  <!-- Every boundary below is draggable; sizes persist per split id. -->
  <Split
    id="hpmain"
    dir="horizontal"
    specs={[{ min: 280, max: 720 }, { min: 420, grow: true }]}
    preferred={[420, undefined]}
    panes={[leftPane, rightPane]}
  />

  <footer class="status">
    {#if library.error}
      <span class="err">{library.error}</span>
    {:else if library.stats}
      <span>{library.stats.tracks.toLocaleString()} tracks</span>
      <span class="sep">·</span>
      <span>{library.stats.media.toLocaleString()} files</span>
      <span class="sep">·</span>
      <span>{library.stats.albums.toLocaleString()} albums</span>
      {#if library.stats.missing > 0}
        <span class="sep">·</span>
        <span class="warn">{library.stats.missing.toLocaleString()} missing</span>
      {/if}
      <span class="sep">·</span>
      <span>{duration(library.stats.totalMs)}</span>
    {/if}
    <span class="spacer"></span>
    {#if info}
      <span class="dim">Electron {info.electron} · Chromium {info.chrome}</span>
    {/if}
  </footer>
</div>

<style>
  .vbmain {
    position: relative;
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100%;
    background: var(--surface-root);
  }

  .hbmenu {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    background: var(--surface-navigation);
    border-bottom: 1px solid var(--border-default);
  }

  .menu-item {
    flex: 0 0 auto;
    height: var(--control-height-sm);
    min-width: var(--control-height-sm);
    padding: 0 var(--space-3);
    font: inherit;
    color: var(--text-on-navigation);
    background: transparent;
    border: 0;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .menu-item:hover { background: var(--surface-navigation-hover); }

  .safety {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    height: var(--control-height-sm);
    padding: 0 var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--status-success);
    background: color-mix(in srgb, var(--status-success) 12%, transparent);
    border-radius: var(--radius-full);
  }

  .safety.pinned { color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }

  .vbleft {
    display: grid;
    min-height: 0;
    height: 100%;
    background: var(--surface-navigation);
  }

  .tbright {
    display: grid;
    grid-template-rows: auto 1fr;
    min-width: 0;
    height: 100%;
    background: var(--surface-default);
  }

  .tabs {
    display: flex;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3) 0;
    background: var(--surface-secondary);
    border-bottom: 1px solid var(--border-default);
  }

  .tabs button {
    padding: var(--space-2) var(--space-4);
    font: inherit;
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid transparent;
    border-bottom: 0;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    cursor: pointer;
  }

  .tabs button.active {
    color: var(--text-heading);
    background: var(--surface-default);
    border-color: var(--border-default);
  }

  .context { padding: var(--space-6); color: var(--text-tertiary); }

  .status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    background: var(--surface-secondary);
    border-top: 1px solid var(--border-default);
  }

  .spacer { flex: 1; }
  .sep { color: var(--text-tertiary); }
  .dim { color: var(--text-tertiary); }
  .warn { color: var(--status-warning-text); }
  .err { color: var(--status-danger); }
</style>
