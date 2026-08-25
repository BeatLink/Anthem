// Reactive wrapper over shared/prefs. The logic lives there; this only ties it to the UI framework,
// so remembering a setting is one line at the call site.

import { readPref, writePref, type Validator } from '@shared/prefs'

const storage = (): Storage | undefined =>
  typeof localStorage === 'undefined' ? undefined : localStorage

export interface Pref<T> {
  value: T
}

export function pref<T>(key: string, initial: T, validate?: Validator<T>): Pref<T> {
  const full = `anthem.pref.${key}`
  let current = $state(readPref(storage(), full, initial, validate))

  return {
    get value(): T {
      return current
    },
    set value(next: T) {
      current = next
      writePref(storage(), full, next)
    }
  }
}
