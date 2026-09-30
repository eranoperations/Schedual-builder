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

const GRADE_LETTERS: Record<number, string> = { 1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט', 10: 'י', 11: 'י"א', 12: 'י"ב' }

/** Auto display name, e.g. (7, 3) → ז'3. */
export function classDisplayName(grade: number, parallel: number): string {
  const g = GRADE_LETTERS[grade] ?? String(grade)
  return g.includes('"') ? `${g}${parallel}` : `${g}'${parallel}`
}

export const SUBJECT_PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948',
  '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac', '#86bcb6', '#d37295',
  '#a0cbe8', '#ffbe7d', '#8cd17d', '#f1ce63',
]
