import { resolveRules } from '../model/rules'
import type { Rules, Slot, Week, Weekday } from '../model/types'
import { deriveDays, joinedSpan, nextLessonSlot } from '../model/week'

/**
 * Dense integer indexing of the usable lesson slots (from model/week.ts) for
 * the solver's hot loops. `s` = 0..S-1 over all usable lesson slots, week order;
 * `di` = dense day index (teaching days with ≥1 usable lesson slot).
 */
export interface SlotIndex {
  count: number
  days: Weekday[]
  dayStart: number[]
  dayLength: number[]
  slotDay: Int32Array
  /** 0-based position within the day's usable lesson slots */
  slotPos: Int32Array
  slot: Slot[]
  /** s -> s+1 when (s, s+1) is a valid double start, else -1 */
  nextJoin: Int32Array
  /** position of the first regular (index ≥ 1) lesson slot per dense day */
  regularStart: number[]
  byId: Map<string, number>
  /** (day, slotId) -> s or -1 */
  slotOf(day: number, slotId: string): number
}

export function buildSlotIndex(week: Week, rules?: Rules): SlotIndex {
  const r = resolveRules(rules)
  const days: Weekday[] = []
  const dayStart: number[] = []
  const dayLength: number[] = []
  const slot: Slot[] = []
  const regularStart: number[] = []
  const dayOfSlot: number[] = []
  const pos: number[] = []
  for (const d of deriveDays(week, rules)) {
    if (!d.lessonSlots.length) continue
    dayStart.push(slot.length)
    dayLength.push(d.lessonSlots.length)
    const reg = d.lessonSlots.findIndex((s) => s.index >= 1)
    regularStart.push(reg < 0 ? 0 : reg)
    d.lessonSlots.forEach((s, p) => { slot.push(s); dayOfSlot.push(days.length); pos.push(p) })
    days.push(d.day)
  }
  const count = slot.length
  const slotDay = Int32Array.from(dayOfSlot)
  const slotPos = Int32Array.from(pos)
  const nextJoin = new Int32Array(count).fill(-1)
  const byId = new Map<string, number>()
  for (let s = 0; s < count; s++) byId.set(`${days[slotDay[s]]}:${slot[s].id}`, s)
  for (let s = 0; s < count - 1; s++) {
    if (slotDay[s + 1] !== slotDay[s] || !slot[s].joinableWithNext) continue
    const next = nextLessonSlot(week, days[slotDay[s]], slot[s].id)
    if (next && next.id === slot[s + 1].id && joinedSpan(slot[s], next) <= r.maxJoinedLessonMinutes) nextJoin[s] = s + 1
  }
  return {
    count, days, dayStart, dayLength, slotDay, slotPos, slot, nextJoin, regularStart, byId,
    slotOf: (day, slotId) => byId.get(`${day}:${slotId}`) ?? -1,
  }
}
