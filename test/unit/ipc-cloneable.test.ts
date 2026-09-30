// Arguments cross Electron's IPC boundary by structured clone, which rejects Proxies and other
// uncloneable values, so the bridge has to flatten them first.

import { describe, expect, it } from 'vitest'
import { toCloneable } from '@shared/ipc'

describe('toCloneable', () => {
  it('passes primitives through untouched', () => {
    for (const v of [1, 'x', true, null, undefined]) expect(toCloneable(v)).toBe(v)
  })

  it('returns the same reference for a value that already clones', () => {
    const plain = { a: 1, b: [2, 3] }
    expect(toCloneable(plain)).toBe(plain)
  })

  it('flattens a Proxy, which structured clone would reject', () => {
    const proxy = new Proxy([1, 2, 3], {})
    expect(() => structuredClone(proxy)).toThrow()

    const out = toCloneable(proxy) as number[]
    expect(() => structuredClone(out)).not.toThrow()
    expect(out).toEqual([1, 2, 3])
  })

  it('flattens nested proxies inside a plain object', () => {
    const wrapped = { ids: new Proxy([7, 8], {}), survivor: 7 }
    const out = toCloneable(wrapped)
    expect(() => structuredClone(out)).not.toThrow()
    expect(out).toEqual({ ids: [7, 8], survivor: 7 })
  })

  it('preserves the shape a merge request actually sends', () => {
    const req = new Proxy({
      ids: new Proxy([1, 2], {}),
      survivor: 1,
      resolutions: new Proxy({ year: { kind: 'value', from: 2 } }, {})
    }, {})

    expect(toCloneable(req)).toEqual({
      ids: [1, 2], survivor: 1, resolutions: { year: { kind: 'value', from: 2 } }
    })
  })
})
