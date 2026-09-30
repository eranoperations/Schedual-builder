/**
 * Independent timetable checker (spec §3.1). Pure; works on the model only
 * (it shares no code with the search), and is used by the tests, by the app
 * after every solve, and by `canMove` (future drag & drop).
 */
import { resolveRules } from '../model/rules'
import type { Block, Issue, Lesson, SchoolSnapshot, Slot, StudyGroup, Weekday } from '../model/types'
import { isValidDouble, lessonSlots, teachingDays, bellScheduleFor } from '../model/week'
import { resolveRoomRequirement } from './compile'
import { nameLookup } from './names'
import { lessonTeacherIds } from '../model/lessons'

type Checker = (data: SchoolSnapshot, lessons: Lesson[]) => Issue[]

const err = (code: string, params: Issue['params'], ref?: Issue['ref']): Issue => ({ code, severity: 'error', params, ...(ref ? { ref } : {}) })

function ctx(data: SchoolSnapshot) {
  const groups = new Map(data.groups.map((g) => [g.id, g]))
  const teachers = new Map(data.teachers.map((t) => [t.id, t]))
  const classes = new Map(data.classes.map((c) => [c.id, c]))
  const rooms = new Map(data.rooms.map((r) => [r.id, r]))
  const name = nameLookup(data)
  const slotInfo = (day: Weekday, id: string): Slot | undefined => bellScheduleFor(data.school.week, day)?.slots.find((s) => s.id === id)
  const period = (day: Weekday, id: string) => slotInfo(day, id)?.index ?? '?'
  return { groups, teachers, classes, rooms, name, slotInfo, period }
}

/** Expands lessons to (resource, day, slotId) occupancy and reports clashes. */
export const checkClashes: Checker = (data, lessons) => {
  const { groups, name, period } = ctx(data)
  const occ = new Map<string, Lesson[]>()
  const push = (k: string, l: Lesson) => { const a = occ.get(k); if (a) a.push(l); else occ.set(k, [l]) }
  for (const l of lessons) {
    const g = groups.get(l.studyGroupId)
    if (!g) continue
    for (const s of l.slotIds) {
      for (const t of new Set(lessonTeacherIds(g, l))) push(`teacher|${t}|${l.day}|${s}`, l)
      for (const c of new Set(g.classIds)) push(`class|${c}|${l.day}|${s}`, l)
      for (const r of new Set(l.roomIds)) push(`room|${r}|${l.day}|${s}`, l)
    }
  }
  const out: Issue[] = []
  for (const [k, list] of occ) {
    if (list.length < 2) continue
    const [kind, id, day, slot] = k.split('|')
    const code = kind === 'teacher' ? 'V_TEACHER_CLASH' : kind === 'class' ? 'V_CLASS_CLASH' : 'V_ROOM_CLASH'
    out.push(err(code, { name: name(id), day: Number(day), period: period(Number(day) as Weekday, slot), count: list.length },
      { kind: kind as 'teacher' | 'class' | 'room', id }))
  }
  return out
}

/** Each group gets exactly weeklyHours, with exactly `doubles` doubles. */
export const checkGroupHours: Checker = (data, lessons) => {
  const { name } = ctx(data)
  const out: Issue[] = []
  const hours = new Map<string, number>()
  const doubles = new Map<string, number>()
  for (const l of lessons) {
    if (l.slotIds.length < 1 || l.slotIds.length > 2) out.push(err('V_LESSON_LENGTH', { count: l.slotIds.length }, { kind: 'group', id: l.studyGroupId }))
    hours.set(l.studyGroupId, (hours.get(l.studyGroupId) ?? 0) + l.slotIds.length)
    if (l.slotIds.length === 2) doubles.set(l.studyGroupId, (doubles.get(l.studyGroupId) ?? 0) + 1)
  }
  const known = new Set(data.groups.map((g) => g.id))
  for (const id of hours.keys()) if (!known.has(id)) out.push(err('V_UNKNOWN_GROUP', { id }))
  for (const g of data.groups) {
    const p = { subject: name(g.subjectId), class: g.classIds.map(name).join(', ') }
    const h = hours.get(g.id) ?? 0
    if (h !== g.weeklyHours) out.push(err('V_GROUP_HOURS', { ...p, placed: h, required: g.weeklyHours }, { kind: 'group', id: g.id }))
    const d = doubles.get(g.id) ?? 0
    if (d !== (g.doubles || 0)) out.push(err('V_GROUP_DOUBLES', { ...p, placed: d, required: g.doubles || 0 }, { kind: 'group', id: g.id }))
  }
  return out
}

