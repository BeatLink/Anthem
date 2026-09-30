import { useEffect, useState } from 'preact/hooks'
import { ipc } from '../../lib/ipc'
import { cx } from '../../lib/cx'
import type { GmbPreview, ImportReport } from '@shared/ipc'
import { library } from '../../stores/library'
import s from './GmbImport.module.css'

export function GmbImport({ ondone }: { ondone?: () => void }) {
  const [path, setPath] = useState('')
  const [preview, setPreview] = useState<GmbPreview | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [statistics, setStatistics] = useState(true)
  const [labels, setLabels] = useState(true)
  const [playlists, setPlaylists] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const initial = await ipc('import:gmbDefaultPath')
        setPath(initial)
        await check(initial)
      } catch (err) {
        setError(`Could not reach the main process: ${(err as Error).message}`)
      }
    })()
  }, [])

  async function check(at: string): Promise<void> {
    if (!at) return
    try {
      setError(null)
      setPreview(await ipc('import:gmbPreview', at))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function browse(): Promise<void> {
    try {
      const picked = await ipc('import:gmbBrowse')
      if (picked) {
        setPath(picked)
        await check(picked)
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function run(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      setReport(await ipc('import:gmbRun', { path, statistics, labels, playlists }))
      await library.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function reset(): Promise<void> {
    setBusy(true)
    try {
      await ipc('library:reset')
      setReport(null)
      await library.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section class={s.import}>
      <header class={s.header}>
        <h2 class={s.heading}>gmusicbrowser</h2>
        <p class={s.lead}>
          Imports ratings, play counts, full play history, genres, groupings, labels and saved lists.
          Your music files are only ever read.
        </p>
      </header>

      <div class={s.row}>
        <label class={s.label} for="gmbrc">Configuration file</label>
        <input class={s.input} id="gmbrc" value={path} spellcheck={false}
               onInput={(e) => setPath((e.currentTarget as HTMLInputElement).value)}
               onChange={(e) => void check((e.currentTarget as HTMLInputElement).value)} />
        <button class={s.button} onClick={browse}>Browse…</button>
      </div>

      {preview && !preview.exists ? (
        <p class={cx(s.note, s.warn)}>No file at that path. gmusicbrowser keeps it at{' '}
          <code class={s.code}>~/.config/gmusicbrowser/gmbrc</code> by default.</p>
      ) : preview?.error ? (
        <p class={cx(s.note, s.err)}>Could not parse: {preview.error}</p>
      ) : preview && (
        <>
          <div class={s.preview}>
            <div><strong>{preview.songs.toLocaleString()}</strong><span>songs</span></div>
            <div><strong>{preview.playHistoryEntries.toLocaleString()}</strong><span>play events</span></div>
            <div><strong>{preview.savedLists}</strong><span>saved lists</span></div>
            <div><strong>{preview.savedFilters}</strong><span>saved filters</span></div>
          </div>
          {preview.baseFolder && (
            <p class={s.note}>Music root: <code class={s.code}>{preview.baseFolder}</code>{preview.version && <> · gmbrc {preview.version}</>}</p>
          )}
          {preview.unmappedColumns.length > 0 && (
            <p class={cx(s.note, s.warn)}>Unrecognised columns will be ignored: {preview.unmappedColumns.join(', ')}</p>
          )}

          <div class={s.opts}>
            <label class={s.label}>
              <input class={s.check} type="checkbox" checked={statistics}
                     onChange={(e) => setStatistics((e.currentTarget as HTMLInputElement).checked)} /> Ratings, play counts and history
            </label>
            <label class={s.label}>
              <input class={s.check} type="checkbox" checked={labels}
                     onChange={(e) => setLabels((e.currentTarget as HTMLInputElement).checked)} /> Genres, groupings and labels
            </label>
            <label class={s.label}>
              <input class={s.check} type="checkbox" checked={playlists}
                     onChange={(e) => setPlaylists((e.currentTarget as HTMLInputElement).checked)} /> Saved lists as playlists
            </label>
          </div>

          <div class={s.actions}>
            <button class={cx(s.button, s.primary)} disabled={busy || preview.songs === 0} onClick={run}>
              {busy ? 'Importing…' : `Import ${preview.songs.toLocaleString()} songs`}
            </button>
            <button class={s.button} disabled={busy} onClick={reset}>Clear library</button>
            <span class={s.readonly}>Reads only — your music files are never modified.</span>
          </div>
        </>
      )}

      {error && <p class={cx(s.note, s.err)}>{error}</p>}

      {report && (
        <div class={s.report}>
          <p>
            Imported <strong>{report.tracksCreated.toLocaleString()}</strong> tracks and{' '}
            <strong>{report.mediaCreated.toLocaleString()}</strong> files,
            with <strong>{report.playHistoryRows.toLocaleString()}</strong> play events and{' '}
            <strong>{report.playlistsCreated}</strong> playlists.
          </p>
          {report.notes.map((note) => (
            <p key={note} class={s.note}>{note}</p>
          ))}

          <button class={cx(s.button, s.primary, s.big)} onClick={ondone}>Show my library →</button>
        </div>
      )}
    </section>
  )
}
