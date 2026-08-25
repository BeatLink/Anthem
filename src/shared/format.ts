// The format-string language (DESIGN-SPEC §5.5). One engine serves labels, now-playing text,
// tooltips, tray text, notifications, column formats and the file renamer.
//
// It lives in shared/ and touches no DOM, so it is unchanged by any UI-framework decision.

export type FormatValue = string | number | null | undefined | readonly string[]
export type FormatSource = (fieldId: string) => FormatValue

interface Token {
  kind: 'literal' | 'field' | 'group'
  text?: string
  fields?: string[]
  spec?: string
  children?: Token[]
}

/**
 * Grammar:
 *   {field}                  field value
 *   {a|b}                    first non-empty of a, b
 *   {year:%04d}              printf-style numeric format
 *   {length:m:ss}            duration format
 *   {rating:stars}           typed renderer
 *   {genre:join(", ")}       set join
 *   {path:basename}          transform
 *   [ ... ]                  group that vanishes if any field inside is empty
 */
export function parseFormat(input: string): Token[] {
  let i = 0

  function parseTokens(stopAt?: string): Token[] {
    const out: Token[] = []
    let literal = ''

    const flush = (): void => {
      if (literal) { out.push({ kind: 'literal', text: literal }); literal = '' }
    }

    while (i < input.length) {
      const c = input[i]!

      if (stopAt && c === stopAt) { i++; flush(); return out }

      if (c === '\\' && i + 1 < input.length) { literal += input[i + 1]; i += 2; continue }

      if (c === '[') { i++; flush(); out.push({ kind: 'group', children: parseTokens(']') }); continue }

      if (c === '{') {
        i++
        let body = ''
        while (i < input.length && input[i] !== '}') body += input[i++]
        i++ // consume '}'
        flush()

        const colon = body.indexOf(':')
        const namePart = colon === -1 ? body : body.slice(0, colon)
        const spec = colon === -1 ? undefined : body.slice(colon + 1)
        out.push({ kind: 'field', fields: namePart.split('|').map((s) => s.trim()), spec })
        continue
      }

      literal += c
      i++
    }

    flush()
    return out
  }

  return parseTokens()
}

const isEmpty = (v: FormatValue): boolean =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

function formatDuration(ms: number, spec: string): string {
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number): string => String(n).padStart(2, '0')

  if (spec === 'h:mm:ss') return `${h}:${pad(m)}:${pad(s)}`
  if (spec === 'm:ss') return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
  return `${m}:${pad(s)}`
}

function applySpec(value: FormatValue, spec: string | undefined): string {
  if (isEmpty(value)) return ''

  if (spec === undefined) return Array.isArray(value) ? value.join(', ') : String(value)

  if (Array.isArray(value)) {
    const join = /^join\((.*)\)$/.exec(spec)
    if (join) {
      const raw = join[1]!.trim()
      const sep = raw.replace(/^["'](.*)["']$/, '$1')
      return value.join(sep)
    }
    if (spec === 'count') return String(value.length)
    if (spec === 'first') return value[0] ?? ''
    return value.join(', ')
  }

  const n = typeof value === 'number' ? value : Number(value)

  if (spec === 'stars') {
    const stars = Math.round((n / 20 + Number.EPSILON) * 10) / 10
    return '★'.repeat(Math.floor(stars)) + '☆'.repeat(5 - Math.floor(stars))
  }

  if (spec === 'm:ss' || spec === 'h:mm:ss') return formatDuration(n, spec)

  const printf = /^%0?(\d+)d$/.exec(spec)
  if (printf && Number.isFinite(n)) return String(Math.trunc(n)).padStart(Number(printf[1]), '0')

  const s = String(value)
  switch (spec) {
    case 'basename': return s.split('/').pop() ?? s
    case 'dirname':  return s.slice(0, Math.max(0, s.lastIndexOf('/'))) || '/'
    case 'ext':      { const b = s.split('/').pop() ?? s; const d = b.lastIndexOf('.'); return d > 0 ? b.slice(d + 1) : '' }
    case 'upper':    return s.toLocaleUpperCase()
    case 'lower':    return s.toLocaleLowerCase()
    case 'title':    return s.replace(/\p{L}[\p{L}\p{M}']*/gu, (w) => w[0]!.toLocaleUpperCase() + w.slice(1).toLocaleLowerCase())
    default:         return s
  }
}

interface RenderResult { text: string; sawEmptyField: boolean }

function renderTokens(tokens: readonly Token[], get: FormatSource): RenderResult {
  let text = ''
  let sawEmptyField = false

  for (const t of tokens) {
    if (t.kind === 'literal') { text += t.text; continue }

    if (t.kind === 'group') {
      const inner = renderTokens(t.children!, get)
      // A bracketed group vanishes entirely if any field inside it is empty.
      if (!inner.sawEmptyField) text += inner.text
      continue
    }

    const found = t.fields!.map(get).find((v) => !isEmpty(v))
    if (found === undefined) { sawEmptyField = true; continue }
    text += applySpec(found, t.spec)
  }

  return { text, sawEmptyField }
}

export function formatString(template: string, get: FormatSource): string {
  return renderTokens(parseFormat(template), get).text
}

/** Convenience for the common case of formatting a plain record. */
export const formatRecord = (template: string, row: Record<string, FormatValue>): string =>
  formatString(template, (f) => row[f])

/** Every field a template references, so a caller knows what to fetch. */
export function templateFields(template: string): string[] {
  const out = new Set<string>()
  const walk = (tokens: readonly Token[]): void => {
    for (const t of tokens) {
      if (t.kind === 'field') t.fields!.forEach((f) => out.add(f))
      else if (t.kind === 'group') walk(t.children!)
    }
  }
  walk(parseFormat(template))
  return [...out]
}
