<script lang="ts">
  // A resizable split. All the sizing decisions live in shared/split.ts; this component only binds
  // them to pointer and keyboard events and writes the result into a grid template.

  import { untrack, type Snippet } from 'svelte'
  import {
    KEYBOARD_STEP, KEYBOARD_STEP_LARGE, distribute, fit, resizeAt, type PaneSpec
  } from '@shared/split'

  let {
    id,
    dir = 'horizontal',
    specs,
    preferred,
    panes
  }: {
    /** Stable id; pane sizes are remembered under it. */
    id: string
    dir?: 'horizontal' | 'vertical'
    specs: PaneSpec[]
    preferred?: (number | undefined)[]
    panes: Snippet<[number]>[]
  } = $props()

  // The id is fixed configuration for the lifetime of the split.
  const STORAGE = `anthem.split.${untrack(() => id)}`

  let container = $state<HTMLElement | null>(null)
  let sizes = $state<number[]>([])
  let dragging = $state<number | null>(null)

  function extent(): number {
    if (!container) return 0
    return dir === 'horizontal' ? container.clientWidth : container.clientHeight
  }

  function persist(): void {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(sizes))
    } catch {
      // A full or unavailable localStorage must not break resizing.
    }
  }

  function restore(): number[] | null {
    try {
      const raw = localStorage.getItem(STORAGE)
      if (!raw) return null
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed) || parsed.length !== specs.length) return null
      if (!parsed.every((v) => typeof v === 'number' && Number.isFinite(v))) return null
      return parsed as number[]
    } catch {
      return null
    }
  }

  $effect(() => {
    if (!container) return

    const total = extent()
    if (total <= 0) return

    if (sizes.length !== specs.length) {
      const saved = restore()
      sizes = saved ? fit(saved, total, specs) : distribute(total, specs, preferred)
    }

    // Keep panes filling the container as the window changes.
    const observer = new ResizeObserver(() => {
      const t = extent()
      if (t > 0 && sizes.length === specs.length) sizes = fit(sizes, t, specs)
    })
    observer.observe(container)
    return () => observer.disconnect()
  })

  function startDrag(index: number, event: PointerEvent): void {
    event.preventDefault()
    const handle = event.currentTarget as HTMLElement
    handle.setPointerCapture(event.pointerId)

    const origin = dir === 'horizontal' ? event.clientX : event.clientY
    const before = [...sizes]
    dragging = index

    const move = (e: PointerEvent): void => {
      const now = dir === 'horizontal' ? e.clientX : e.clientY
      sizes = resizeAt(before, index, now - origin, specs)
    }

    const done = (): void => {
      dragging = null
      handle.releasePointerCapture(event.pointerId)
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', done)
      handle.removeEventListener('pointercancel', done)
      persist()
    }

    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', done)
    handle.addEventListener('pointercancel', done)
  }

  function onKey(index: number, event: KeyboardEvent): void {
    const back = dir === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'
    const forward = dir === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
    if (event.key !== back && event.key !== forward) return

    event.preventDefault()
    const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP
    sizes = resizeAt(sizes, index, event.key === forward ? step : -step, specs)
    persist()
  }

  /** Double-click restores the layout's own proportions. */
  function reset(): void {
    sizes = distribute(extent(), specs, preferred)
    persist()
  }

  const template = $derived(
    sizes.length === specs.length
      ? sizes.flatMap((s, i) => (i === 0 ? [`${s}px`] : ['auto', `${s}px`])).join(' ')
      : specs.map(() => '1fr').join(' auto ')
  )
</script>

<div
  class="split {dir}"
  class:dragging={dragging !== null}
  bind:this={container}
  style:grid-template-columns={dir === 'horizontal' ? template : undefined}
  style:grid-template-rows={dir === 'vertical' ? template : undefined}
>
  {#each panes as pane, i (i)}
    {#if i > 0}
      <!--
        A focusable role="separator" with aria-valuenow is the ARIA window-splitter pattern, so the
        non-interactive-role warnings below are wrong for this element specifically.
      -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div
        class="gutter"
        class:active={dragging === i - 1}
        role="separator"
        tabindex="0"
        aria-orientation={dir === 'horizontal' ? 'vertical' : 'horizontal'}
        aria-label="Resize panes"
        aria-valuenow={sizes[i - 1] ?? 0}
        onpointerdown={(e) => startDrag(i - 1, e)}
        onkeydown={(e) => onKey(i - 1, e)}
        ondblclick={reset}
      ><span class="grip"></span></div>
    {/if}
    <div class="pane">{@render pane(i)}</div>
  {/each}
</div>

<style>
  .split {
    display: grid;
    min-width: 0;
    min-height: 0;
  }

  .pane { min-width: 0; min-height: 0; overflow: hidden; }

  .gutter {
    position: relative;
    display: grid;
    place-items: center;
    background: var(--border-default);
    border: 0;
    padding: 0;
    transition: background var(--transition-fast);
  }

  .horizontal > .gutter { width: 5px; cursor: col-resize; }
  .vertical > .gutter { height: 5px; cursor: row-resize; }

  .gutter:hover, .gutter:focus-visible { background: var(--accent); outline: none; }
  .gutter.active { background: var(--accent); }

  /* A wider invisible hit area, so the grab target is forgiving without a fat visible bar. */
  .gutter::after {
    content: '';
    position: absolute;
    inset: -3px;
  }

  .grip {
    position: relative;
    z-index: 1;
    background: var(--surface-default);
    border-radius: var(--radius-full);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .horizontal > .gutter .grip { width: 1px; height: 22px; }
  .vertical > .gutter .grip { width: 22px; height: 1px; }

  .gutter:hover .grip { opacity: 0.7; }
</style>
