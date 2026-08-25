import { describe, expect, it } from 'vitest'
import { distribute, fit, resizeAt, type PaneSpec } from '@shared/split'

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)

describe('resizeAt', () => {
  it('moves space from one pane to its neighbour', () => {
    expect(resizeAt([200, 400], 0, 50)).toEqual([250, 350])
    expect(resizeAt([200, 400], 0, -50)).toEqual([150, 450])
  })

  it('never changes the total', () => {
    const before: number[] = [200, 300, 500]
    for (const d of [-1000, -37, 0, 37, 1000]) {
      expect(sum(resizeAt(before, 1, d))).toBe(sum(before))
    }
  })

  it('stops at the dragged pane minimum instead of rejecting the drag', () => {
    const specs: PaneSpec[] = [{ min: 150 }, { min: 100 }]
    expect(resizeAt([200, 400], 0, -500, specs)).toEqual([150, 450])
  })

  it('stops at the neighbour minimum', () => {
    const specs: PaneSpec[] = [{ min: 50 }, { min: 300 }]
    expect(resizeAt([200, 400], 0, 500, specs)).toEqual([300, 300])
  })

  it('respects a maximum on either side', () => {
    expect(resizeAt([200, 400], 0, 500, [{ max: 260 }, {}])).toEqual([260, 340])
    expect(resizeAt([200, 400], 0, -500, [{}, { max: 450 }])).toEqual([150, 450])
  })

  it('does nothing at a boundary that does not exist', () => {
    expect(resizeAt([200, 400], 1, 50)).toEqual([200, 400])
    expect(resizeAt([], 0, 50)).toEqual([])
  })

  it('only touches the two adjacent panes', () => {
    expect(resizeAt([100, 200, 300], 1, 40)).toEqual([100, 240, 260])
  })
})

describe('fit', () => {
  it('is a no-op when the sizes already fill the container', () => {
    expect(fit([200, 400], 600)).toEqual([200, 400])
  })

  it('gives surplus space to panes marked grow', () => {
    const specs: PaneSpec[] = [{}, { grow: true }]
    expect(fit([200, 400], 700, specs)).toEqual([200, 500])
  })

  it('takes a deficit from panes marked grow', () => {
    const specs: PaneSpec[] = [{}, { grow: true }]
    expect(fit([200, 400], 500, specs)).toEqual([200, 300])
  })

  it('spreads the difference when nothing is marked grow', () => {
    expect(sum(fit([200, 400], 700))).toBe(700)
  })

  it('hands the remainder to other panes when one hits its minimum', () => {
    const specs: PaneSpec[] = [{ min: 180, grow: true }, { grow: true }]
    const out = fit([200, 400], 400, specs)
    expect(out[0]).toBe(180)
    expect(sum(out)).toBe(400)
  })

  it('honours minimums even if that overflows a too-small container', () => {
    const specs: PaneSpec[] = [{ min: 200 }, { min: 200 }]
    const out = fit([300, 300], 100, specs)
    expect(out).toEqual([200, 200])
  })

  it('always returns whole pixels', () => {
    for (const v of fit([100, 100, 100], 451)) expect(Number.isInteger(v)).toBe(true)
  })
})

describe('distribute', () => {
  it('uses preferred sizes when they are given', () => {
    const specs: PaneSpec[] = [{ min: 100 }, { min: 100, grow: true }]
    expect(distribute(800, specs, [300, undefined])).toEqual([300, 500])
  })

  it('fills the container when nothing is preferred', () => {
    expect(sum(distribute(900, [{}, {}, {}]))).toBe(900)
  })
})

describe('the property that matters while dragging', () => {
  it('a sequence of drags never breaks a minimum or the total', () => {
    const specs: PaneSpec[] = [{ min: 120 }, { min: 200 }, { min: 80 }]
    let sizes = [200, 400, 200]
    const total = sum(sizes)

    for (const [i, d] of [[0, 300], [1, -500], [0, -90], [1, 700], [0, 45]] as const) {
      sizes = resizeAt(sizes, i, d, specs)
      expect(sum(sizes)).toBeCloseTo(total, 6)
      sizes.forEach((v, k) => expect(v).toBeGreaterThanOrEqual(specs[k]!.min!))
    }
  })
})
