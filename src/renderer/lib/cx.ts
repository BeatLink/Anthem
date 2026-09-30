// Joins class names, skipping the falsy ones, so conditional classes read as one expression.
export const cx = (...names: (string | false | null | undefined)[]): string =>
  names.filter(Boolean).join(' ')