/** A double = two consecutive lesson slots, first joinable, span ≤ maxJoinedLessonMinutes. */
export const checkDoubles: Checker = (data, lessons) => {
  const { period } = ctx(data)
  return lessons
    .filter((l) => l.slotIds.length === 2 && !isValidDouble(data.school.week, l.day, l.slotIds[0], l.slotIds[1], data.school.rules))
    .map((l) => err('V_INVALID_DOUBLE', { day: l.day, period: period(l.day, l.slotIds[0]) }, { kind: 'group', id: l.studyGroupId }))
}

/** Lessons only in lesson slots of teaching days; zero hour only if allowed. */
export const checkValidSlots: Checker = (data, lessons) => {
  const { slotInfo } = ctx(data)
  const days = new Set(teachingDays(data.school.week))
  const allowZero = resolveRules(data.school.rules).allowZeroHour
  const out: Issue[] = []
  for (const l of lessons) {
    if (!days.has(l.day)) { out.push(err('V_NOT_TEACHING_DAY', { day: l.day }, { kind: 'group', id: l.studyGroupId })); continue }
    for (const id of l.slotIds) {
      const s = slotInfo(l.day, id)
      if (!s || s.type !== 'lesson') out.push(err('V_INVALID_SLOT', { day: l.day, slot: id }, { kind: 'group', id: l.studyGroupId }))
      else if (s.index === 0 && !allowZero) out.push(err('V_ZERO_HOUR', { day: l.day }, { kind: 'group', id: l.studyGroupId }))
    }
  }
  return out
}

/**
 * §3.1 #5 qualification and assignment: every lesson has at least one resolved
 * teacher, fixed teachers are never changed, all lessons of a group use the
 * same resolved teacher(s), and every resolved teacher is qualified.
 */
export const checkQualification: Checker = (data, lessons) => {
  const { groups, teachers, name } = ctx(data)
  const out: Issue[] = []
  const resolved = new Map<string, string>()
  const key = (ids: string[]) => [...new Set(ids)].sort().join('|')
  for (const l of lessons) {
    const g = groups.get(l.studyGroupId)
    if (!g) continue
    const p = { subject: name(g.subjectId), class: g.classIds.map(name).join(', ') }
    const ref = { kind: 'group' as const, id: g.id }
    const ts = lessonTeacherIds(g, l)
    if (!ts.length) { out.push(err('V_GROUP_NO_TEACHER', p, ref)); continue }
    if (g.teacherIds.length && key(ts) !== key(g.teacherIds)) out.push(err('V_FIXED_TEACHER_CHANGED', { ...p, teacher: ts.map(name).join(', ') }, ref))
    const k = key(ts)
    const prev = resolved.get(g.id)
    if (prev === undefined) {
      resolved.set(g.id, k)
      for (const tid of new Set(ts)) {
        if (!teachers.get(tid)?.subjectIds.includes(g.subjectId)) out.push(err('V_TEACHER_NOT_QUALIFIED', { teacher: name(tid), subject: name(g.subjectId) }, { kind: 'teacher', id: tid }))
      }
    } else if (prev !== k) out.push(err('V_GROUP_TEACHER_INCONSISTENT', p, ref))
  }
  return out
}

/** No teacher teaches on their day off. */
export const checkDayOff: Checker = (data, lessons) => {
  const { groups, teachers, name } = ctx(data)
  const out: Issue[] = []
  for (const l of lessons) {
    const g = groups.get(l.studyGroupId)
    for (const tid of g ? new Set(lessonTeacherIds(g, l)) : []) {
      if (teachers.get(tid)?.dayOff === l.day) out.push(err('V_TEACHER_DAY_OFF', { teacher: name(tid), day: l.day }, { kind: 'teacher', id: tid }))
    }
  }
  return out
}

function teacherHours(data: SchoolSnapshot, lessons: Lesson[]) {
  const groups = new Map(data.groups.map((g) => [g.id, g]))
  const total = new Map<string, number>()
  const daily = new Map<string, number>()
  for (const l of lessons) {
    const g = groups.get(l.studyGroupId)
    for (const tid of g ? new Set(lessonTeacherIds(g, l)) : []) {
      total.set(tid, (total.get(tid) ?? 0) + l.slotIds.length)
      daily.set(`${tid}|${l.day}`, (daily.get(`${tid}|${l.day}`) ?? 0) + l.slotIds.length)
    }
  }
  return { total, daily }
}

