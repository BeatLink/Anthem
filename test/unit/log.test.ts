// A logging system is only useful if a mistake in its configuration cannot silence it.

import { describe, expect, it } from 'vitest'
import {
  createLogger, enabled, formatRecord, levelFor, parseLevelSpec, type LogRecord
} from '@shared/log'

describe('parseLevelSpec', () => {
  it('defaults to info when unset', () => {
    expect(parseLevelSpec(undefined)).toEqual({ default: 'info', scopes: {} })
  })

  it('accepts a bare level', () => {
    expect(parseLevelSpec('debug').default).toBe('debug')
  })

  it('accepts common aliases', () => {
    expect(parseLevelSpec('warning').default).toBe('warn')
    expect(parseLevelSpec('err').default).toBe('error')
    expect(parseLevelSpec('verbose').default).toBe('debug')
  })

  it('sets a level per scope', () => {
    const spec = parseLevelSpec('warn,play:debug,db:error')
    expect(spec.default).toBe('warn')
    expect(spec.scopes).toEqual({ play: 'debug', db: 'error' })
  })

  it('treats * as the default', () => {
    expect(parseLevelSpec('*:debug').default).toBe('debug')
  })

  it('ignores nonsense rather than turning logging off', () => {
    const spec = parseLevelSpec('nonsense,play:alsononsense,,  ,db:debug')
    expect(spec.default).toBe('info')
    expect(spec.scopes).toEqual({ db: 'debug' })
  })

  it('is case and whitespace insensitive', () => {
    expect(parseLevelSpec('  WARN , Play : DEBUG ').scopes).toEqual({ play: 'debug' })
  })
})

describe('level filtering', () => {
  it('emits levels at or above the configured one', () => {
    const spec = parseLevelSpec('warn')
    expect(enabled(spec, 'any', 'critical')).toBe(true)
    expect(enabled(spec, 'any', 'warn')).toBe(true)
    expect(enabled(spec, 'any', 'info')).toBe(false)
    expect(enabled(spec, 'any', 'debug')).toBe(false)
  })

  it('lets one scope be noisier than the rest', () => {
    const spec = parseLevelSpec('error,play:debug')
    expect(enabled(spec, 'play', 'debug')).toBe(true)
    expect(enabled(spec, 'db', 'debug')).toBe(false)
    expect(levelFor(spec, 'db')).toBe('error')
  })
})

describe('logger', () => {
  it('passes records to the sink only when enabled', () => {
    const seen: LogRecord[] = []
    const log = createLogger('play', parseLevelSpec('info'), (r) => seen.push(r))

    log.debug('not emitted')
    log.info('emitted', { a: 1 })
    log.error('also emitted')

    expect(seen.map((r) => r.message)).toEqual(['emitted', 'also emitted'])
    expect(seen[0]!.data).toEqual({ a: 1 })
    expect(seen[0]!.scope).toBe('play')
  })

  it('reports whether a level would be emitted, so callers can skip the work', () => {
    const log = createLogger('play', parseLevelSpec('warn'), () => {})
    expect(log.enabled('debug')).toBe(false)
    expect(log.enabled('error')).toBe(true)
  })

  it('follows a spec that changes after the logger was made', () => {
    // The renderer learns its level from the main process, after module load.
    const seen: LogRecord[] = []
    let spec = parseLevelSpec('warn')
    const log = createLogger('ui', () => spec, (r) => seen.push(r))

    log.debug('filtered')
    expect(seen).toHaveLength(0)

    spec = parseLevelSpec('debug')
    log.debug('now emitted')
    expect(seen.map((r) => r.message)).toEqual(['now emitted'])
    expect(log.enabled('debug')).toBe(true)
  })

  it('makes child scopes that inherit configuration', () => {
    const seen: LogRecord[] = []
    const log = createLogger('play', parseLevelSpec('debug'), (r) => seen.push(r))
    log.child('mpv').debug('hello')
    expect(seen[0]!.scope).toBe('play:mpv')
  })
})

describe('formatting', () => {
  it('lays out fixed columns and appends structured data', () => {
    const line = formatRecord({
      at: new Date(2026, 0, 2, 3, 4, 5, 67).getTime(),
      level: 'warn', scope: 'play', message: 'slow', data: { ms: 12 }
    })
    expect(line).toContain('03:04:05.067')
    expect(line).toContain('WARN')
    expect(line).toContain('play')
    expect(line).toContain('{"ms":12}')
  })

  it('survives data that cannot be serialised', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(formatRecord({ at: 0, level: 'info', scope: 's', message: 'm', data: cyclic }))
      .toContain('[unserializable]')
  })
})
