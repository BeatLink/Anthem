// A full-screen view over the library.
//
// Earlier full-page views could strand the user — the problem was never the format, it was the
// missing way out. So the exit is structural here rather than left to each caller: a persistent
// close control in the header, and Escape.

import type { ComponentChildren } from 'preact'
import { useEffect } from 'preact/hooks'
import { cx } from './cx'
import s from './Page.module.css'

export function Page({
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
  actions?: ComponentChildren
  /** Optional left-hand navigation column. */
  nav?: ComponentChildren
  children: ComponentChildren
}) {
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onclose?.()
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [onclose])

  return (
    <div class={s.page} role="dialog" aria-modal="true" aria-label={title}>
      <header class={s.header}>
        <div class={s.titles}>
          <h1 class={s.title}>{title}</h1>
          {subtitle && <p class={s.subtitle}>{subtitle}</p>}
        </div>

        <div class={s.actions}>
          {actions}
          <button class={s.close} onClick={onclose} title="Close (Esc)">Close</button>
        </div>
      </header>

      <div class={cx(s.body, nav != null && s.withNav)}>
        {nav != null && <nav class={s.nav}>{nav}</nav>}
        <main class={s.main}>{children}</main>
      </div>
    </div>
  )
}