/** Placed hours ≤ X. */
export const checkWeeklyCap: Checker = (data, lessons) => {
  const { total } = teacherHours(data, lessons)
  return data.teachers
    .filter((t) => (total.get(t.id) ?? 0) > t.maxWeeklyHours)
    .map((t) => err('V_TEACHER_WEEKLY_CAP', { teacher: t.name, assigned: total.get(t.id) ?? 0, max: t.maxWeeklyHours }, { kind: 'teacher', id: t.id }))
}

/** Placed hours per day ≤ maxDailyHours (default rules.maxTeacherDailyHours). */
export const checkDailyCap: Checker = (data, lessons) => {
  const { daily } = teacherHours(data, lessons)
  const rule = resolveRules(data.school.rules).maxTeacherDailyHours
  const out: Issue[] = []
  for (const t of data.teachers) {
    const cap = typeof t.maxDailyHours === 'number' && t.maxDailyHours > 0 ? t.maxDailyHours : rule
    for (const d of teachingDays(data.school.week)) {
      const h = daily.get(`${t.id}|${d}`) ?? 0
      if (h > cap) out.push(err('V_TEACHER_DAILY_CAP', { teacher: t.name, day: d, hours: h, max: cap }, { kind: 'teacher', id: t.id }))
    }
  }
  return out
}

/** Each class of a lesson gets a room satisfying the group's requirement (or none when not needed). */
export const checkRooms: Checker = (data, lessons) => {
  const { groups, classes, rooms, name, period } = ctx(data)
  const out: Issue[] = []
  for (const l of lessons) {
    const g = groups.get(l.studyGroupId)
    if (!g) continue
    const req = resolveRoomRequirement(data, g.room, g.subjectId)
    const p = { subject: name(g.subjectId), class: g.classIds.map(name).join(', '), day: l.day, period: period(l.day, l.slotIds[0]) }
    const ref = { kind: 'group' as const, id: g.id }
    if (req === 'none') {
      if (l.roomIds.length) out.push(err('V_ROOM_NOT_EXPECTED', p, ref))
      continue
    }
    if (l.roomIds.length !== g.classIds.length) { out.push(err('V_ROOM_COUNT', { ...p, count: l.roomIds.length, expected: g.classIds.length }, ref)); continue }
    g.classIds.forEach((cid, k) => {
      const rid = l.roomIds[k]
      const room = rooms.get(rid)
      let ok = !!room
      if (ok && req === 'homeroom') ok = classes.get(cid)?.homeroomRoomId === rid
      else if (ok && typeof req === 'object' && 'roomId' in req) ok = req.roomId === rid
      else if (ok && typeof req === 'object' && 'roomTypeId' in req) ok = room!.roomTypeId === req.roomTypeId
      if (!ok) out.push(err('V_ROOM_REQUIREMENT', { ...p, room: name(rid) }, ref))
    })
  }
  return out
}

function blockCovers(b: Block, day: Weekday, slotId: string): boolean {
  return b.when.some((w) => w.day === day && (!w.slotIds || w.slotIds.length === 0 || w.slotIds.includes(slotId)))
}

/** Does block `b` target any resource of this lesson? */
export function blockHitsLesson(data: SchoolSnapshot, b: Block, g: StudyGroup, l: Lesson): boolean {
  const t = b.target
  if (t.type === 'school') return true
  if (t.type === 'teacher') return lessonTeacherIds(g, l).includes(t.id ?? '')
  if (t.type === 'class') return g.classIds.includes(t.id ?? '')
  if (t.type === 'room') return l.roomIds.includes(t.id ?? '')
  if (t.type === 'grade') return g.classIds.some((cid) => String(data.classes.find((c) => c.id === cid)?.grade) === String(t.id))
  return false
}

/** No lesson in a slot/day hard-blocked for any of its teachers, classes, rooms, grade or the school. */
export const checkHardBlocks: Checker = (data, lessons) => {
  const { groups, name, period } = ctx(data)
  const hard = data.blocks.filter((b) => b.hardness === 'hard')
  const out: Issue[] = []
  for (const l of lessons) {
    const g = groups.get(l.studyGroupId)
    if (!g) continue
    for (const b of hard) {
      if (!l.slotIds.some((s) => blockCovers(b, l.day, s))) continue
      if (!blockHitsLesson(data, b, g, l)) continue
      out.push(err('V_HARD_BLOCK', {
        subject: name(g.subjectId), class: g.classIds.map(name).join(', '), day: l.day, period: period(l.day, l.slotIds[0]),
        target: b.target.type === 'grade' ? String(b.target.id) : b.target.type === 'school' ? '—' : name(b.target.id),
      }, { kind: 'block', id: b.id }))
    }
  }
  return out
}

