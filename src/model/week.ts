/**
 * Week / bell schedules (spec §2.1). The explicit slot list in each
 * BellSchedule is the stored truth; `generateBellSchedule` builds one from a
 * pattern. Solver, validation, grids and export all derive days/slots from
 * here — nothing hardcodes a number of days or periods.
 */
import { newId } from './ids'
import { resolveRules } from './rules'
import type { BellSchedule, Issue, Rules, Slot, Week, Weekday } from './types'

export const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

export function parseTime(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(typeof hhmm === 'string' ? hhmm.trim() : '')
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Pattern for generating a bell schedule (spec §2.1 "generated from a pattern"). */
export interface BellPattern {
  startTime: string
  /** Latest time the last period may end. */
  endTime: string
  periodLengthMin: number
  breaks: { afterPeriod: number; durationMin: number }[]
  /** Optional cap on the number of periods. */
  maxPeriods?: number
  /** Add a zero-hour lesson slot before period 1. */
  zeroHour?: boolean
}

export const DEFAULT_PATTERN: BellPattern = {
  startTime: '08:00',
  endTime: '14:45',
  periodLengthMin: 45,
  breaks: [
    { afterPeriod: 2, durationMin: 20 },
    { afterPeriod: 4, durationMin: 15 },
    { afterPeriod: 6, durationMin: 10 },
  ],
}

/**
 * Lays out periods from startTime; a break is inserted after its period; periods
 * are added while the next one ends at or before endTime. Consecutive lesson
 * slots without a break between them are joinable (P1–2, P3–4, … in the default).
 */
export function generateSlots(p: BellPattern): Slot[] {
  const start = parseTime(p.startTime)
  const end = parseTime(p.endTime)
  const len = Math.floor(p.periodLengthMin)
  const slots: Slot[] = []
  if (start === null || end === null || !(len > 0) || end <= start) return slots
  let t = start
  if (p.zeroHour && t - len >= 0) {
    slots.push({ id: newId(), index: 0, type: 'lesson', start: formatTime(t - len), end: formatTime(t), joinableWithNext: false })
  }
  const cap = Math.max(1, Math.min(Math.floor(p.maxPeriods ?? 24), 24)) // numbered periods only; zero hour doesn't count
  for (let idx = 1; idx <= cap; idx++) {
    if (t + len > end) break
    slots.push({ id: newId(), index: idx, type: 'lesson', start: formatTime(t), end: formatTime(t + len), joinableWithNext: false })
    t += len
    const brk = p.breaks.filter((b) => b.afterPeriod === idx && b.durationMin > 0).reduce((a, b) => a + Math.floor(b.durationMin), 0)
    if (brk > 0) {
      // A break is never dropped: the next period starts after it, and only if it still ends by endTime.
      if (t + brk + len > end || idx >= cap) break
      slots.push({ id: newId(), index: idx, type: 'break', start: formatTime(t), end: formatTime(t + brk), joinableWithNext: false })
      t += brk
    }
  }
  for (let i = 0; i < slots.length - 1; i++) {
    const a = slots[i]
    const b = slots[i + 1]
    a.joinableWithNext = a.type === 'lesson' && b.type === 'lesson' && a.index >= 1 && a.index % 2 === 1
  }
  return slots
}

export function generateBellSchedule(name: string, p: BellPattern): BellSchedule {
  return { id: newId(), name, slots: generateSlots(p) }
}

export type WeekTemplate = 'sunThu' | 'sunFri'

/**
 * Spec §2.1 templates:
 *  - sunThu (default): 08:00, 45-min periods, breaks 20/15/10 after P2/P4/P6 → 8 periods ending 14:45
 *  - sunFri: the same plus a Friday schedule P1–P5 ending 12:20
 */
export function weekFromTemplate(template: WeekTemplate, names = { regular: 'Regular', friday: 'Friday' }): Week {
  const regular = generateBellSchedule(names.regular, DEFAULT_PATTERN)
  if (template === 'sunThu') {
    return { days: [0, 1, 2, 3, 4], bellSchedules: [regular], dayBellSchedule: { 0: regular.id, 1: regular.id, 2: regular.id, 3: regular.id, 4: regular.id } }
  }
  const friday = generateBellSchedule(names.friday, { ...DEFAULT_PATTERN, endTime: '12:20', maxPeriods: 5 })
  return {
    days: [0, 1, 2, 3, 4, 5],
    bellSchedules: [regular, friday],
    dayBellSchedule: { 0: regular.id, 1: regular.id, 2: regular.id, 3: regular.id, 4: regular.id, 5: friday.id },
  }
}

/** Teaching days in Sunday-first order. */
export function teachingDays(week: Week): Weekday[] {
  return ALL_WEEKDAYS.filter((d) => week.days.includes(d))
}

export function bellScheduleFor(week: Week, day: Weekday): BellSchedule | undefined {
  const id = week.dayBellSchedule[day]
  return week.bellSchedules.find((b) => b.id === id)
}

/** Lesson slots of a day in order; zero-hour slots only when allowed. */
export function lessonSlots(week: Week, day: Weekday, rules?: Rules): Slot[] {
  if (!week.days.includes(day)) return []
  const bs = bellScheduleFor(week, day)
  if (!bs) return []
  const allowZero = resolveRules(rules).allowZeroHour
  return bs.slots.filter((s) => s.type === 'lesson' && (allowZero || s.index !== 0))
}

export interface DerivedDay {
  day: Weekday
  bellScheduleId: Id | null
  /** All slots of the day's bell schedule (breaks included), for grids. */
  slots: Slot[]
  /** Usable lesson slots (zero hour only when allowed). */
  lessonSlots: Slot[]
}
type Id = string

/** One entry per teaching day, Sunday-first — the single source for grids and the solver. */
export function deriveDays(week: Week, rules?: Rules): DerivedDay[] {
  return teachingDays(week).map((day) => {
    const bs = bellScheduleFor(week, day)
    return { day, bellScheduleId: bs?.id ?? null, slots: bs?.slots ?? [], lessonSlots: lessonSlots(week, day, rules) }
  })
}

export function weeklyLessonSlots(week: Week, rules?: Rules): number {
  return deriveDays(week, rules).reduce((a, d) => a + d.lessonSlots.length, 0)
}

/** Next lesson slot after `slotId` in the day's bell schedule (skipping breaks), or null. */
export function nextLessonSlot(week: Week, day: Weekday, slotId: string): Slot | null {
  const bs = bellScheduleFor(week, day)
  if (!bs) return null
  const i = bs.slots.findIndex((s) => s.id === slotId)
  if (i < 0) return null
  for (let k = i + 1; k < bs.slots.length; k++) if (bs.slots[k].type === 'lesson') return bs.slots[k]
  return null
}

/** Span of a joined pair in minutes. */
export function joinedSpan(a: Slot, b: Slot): number {
  const s = parseTime(a.start)
  const e = parseTime(b.end)
  return s === null || e === null ? Infinity : e - s
}

/** Can (a, next lesson slot b) form a double under the rules? */
export function isValidDouble(week: Week, day: Weekday, aId: string, bId: string, rules?: Rules): boolean {
  const r = resolveRules(rules)
  const usable = lessonSlots(week, day, rules)
  const a = usable.find((s) => s.id === aId)
  if (!a || !a.joinableWithNext) return false
  const b = nextLessonSlot(week, day, aId)
  if (!b || b.id !== bId || !usable.some((s) => s.id === bId)) return false
  return joinedSpan(a, b) <= r.maxJoinedLessonMinutes
}

/** Validates one bell schedule (spec §2.1). */
export function validateBellSchedule(bs: BellSchedule, rules?: Rules): Issue[] {
  const out: Issue[] = []
  const r = resolveRules(rules)
  const ref = { kind: 'week' as const, id: bs.id }
  const e = (code: string, params: Issue['params'] = {}) => out.push({ code, severity: 'error', params: { schedule: bs.name, ...params }, ref })
  let prevEnd = -1
  const ids = new Set<string>()
  bs.slots.forEach((s, i) => {
    if (ids.has(s.id)) e('E_BELL_DUPLICATE_SLOT_ID', { slot: i + 1 })
    ids.add(s.id)
    const st = parseTime(s.start)
    const en = parseTime(s.end)
    if (st === null || en === null) { e('E_BELL_BAD_TIME', { slot: i + 1 }); return }
    if (en <= st) e('E_BELL_END_BEFORE_START', { slot: i + 1, start: s.start, end: s.end })
    if (prevEnd >= 0 && st < prevEnd) e('E_BELL_OVERLAP', { slot: i + 1, start: s.start })
    prevEnd = Math.max(prevEnd, en)
  })
  if (!bs.slots.some((s) => s.type === 'lesson' && (r.allowZeroHour || s.index !== 0))) e('E_BELL_NO_LESSON_SLOTS')
  bs.slots.forEach((s, i) => {
    if (s.type !== 'lesson' || !s.joinableWithNext) return
    const next = bs.slots.slice(i + 1).find((x) => x.type === 'lesson')
    if (!next) { e('E_BELL_JOIN_NO_NEXT', { period: s.index }); return }
    const span = joinedSpan(s, next)
    if (span > r.maxJoinedLessonMinutes) e('E_BELL_JOIN_TOO_LONG', { period: s.index, next: next.index, minutes: span, max: r.maxJoinedLessonMinutes })
  })
  return out
}

/** Validates the week (days, schedule assignment, every bell schedule). */
export function validateWeek(week: Week, rules?: Rules): Issue[] {
  const out: Issue[] = []
  const days = teachingDays(week)
  if (!days.length) out.push({ code: 'E_WEEK_NO_DAYS', severity: 'error', params: {}, ref: { kind: 'week' } })
  else if (days.length < 2) out.push({ code: 'E_WEEK_TOO_FEW_DAYS', severity: 'error', params: { count: days.length, min: 2 }, ref: { kind: 'week' } })
  if (!week.bellSchedules.length) out.push({ code: 'E_WEEK_NO_BELL_SCHEDULES', severity: 'error', params: {}, ref: { kind: 'week' } })
  for (const d of days) {
    const bs = bellScheduleFor(week, d)
    if (!bs) out.push({ code: 'E_WEEK_DAY_NO_SCHEDULE', severity: 'error', params: { day: d }, ref: { kind: 'week' } })
  }
  const used = new Set(days.map((d) => week.dayBellSchedule[d]))
  for (const bs of week.bellSchedules) if (used.has(bs.id)) out.push(...validateBellSchedule(bs, rules))
  return out
}
