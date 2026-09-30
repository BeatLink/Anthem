// gmb's TabbedLists(pages="+PlayList +QueueList +@song_info +PictureBrowser").
import { useState } from 'preact/hooks'
import { player } from '../stores/player'
import { library } from '../stores/library'
import { cx } from '../lib/cx'
import s from './TabbedLists.module.css'

const tabs = [
  { id: 'playlist', label: 'Playlist' },
  { id: 'queue', label: 'Queue' },
  { id: 'info', label: 'Song info' },
  { id: 'pictures', label: 'Pictures' }
] as const

export function TabbedLists() {
  const [tab, setTab] = useState<'playlist' | 'queue' | 'info' | 'pictures'>('queue')

  const titleOf = (id: number): string =>
    library.tracks.find((t) => t.id === id)?.title ?? `Track ${id}`

  const artistOf = (id: number): string =>
    library.tracks.find((t) => t.id === id)?.artist ?? ''

  const status = player.status

  let body
  if (tab === 'queue') {
    body = (status?.queue.length ?? 0) === 0 ? (
      <p class={s.placeholder}>
        Queue is empty. Select tracks and press Queue, and they play before the list resumes.
      </p>
    ) : (
      <>
        <div class={s.qhead}>
          <span>{status!.queue.length} queued</span>
          <button class={s.qclear} onClick={() => player.clearQueue()}>Clear</button>
        </div>
        <ul class={s.queue}>
          {status!.queue.map((id, i) => (
            <li key={`${id}-${i}`} class={s.item}>
              <span class={s.pos}>{i + 1}</span>
              <span class={s.qtitle} title={titleOf(id)}>{titleOf(id)}</span>
              <span class={s.qartist}>{artistOf(id)}</span>
              <button class={s.drop} title="Remove" onClick={() => player.dequeue(i)}>✕</button>
            </li>
          ))}
        </ul>
      </>
    )
  } else if (tab === 'info') {
    body = status?.track ? (
      <dl class={s.info}>
        <dt class={s.term}>Title</dt><dd class={s.value}>{status.track.title ?? '—'}</dd>
        <dt class={s.term}>Artist</dt><dd class={s.value}>{status.track.artist ?? '—'}</dd>
        <dt class={s.term}>Album</dt><dd class={s.value}>{status.track.album ?? '—'}</dd>
        <dt class={s.term}>File</dt><dd class={cx(s.value, s.path)}>{status.media?.uri ?? '—'}</dd>
      </dl>
    ) : (
      <p class={s.placeholder}>Nothing playing.</p>
    )
  } else {
    body = (
      <p class={s.placeholder}>
        {tabs.find((t) => t.id === tab)?.label} — a later milestone.
      </p>
    )
  }

  return (
    <section class={s.tabbed}>
      <div class={s.tabs}>
        {tabs.map((t) => (
          <button key={t.id} class={cx(s.tab, tab === t.id && s.active)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div class={s.body}>{body}</div>
    </section>
  )
}