/** (reserved) All groups of a cluster occupy identical slots. */
export const checkClusters: Checker = (data, lessons) => {
  const out: Issue[] = []
  for (const cl of data.clusters) {
    const sig = (gid: string) => lessons.filter((l) => l.studyGroupId === gid).flatMap((l) => l.slotIds.map((s) => `${l.day}:${s}`)).sort().join(',')
    const sigs = new Set(cl.studyGroupIds.map(sig))
    if (sigs.size > 1) out.push(err('V_CLUSTER_MISMATCH', { cluster: cl.name }, { kind: 'cluster', id: cl.id }))
  }
  return out
}

export const HARD_CHECKERS: Record<string, Checker> = {
  clashes: checkClashes,
  groupHours: checkGroupHours,
  doubles: checkDoubles,
  validSlots: checkValidSlots,
  qualification: checkQualification,
  dayOff: checkDayOff,
  weeklyCap: checkWeeklyCap,
  dailyCap: checkDailyCap,
  rooms: checkRooms,
  hardBlocks: checkHardBlocks,
  clusters: checkClusters,
}

export interface TeacherLoad {
  teacherId: string
  assigned: number
  max: number
  daily: Partial<Record<Weekday, number>>
}

/** Assigned hours vs X, and per-day hours, for every teacher (US-11 AC4). */
export function teacherLoads(data: SchoolSnapshot, lessons: Lesson[]): TeacherLoad[] {
  const { total, daily } = teacherHours(data, lessons)
  return data.teachers.map((t) => ({
    teacherId: t.id,
    assigned: total.get(t.id) ?? 0,
    max: t.maxWeeklyHours,
    daily: Object.fromEntries(teachingDays(data.school.week).map((d) => [d, daily.get(`${t.id}|${d}`) ?? 0])),
  }))
}

export interface VerificationReport {
  ok: boolean
  hardViolations: Issue[]
  hardByChecker: Record<string, number>
  /** Informational (e.g. teachers below X — allowed, never a violation). */
  info: Issue[]
}

/** Runs every hard checker. */
export function verifyTimetable(data: SchoolSnapshot, lessons: Lesson[]): VerificationReport {
  const hardViolations: Issue[] = []
  const hardByChecker: Record<string, number> = {}
  for (const [nm, check] of Object.entries(HARD_CHECKERS)) {
    const v = check(data, lessons)
    hardByChecker[nm] = v.length
    hardViolations.push(...v)
  }
  const info: Issue[] = teacherLoads(data, lessons)
    .filter((l) => l.assigned < l.max)
    .map((l) => ({ code: 'I_TEACHER_UNDER_MAX', severity: 'info', params: { teacher: data.teachers.find((t) => t.id === l.teacherId)!.name, assigned: l.assigned, max: l.max }, ref: { kind: 'teacher', id: l.teacherId } }))
  return { ok: hardViolations.length === 0, hardViolations, hardByChecker, info }
}

export interface MoveCheck {
  ok: boolean
  /** Hard violations the move would introduce. */
  violations: Issue[]
}

/**
 * Pure move check for future drag & drop: would moving `lesson` (an element of
 * `lessons`) to `targetDay`/`targetSlotIds` (and `targetRoomIds`, default: keep)
 * introduce any hard violation?
 */
export function canMove(
  data: SchoolSnapshot,
  lessons: Lesson[],
  lesson: Lesson,
  targetDay: Weekday,
  targetSlotIds: string[],
  targetRoomIds: string[] = lesson.roomIds,
): MoveCheck {
  const idx = lessons.indexOf(lesson)
  const moved: Lesson = { ...lesson, day: targetDay, slotIds: [...targetSlotIds], roomIds: [...targetRoomIds] }
  const next = idx >= 0 ? lessons.map((l, i) => (i === idx ? moved : l)) : [...lessons, moved]
  const key = (i: Issue) => `${i.code}|${JSON.stringify(i.params)}`
  const before = new Map<string, number>()
  for (const i of verifyTimetable(data, lessons).hardViolations) before.set(key(i), (before.get(key(i)) ?? 0) + 1)
  const introduced: Issue[] = []
  for (const i of verifyTimetable(data, next).hardViolations) {
    const k = key(i)
    const n = before.get(k) ?? 0
    if (n > 0) before.set(k, n - 1)
    else introduced.push(i)
  }
  return { ok: introduced.length === 0, violations: introduced }
}

/** Usable lesson slots of a day (re-exported for UI grids). */
export { lessonSlots }
