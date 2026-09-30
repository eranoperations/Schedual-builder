import { newId, nowIso } from './ids'
import type { RoomType, School, SolverOptions } from './types'
import { weekFromTemplate, type WeekTemplate } from './week'

export { newId, nowIso }

export function defaultSolverOptions(): SolverOptions {
  return { seed: 1, timeLimitMs: 30000, optimizeIterations: 300000, maxAttempts: 60 }
}

export function newSchool(name: string, template: WeekTemplate = 'sunThu', scheduleNames?: { regular: string; friday: string }): School {
  const t = nowIso()
  return {
    id: newId(), createdAt: t, updatedAt: t, name,
    week: weekFromTemplate(template, scheduleNames),
    rules: {},
    preferences: {},
  }
}

/** Common fields for a new record scoped to `schoolId`. */
export function scoped(schoolId: string) {
  const t = nowIso()
  return { id: newId(), schoolId, createdAt: t, updatedAt: t }
}

/** Spec US-2 AC1: editable suggestions seeded into a new school. */
export const ROOM_TYPE_SUGGESTIONS = {
  he: ['כיתה', 'מעבדת מדעים', 'חדר מחשבים', 'אולם ספורט', 'חדר אמנות', 'חדר מוזיקה', 'ספרייה'],
  en: ['Classroom', 'Science lab', 'Computer room', 'Gym', 'Art room', 'Music room', 'Library'],
} as const

export function seedRoomTypes(schoolId: string, lang: 'he' | 'en' = 'he'): RoomType[] {
  return ROOM_TYPE_SUGGESTIONS[lang].map((name) => ({ ...scoped(schoolId), name }))
}

const GRADE_LETTERS: Record<number, string> = { 1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט', 10: 'י', 11: 'י״א', 12: 'י״ב' }

/** Hebrew grade letter with geresh, e.g. 7 → ז׳ (design-spec §2.1 rule 9: U+05F3/U+05F4, never ASCII quotes). */
export function gradeLabel(grade: number): string {
  const g = GRADE_LETTERS[grade] ?? String(grade)
  return g.includes('״') || !GRADE_LETTERS[grade] ? g : `${g}׳`
}

/** Auto display name, e.g. (7, 3) → ז׳3. */
export function classDisplayName(grade: number, parallel: number): string {
  const g = GRADE_LETTERS[grade] ?? String(grade)
  return g.includes('״') ? `${g}${parallel}` : `${g}׳${parallel}`
}

/**
 * Subject colours are stored as design-system palette keys ("subject-1".."subject-12";
 * design-spec §3.4). Order = the spec's auto-assignment order (max distinguishability first).
 */
export const SUBJECT_PALETTE = [
  'subject-1', 'subject-9', 'subject-6', 'subject-12', 'subject-10', 'subject-5',
  'subject-3', 'subject-2', 'subject-11', 'subject-8', 'subject-7', 'subject-4',
] as const
export const SUBJECT_COLOR_KEYS = Array.from({ length: 12 }, (_, i) => `subject-${i + 1}`)

/** Next palette key for a new subject (least used first, in auto-assignment order). */
export function nextSubjectColor(used: string[]): string {
  let best: string = SUBJECT_PALETTE[0]
  let bestN = Infinity
  for (const k of SUBJECT_PALETTE) {
    const n = used.filter((u) => u === k).length
    if (n < bestN) { best = k; bestN = n }
  }
  return best
}
