<script lang="ts">
  // A full-screen view over the library.
  //
  // Earlier full-page views could strand the user — the problem was never the format, it was the
  // missing way out. So the exit is structural here rather than left to each caller: a persistent
  // close control in the header, and Escape.

  import type { Snippet } from 'svelte'

  let {
    title,
    subtitle,
    onclose,
    actions,
    nav,
    children
  }: {
    title: string
    subtitle?: string
    onclose?: () => void
    /** Buttons for the header's right side. */
    actions?: Snippet
    /** Optional left-hand navigation column. */
    nav?: Snippet
    children: Snippet
  } = $props()

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onclose?.()
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="page" role="dialog" aria-modal="true" aria-label={title}>
  <header>
    <div class="titles">
      <h1>{title}</h1>
      {#if subtitle}<p>{subtitle}</p>{/if}
    </div>

    <div class="actions">
      {@render actions?.()}
      <button class="close" onclick={onclose} title="Close (Esc)">Close</button>
    </div>
  </header>

  <div class="body" class:with-nav={nav}>
    {#if nav}
      <nav>{@render nav()}</nav>
    {/if}
    <main>{@render children()}</main>
  </div>
</div>

<style>
  .page {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: grid;
    grid-template-rows: auto 1fr;
    background: var(--surface-default);
  }

  header {
    display: flex;
    gap: var(--space-4);
    align-items: center;
    padding: var(--space-3) var(--space-5);
    background: var(--surface-navigation);
    border-bottom: 1px solid var(--border-default);
  }

  .titles { flex: 1; min-width: 0; }

  h1 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-heading);
  }

  .titles p {
    margin: 2px 0 0;
    font-size: var(--font-size-sm);
    color: var(--text-tertiary);
  }

  .actions { display: flex; gap: var(--space-3); align-items: center; }

  .close {
    height: var(--control-height);
    padding: 0 var(--space-4);
    font: inherit;
    color: var(--text-body);
    background: var(--surface-default);
    border: 1px solid var(--border-control);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .close:hover { border-color: var(--border-focus); }

  .body { display: grid; min-height: 0; }
  .body.with-nav { grid-template-columns: 180px 1fr; }

  nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4) var(--space-3);
    overflow-y: auto;
    background: var(--surface-navigation);
    border-right: 1px solid var(--border-default);
  }

  main { overflow-y: auto; padding: var(--space-5) var(--space-6); }
</style>
