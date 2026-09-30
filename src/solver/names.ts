import type { SchoolSnapshot } from '../model/types'

/** Id -> display name lookups used when building Issue params. */
export function nameLookup(data: SchoolSnapshot) {
  const m = new Map<string, string>()
  for (const x of data.subjects) m.set(x.id, x.name)
  for (const x of data.rooms) m.set(x.id, x.name)
  for (const x of data.roomTypes) m.set(x.id, x.name)
  for (const x of data.teachers) m.set(x.id, x.name)
  for (const x of data.classes) m.set(x.id, x.displayName)
  return (id: string | null | undefined): string => (id ? (m.get(id) ?? id) : '—')
}
