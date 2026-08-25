<script lang="ts">
  import { untrack } from 'svelte'

  // A right-click menu positioned at the pointer, kept on screen, dismissed by Escape, a click
  // elsewhere, or choosing something. Items are data so callers describe a menu rather than build
  // one — which is what the layout system will need when menus become user-configurable (§6.1).

  export interface MenuItem {
    id: string
    label: string
    /** Right-aligned hint, for a keyboard shortcut. */
    hint?: string
    disabled?: boolean
    danger?: boolean
    separatorBefore?: boolean
    action: () => void
  }

  let {
    x,
    y,
    items,
    onclose
  }: { x: number; y: number; items: MenuItem[]; onclose?: () => void } = $props()

  let menu = $state<HTMLElement | null>(null)
  // The opening point is fixed for the life of the menu; a new right-click makes a new one.
  let pos = $state({ left: untrack(() => x), top: untrack(() => y) })

  // Flip rather than overflow: a menu opened near an edge should stay fully visible.
  $effect(() => {
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    const pad = 8
    pos = {
      left: x + rect.width + pad > window.innerWidth ? Math.max(pad, x - rect.width) : x,
      top: y + rect.height + pad > window.innerHeight ? Math.max(pad, y - rect.height) : y
    }
  })

  $effect(() => {
    const dismiss = (e: Event): void => {
      if (menu && !menu.contains(e.target as Node)) onclose?.()
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('contextmenu', dismiss)
    window.addEventListener('blur', () => onclose?.())
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('contextmenu', dismiss)
    }
  })

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); onclose?.() }
  }

  function choose(item: MenuItem): void {
    if (item.disabled) return
    item.action()
    onclose?.()
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div
  class="menu"
  bind:this={menu}
  role="menu"
  tabindex="-1"
  style:left="{pos.left}px"
  style:top="{pos.top}px"
>
  {#each items as item (item.id)}
    {#if item.separatorBefore}<div class="sep" role="separator"></div>{/if}
    <button
      role="menuitem"
      class:danger={item.danger}
      disabled={item.disabled}
      onclick={() => choose(item)}
    >
      <span class="label">{item.label}</span>
      {#if item.hint}<span class="hint">{item.hint}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .menu {
    position: fixed;
    z-index: 50;
    min-width: 210px;
    padding: var(--space-1);
    background: var(--surface-default);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: 0 10px 30px var(--shadow-floating);
  }

  button {
    display: flex;
    gap: var(--space-4);
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: var(--control-height);
    padding: 0 var(--space-3);
    font: inherit;
    font-size: var(--font-size-sm);
    color: var(--text-body);
    text-align: left;
    background: transparent;
    border: 0;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  button:hover:not(:disabled) { background: var(--row-hover); }
  button:disabled { opacity: 0.4; cursor: default; }
  button.danger { color: var(--status-danger); }

  .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hint { flex: 0 0 auto; font-size: 11px; color: var(--text-tertiary); }

  .sep {
    height: 1px;
    margin: var(--space-1) var(--space-2);
    background: var(--border-default);
  }
</style>
