// Reading and writing remembered UI settings.
//
// The parsing is here, separate from any framework, because the interesting part is what happens to
// a stored value that is corrupt, from an older version, or of the wrong shape — and that deserves
// a test rather than a shrug. A bad stored value must never break the view it belongs to.

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type Validator<T> = (value: unknown) => value is T

/** Reads a stored preference, falling back to `initial` whenever the stored value is unusable. */
export function readPref<T>(
  storage: StorageLike | undefined,
  key: string,
  initial: T,
  validate?: Validator<T>
): T {
  if (!storage) return initial

  let raw: string | null
  try {
    raw = storage.getItem(key)
  } catch {
    return initial // Storage can be unavailable entirely, not just empty.
  }
  if (raw === null) return initial

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return initial
  }

  if (validate) return validate(parsed) ? parsed : initial

  // Without a validator, insist at least that the shape matches the default's.
  if (parsed === null || initial === null) return (parsed as T) ?? initial
  if (Array.isArray(initial) !== Array.isArray(parsed)) return initial
  if (typeof parsed !== typeof initial) return initial
  return parsed as T
}

export function writePref(storage: StorageLike | undefined, key: string, value: unknown): void {
  if (!storage) return
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // A full or disabled storage must not break the setting it was meant to remember.
  }
}

/** Validator for a value drawn from a fixed set, which covers most view settings. */
export const oneOf = <T extends string>(...allowed: readonly T[]): Validator<T> =>
  ((v: unknown): v is T => typeof v === 'string' && (allowed as readonly string[]).includes(v))

export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'

export const isNumberIn = (min: number, max: number): Validator<number> =>
  ((v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max)
