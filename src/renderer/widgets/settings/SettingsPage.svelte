<script lang="ts">
  import { untrack } from 'svelte'
  import type { AppInfo, SafetyStatus } from '@shared/ipc'
  import { library } from '../../stores/library.svelte'
  import GmbImport from './GmbImport.svelte'

  let {
    info = null,
    safety = null,
    theme = 'system',
    density = 'normal',
    initialSection = 'library',
    onclose,
    onTheme,
    onDensity
  }: {
    info?: AppInfo | null
    safety?: SafetyStatus | null
    theme?: 'light' | 'dark' | 'system'
    density?: 'compact' | 'normal' | 'comfortable'
    initialSection?: 'library' | 'import' | 'appearance' | 'about'
    onclose?: () => void
    onTheme?: (t: 'light' | 'dark' | 'system') => void
    onDensity?: (d: 'compact' | 'normal' | 'comfortable') => void
  } = $props()

  const sections = [
    { id: 'library', label: 'Library' },
    { id: 'import', label: 'Import' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'about', label: 'About' }
  ] as const

  type Section = (typeof sections)[number]['id']
  // The prop only chooses where to open; the nav owns the value from then on.
  let section = $state<Section>(untrack(() => initialSection))

  let clearing = $state(false)

  async function clearLibrary(): Promise<void> {
    clearing = true
    try {
      await window.anthem['library:reset']()
      await library.refresh()
    } finally {
      clearing = false
    }
  }

  const duration = (ms: number): string => {
    const h = Math.floor(ms / 3_600_000)
    const d = Math.floor(h / 24)
    return d > 0 ? `${d}d ${h % 24}h` : `${h}h`
  }
</script>

<div class="settings" role="dialog" aria-label="Settings">
  <nav>
    <div class="title">Settings</div>
    {#each sections as s (s.id)}
      <button class:active={section === s.id} onclick={() => (section = s.id)}>{s.label}</button>
    {/each}
    <span class="grow"></span>
    <button class="close" onclick={onclose}>Close</button>
  </nav>

  <div class="pane">
    {#if section === 'library'}
      <section>
        <h2>Library</h2>

        <div class="field">
          <span class="label">Database</span>
          <code>{library.stats?.path ?? '—'}</code>
        </div>

        <div class="field">
          <span class="label">Contents</span>
          <span>
            {#if library.stats}
              {library.stats.tracks.toLocaleString()} tracks ·
              {library.stats.media.toLocaleString()} files ·
              {library.stats.albums.toLocaleString()} albums ·
              {duration(library.stats.totalMs)}
              {#if library.stats.missing > 0} · {library.stats.missing} missing{/if}
            {:else}—{/if}
          </span>
        </div>

        <div class="field">
          <span class="label">File safety</span>
          <span>
            {#if safety}
              <strong class:ok={safety.readOnly}>{safety.readOnly ? 'Read-only' : 'Writes enabled'}</strong>
              <span class="hint">{safety.reason}</span>
              {#if safety.pinned}
                <span class="hint">
                  Pinned by the environment. Unset <code>ANTHEM_FORCE_READ_ONLY</code> to change it.
                </span>
              {:else}
                <span class="hint">
                  Anthem cannot write tags yet, so this is a guarantee rather than a preference.
                </span>
              {/if}
            {:else}—{/if}
          </span>
        </div>

        <div class="field">
          <span class="label">Danger zone</span>
          <span>
            <button class="danger" disabled={clearing} onclick={clearLibrary}>
              {clearing ? 'Clearing…' : 'Clear library database'}
            </button>
            <span class="hint">Removes every track, playlist and statistic. Files are untouched.</span>
          </span>
        </div>
      </section>

    {:else if section === 'import'}
      <GmbImport />

    {:else if section === 'appearance'}
      <section>
        <h2>Appearance</h2>

        <div class="field">
          <span class="label">Theme</span>
          <div class="choices">
            {#each ['system', 'light', 'dark'] as t (t)}
              <button class:sel={theme === t} onclick={() => onTheme?.(t as never)}>{t}</button>
            {/each}
          </div>
        </div>

        <div class="field">
          <span class="label">Density</span>
          <div class="choices">
            {#each ['compact', 'normal', 'comfortable'] as d (d)}
              <button class:sel={density === d} onclick={() => onDensity?.(d as never)}>{d}</button>
            {/each}
          </div>
        </div>

        <p class="hint">
          Colours come from the Halon token set; density maps onto the row-height scale, so both
          apply everywhere without a component knowing about them.
        </p>
      </section>

    {:else}
      <section>
        <h2>About</h2>
        <div class="field">
          <span class="label">Anthem</span>
          <span>{info?.version ?? '—'}</span>
        </div>
        <div class="field">
          <span class="label">Runtime</span>
          <span>
            {#if info}
              Electron {info.electron} · Chromium {info.chrome} · Node {info.node} · {info.platform}
            {:else}—{/if}
          </span>
        </div>
        <div class="field">
          <span class="label">Last query</span>
          <code class="sql">{library.lastSql || '—'}</code>
        </div>
      </section>
    {/if}
  </div>
</div>

<style>
  .settings {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: 200px 1fr;
    background: var(--surface-default);
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4) var(--space-3);
    background: var(--surface-navigation);
    border-right: 1px solid var(--border-default);
  }

  .title {
    padding: 0 var(--space-3) var(--space-3);
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-heading);
  }

  nav button {
    justify-content: flex-start;
    padding: var(--space-2) var(--space-3);
    font: inherit;
    text-align: left;
    color: var(--text-on-navigation);
    background: transparent;
    border: 0;
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  nav button:hover { background: var(--surface-navigation-hover); }
  nav button.active { color: var(--text-on-fill); background: var(--accent); }

  .grow { flex: 1; }
  .close { color: var(--text-tertiary); }

  .pane { overflow-y: auto; padding: var(--space-6); }

  section { display: grid; gap: var(--space-4); max-width: 80ch; }
  h2 { margin: 0; font-size: var(--font-size-lg); color: var(--text-heading); }

  .field { display: grid; grid-template-columns: 140px 1fr; gap: var(--space-4); align-items: start; }
  .label { font-size: var(--font-size-sm); color: var(--text-tertiary); padding-top: 3px; }
  .field > span:last-child { display: grid; gap: var(--space-2); }

  .hint { font-size: var(--font-size-sm); color: var(--text-tertiary); }
  strong.ok { color: var(--status-success); }

  code {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    word-break: break-all;
  }

  .sql {
    display: block;
    padding: var(--space-3);
    overflow-x: auto;
    white-space: pre-wrap;
    background: var(--surface-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
  }

  .choices { display: flex; gap: var(--space-2); }

  .choices button, .danger {
    height: var(--control-height);
    padding: 0 var(--space-4);
    font: inherit;
    color: var(--text-body);
    background: var(--surface-default);
    border: 1px solid var(--border-control);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-transform: capitalize;
  }

  .choices button.sel { color: var(--text-on-fill); background: var(--accent); border-color: transparent; }

  .danger { color: var(--status-danger); border-color: var(--status-danger); justify-self: start; }
  .danger:disabled { opacity: 0.5; cursor: default; }
</style>
