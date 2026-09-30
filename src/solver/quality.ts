/**
 * Soft metrics, weighted soft score and the quality report (spec §3.3),
 * computed from model lessons. `softScore` equals the optimiser's objective.
 */
import { MAX_GROUP_HOURS_PER_DAY, resolvePreferences, weightsFromPreferences } from '../model/preferences'
import type { Lesson, QualityMetric, QualityMetricKey, SchoolSnapshot, SoftWeights, Weekday } from '../model/types'
import { deriveDays } from '../model/week'
import { blockHitsLesson } from './verify'

type Contrib = Map<string, number>
const bump = (m: Contrib, k: string, v: number) => { if (v) m.set(k, (m.get(k) ?? 0) + v) }

export function softMetrics(data: SchoolSnapshot, lessons: Lesson[], maxPerDay = MAX_GROUP_HOURS_PER_DAY) {
  const days = deriveDays(data.school.week, data.school.rules).filter((d) => d.lessonSlots.length)
  const pos = new Map<string, number>()
  const regStart = new Map<Weekday, number>()
  for (const d of days) {
    d.lessonSlots.forEach((s, p) => pos.set(`${d.day}:${s.id}`, p))
    const r = d.lessonSlots.findIndex((s) => s.index >= 1)
    regStart.set(d.day, r < 0 ? 0 : r)
  }
  const groups = new Map(data.groups.map((g) => [g.id, g]))
  const teacherDay = new Map<string, Set<number>>()
  const classDay = new Map<string, Set<number>>()
  const groupDay = new Map<string, number>()
  const teacherTot = new Map<string, number>()
  const teacherDayH = new Map<string, number>()
  const byTeacher = { gaps: new Map() as Contrib, balance: new Map() as Contrib, softBlocks: new Map() as Contrib }
  const byClass = { gaps: new Map() as Contrib, softBlocks: new Map() as Contrib }
  const byGroup = { spread: new Map() as Contrib }
  let softBlockLessons = 0
  const soft = data.blocks.filter((b) => b.hardness === 'soft')
  for (const l of lessons) {
    const g = groups.get(l.studyGroupId)
    if (!g) continue
    const ps = l.slotIds.map((s) => pos.get(`${l.day}:${s}`)).filter((p): p is number => p !== undefined)
    for (const t of new Set(g.teacherIds)) {
      const k = `${t}|${l.day}`
      const set = teacherDay.get(k) ?? new Set<number>()
      ps.forEach((p) => set.add(p))
      teacherDay.set(k, set)
      teacherTot.set(t, (teacherTot.get(t) ?? 0) + l.slotIds.length)
      teacherDayH.set(k, (teacherDayH.get(k) ?? 0) + l.slotIds.length)
    }
    for (const c of new Set(g.classIds)) {
      const k = `${c}|${l.day}`
      const set = classDay.get(k) ?? new Set<number>()
      ps.forEach((p) => set.add(p))
      classDay.set(k, set)
    }
    const gk = `${g.id}|${l.day}`
    groupDay.set(gk, (groupDay.get(gk) ?? 0) + l.slotIds.length)
    const hit = soft.some((b) => b.when.some((w) => w.day === l.day && (!w.slotIds?.length || l.slotIds.some((s) => w.slotIds!.includes(s)))) && blockHitsLesson(data, b, g, l))
    if (hit) {
      softBlockLessons++
      g.teacherIds.forEach((t) => bump(byTeacher.softBlocks, t, 1))
      g.classIds.forEach((c) => bump(byClass.softBlocks, c, 1))
    }
  }
  let teacherGaps = 0
  for (const [k, set] of teacherDay) {
    const arr = [...set]
    const gap = Math.max(...arr) - Math.min(...arr) + 1 - set.size
    teacherGaps += gap
    bump(byTeacher.gaps, k.split('|')[0], gap)
  }
  let classGaps = 0
  for (const [k, set] of classDay) {
    const [c, d] = k.split('|')
    const reg = regStart.get(Number(d) as Weekday) ?? 0
    const arr = [...set].filter((p) => p >= reg)
    if (!arr.length) continue
    const gap = Math.max(...arr) - reg + 1 - arr.length
    classGaps += gap
    bump(byClass.gaps, c, gap)
  }
  let spreadDaysOver = 0
  let spreadExcessHours = 0
  for (const [k, h] of groupDay) {
    if (h > maxPerDay) {
      spreadDaysOver++
      spreadExcessHours += h - maxPerDay
      bump(byGroup.spread, k.split('|')[0], 1)
    }
  }
  let balance = 0
  for (const t of data.teachers) {
    const tot = teacherTot.get(t.id) ?? 0
    if (!tot) continue
    const work = days.filter((d) => d.day !== t.dayOff)
    if (!work.length) continue
    const avg = tot / work.length
    let dev = 0
    for (const d of work) dev += Math.abs((teacherDayH.get(`${t.id}|${d.day}`) ?? 0) - avg)
    balance += dev
    bump(byTeacher.balance, t.id, dev)
  }
  return { teacherGaps, classGaps, spreadDaysOver, spreadExcessHours, balance, softBlockLessons, byTeacher, byClass, byGroup }
}

