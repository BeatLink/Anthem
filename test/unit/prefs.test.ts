// A remembered setting must degrade to its default rather than breaking the view when what was
// stored is corrupt, stale, or from a version that shaped it differently.

import { describe, expect, it } from 'vitest'
import { isBoolean, isNumberIn, oneOf, readPref, writePref, type StorageLike } from '@shared/prefs'

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k)
  }
}

describe('readPref', () => {
  it('returns the default when nothing is stored', () => {
    expect(readPref(fakeStorage(), 'k', true)).toBe(true)
  })

  it('returns the stored value when it is valid', () => {
    expect(readPref(fakeStorage({ k: 'false' }), 'k', true, isBoolean)).toBe(false)
  })

  it('falls back when the stored value is not JSON', () => {
    expect(readPref(fakeStorage({ k: 'not json{' }), 'k', 7)).toBe(7)
  })

  it('falls back when the stored value fails validation', () => {
    expect(readPref(fakeStorage({ k: '"huge"' }), 'k', 'normal',
      oneOf('compact', 'normal', 'comfortable'))).toBe('normal')
  })

  it('falls back when the stored type no longer matches the default', () => {
    // An older version stored a string where this version expects a boolean.
    expect(readPref(fakeStorage({ k: '"yes"' }), 'k', false)).toBe(false)
    expect(readPref(fakeStorage({ k: '{"a":1}' }), 'k', [1, 2])).toEqual([1, 2])
  })

  it('accepts a value inside a numeric range and rejects one outside it', () => {
    expect(readPref(fakeStorage({ k: '5' }), 'k', 3, isNumberIn(0, 60))).toBe(5)
    expect(readPref(fakeStorage({ k: '999' }), 'k', 3, isNumberIn(0, 60))).toBe(3)
  })

  it('survives storage being unavailable', () => {
    const hostile: StorageLike = {
      getItem() { throw new Error('denied') },
      setItem() { throw new Error('denied') },
      removeItem() { throw new Error('denied') }
    }
    expect(readPref(hostile, 'k', 'fallback')).toBe('fallback')
    expect(() => writePref(hostile, 'k', 'x')).not.toThrow()
    expect(readPref(undefined, 'k', 'fallback')).toBe('fallback')
  })

  it('round-trips objects and arrays', () => {
    const s = fakeStorage()
    const value = { audio_hash: true, fuzzy: false }
    writePref(s, 'reasons', value)
    expect(readPref(s, 'reasons', {} as typeof value)).toEqual(value)
  })
})
