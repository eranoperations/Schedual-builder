/** Row model for timetable and block grids: rows = lesson indexes across the shown days, plus break rows. */
import { resolveRules } from '../model/rules'
import type { Rules, Slot, Week, Weekday } from '../model/types'
import { bellScheduleFor, teachingDays } from '../model/week'

export type GridRow =
  | { kind: 'lesson'; index: number; label: Slot | null }
  | { kind: 'break'; after: number }

export interface GridModel {
  days: Weekday[]
  rows: GridRow[]
  /** day → index → lesson slot */
  slotAt: (day: Weekday, index: number) => Slot | undefined
  /** day → break after lesson index */
  breakAfter: (day: Weekday, index: number) => Slot | undefined
}

export function gridModel(week: Week, rules?: Rules): GridModel {
  const r = resolveRules(rules)
  const days = teachingDays(week)
  const lessonMap = new Map<string, Slot>()
  const breakMap = new Map<string, Slot>()
  const idx = new Set<number>()
  const labelCount = new Map<number, Map<string, { slot: Slot; n: number }>>()
  for (const d of days) {
    const bs = bellScheduleFor(week, d)
    if (!bs) continue
    let last = -1
    for (const s of bs.slots) {
      if (s.type === 'lesson') {
        if (s.index === 0 && !r.allowZeroHour) continue
        lessonMap.set(`${d}:${s.index}`, s)
        idx.add(s.index)
        last = s.index
        const m = labelCount.get(s.index) ?? new Map()
        const k = `${s.start}-${s.end}`
        m.set(k, { slot: s, n: (m.get(k)?.n ?? 0) + 1 })
        labelCount.set(s.index, m)
      } else if (last >= 0) breakMap.set(`${d}:${last}`, s)
    }
  }
  const sorted = [...idx].sort((a, b) => a - b)
  const rows: GridRow[] = []
  sorted.forEach((i, k) => {
    const common = [...(labelCount.get(i)?.values() ?? [])].sort((a, b) => b.n - a.n)[0]?.slot ?? null
    rows.push({ kind: 'lesson', index: i, label: common })
    if (k < sorted.length - 1 && days.some((d) => breakMap.has(`${d}:${i}`))) rows.push({ kind: 'break', after: i })
  })
  return {
    days, rows,
    slotAt: (d, i) => lessonMap.get(`${d}:${i}`),
    breakAfter: (d, i) => breakMap.get(`${d}:${i}`),
  }
}

export const minutes = (s: Slot) => {
  const [a, b] = s.start.split(':').map(Number)
  const [c, d] = s.end.split(':').map(Number)
  return c * 60 + d - (a * 60 + b)
}