export interface SoftScore {
  total: number
  breakdown: Record<'teacherGaps' | 'classGaps' | 'spreadExcess' | 'teacherLoadBalance' | 'softBlocks', { count: number; weight: number; penalty: number }>
}

export function softScore(data: SchoolSnapshot, lessons: Lesson[], weights: SoftWeights = weightsFromPreferences(data.school.preferences)): SoftScore {
  const m = softMetrics(data, lessons, weights.maxGroupHoursPerDay)
  const item = (count: number, weight: number) => ({ count, weight, penalty: count * weight })
  const breakdown = {
    teacherGaps: item(m.teacherGaps, weights.teacherGaps),
    classGaps: item(m.classGaps, weights.classGaps),
    spreadExcess: item(m.spreadExcessHours, weights.spreadExcess),
    teacherLoadBalance: item(m.balance, weights.teacherLoadBalance),
    softBlocks: item(m.softBlockLessons, weights.softBlocks),
  }
  return { total: Object.values(breakdown).reduce((a, x) => a + x.penalty, 0), breakdown }
}

const round1 = (x: number) => Math.round(x * 10) / 10

/** Quality report: each preference's count now vs on the first valid solution, with affected records. */
export function qualityReport(data: SchoolSnapshot, lessons: Lesson[], initialLessons: Lesson[] = lessons): QualityMetric[] {
  const prefs = resolvePreferences(data.school.preferences)
  const now = softMetrics(data, lessons)
  const first = softMetrics(data, initialLessons)
  const line = (key: QualityMetricKey, pick: (m: typeof now) => number, kind: 'teacher' | 'class' | 'group', c: Contrib, c2?: [Contrib, 'class']): QualityMetric => ({
    key,
    enabled: prefs[key],
    count: round1(pick(now)),
    initialCount: round1(pick(first)),
    affected: [
      ...[...c.entries()].map(([id, n]) => ({ kind, id, count: round1(n) })),
      ...(c2 ? [...c2[0].entries()].map(([id, n]) => ({ kind: c2[1], id, count: round1(n) })) : []),
    ].filter((a) => a.count > 0).sort((a, b) => b.count - a.count),
  })
  return [
    line('avoidTeacherGaps', (m) => m.teacherGaps, 'teacher', now.byTeacher.gaps),
    line('compactClassDays', (m) => m.classGaps, 'class', now.byClass.gaps),
    line('spreadSubjects', (m) => m.spreadDaysOver, 'group', now.byGroup.spread),
    line('balanceTeacherLoad', (m) => m.balance, 'teacher', now.byTeacher.balance),
    line('respectSoftBlocks', (m) => m.softBlockLessons, 'teacher', now.byTeacher.softBlocks, [now.byClass.softBlocks, 'class']),
  ]
}
