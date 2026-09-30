/**
 * Integer-indexed view of a SchoolSnapshot for the solver's hot loops.
 * Flat typed arrays are indexed as `entity * S + slot`.
 */
import { weightsFromPreferences } from '../model/preferences'
import { resolveRules } from '../model/rules'
import type { RoomOverride, Rules, SchoolSnapshot, SoftWeights } from '../model/types'
import { buildSlotIndex, type SlotIndex } from './slots'

export type CRoomReq =
  | { kind: 'none' }
  | { kind: 'homeroom' }
  | { kind: 'type'; rooms: number[] }
  | { kind: 'room'; room: number }
  | { kind: 'invalid' }

export interface CGroup {
  id: string
  subj: number
  teachers: number[]
  classes: number[]
  hours: number
  doubles: number
  singles: number
  room: CRoomReq
  /** Static validity (references, hours, room, fixed teachers qualified / auto group has a candidate). */
  baseValid: boolean
  /** baseValid AND a resolved teacher exists (auto groups: after `applyAssignment`). Used by the search. */
  valid: boolean
  /** No fixed teacher: the solver picks one of `candidates`. */
  auto: boolean
  /** Auto groups: qualified teacher indices (empty for fixed groups). */
  candidates: number[]
}

export interface Compiled {
  data: SchoolSnapshot
  rules: Required<Rules>
  weights: SoftWeights
  slots: SlotIndex
  S: number
  D: number
  nClass: number
  nTeacher: number
  nRoom: number
  groups: CGroup[]
  classIdx: Map<string, number>
  teacherIdx: Map<string, number>
  roomIdx: Map<string, number>
  groupIdx: Map<string, number>
  /** teacher can teach at slot: not day off, not hard-blocked */
  teacherOk: Uint8Array
  classOk: Uint8Array
  roomOk: Uint8Array
  /** soft-blocked (teacher/class/room incl. grade & school blocks) */
  teacherSoft: Uint8Array
  classSoft: Uint8Array
  roomSoft: Uint8Array
  classHomeroom: Int32Array
  teacherDailyCap: Int32Array
  teacherWeeklyCap: Int32Array
  /** dense day index of each teacher's day off (-1 if not a teaching day) */
  teacherDayOff: Int32Array
}

export function resolveRoomRequirement(data: SchoolSnapshot, groupRoom: RoomOverride | undefined, subjectId: string): RoomOverride {
  if (groupRoom) return groupRoom
  return data.subjects.find((s) => s.id === subjectId)?.defaultRoom ?? 'homeroom'
}

export function compile(data: SchoolSnapshot, weightOverrides: Partial<SoftWeights> = {}): Compiled {
  const rules = resolveRules(data.school.rules)
  const weights = { ...weightsFromPreferences(data.school.preferences), ...weightOverrides }
  const slots = buildSlotIndex(data.school.week, data.school.rules)
  const S = slots.count
  const D = slots.days.length
  const classIdx = new Map(data.classes.map((c, i) => [c.id, i]))
  const teacherIdx = new Map(data.teachers.map((t, i) => [t.id, i]))
  const roomIdx = new Map(data.rooms.map((r, i) => [r.id, i]))
  const subjIdx = new Map(data.subjects.map((s, i) => [s.id, i]))
  const nClass = data.classes.length
  const nTeacher = data.teachers.length
  const nRoom = data.rooms.length

  const teacherOk = new Uint8Array(nTeacher * S).fill(1)
  const classOk = new Uint8Array(nClass * S).fill(1)
  const roomOk = new Uint8Array(nRoom * S).fill(1)
  const teacherSoft = new Uint8Array(nTeacher * S)
  const classSoft = new Uint8Array(nClass * S)
  const roomSoft = new Uint8Array(nRoom * S)
  const teacherDayOff = new Int32Array(nTeacher).fill(-1)
  data.teachers.forEach((t, ti) => {
    const di = slots.days.indexOf(t.dayOff)
    teacherDayOff[ti] = di
    if (di >= 0) for (let p = 0; p < slots.dayLength[di]; p++) teacherOk[ti * S + slots.dayStart[di] + p] = 0
  })

  for (const b of data.blocks) {
    const hard = b.hardness === 'hard'
    const affected: { arr: Uint8Array; idx: number }[] = []
    const t = b.target
    const pickArr = (kind: 'teacher' | 'class' | 'room') =>
      kind === 'teacher' ? (hard ? teacherOk : teacherSoft) : kind === 'class' ? (hard ? classOk : classSoft) : (hard ? roomOk : roomSoft)
    if (t.type === 'teacher' && t.id && teacherIdx.has(t.id)) affected.push({ arr: pickArr('teacher'), idx: teacherIdx.get(t.id)! })
    else if (t.type === 'class' && t.id && classIdx.has(t.id)) affected.push({ arr: pickArr('class'), idx: classIdx.get(t.id)! })
    else if (t.type === 'room' && t.id && roomIdx.has(t.id)) affected.push({ arr: pickArr('room'), idx: roomIdx.get(t.id)! })
    else if (t.type === 'grade') data.classes.forEach((c, ci) => { if (String(c.grade) === String(t.id)) affected.push({ arr: pickArr('class'), idx: ci }) })
    else if (t.type === 'school') {
      for (let i = 0; i < nTeacher; i++) affected.push({ arr: pickArr('teacher'), idx: i })
      for (let i = 0; i < nClass; i++) affected.push({ arr: pickArr('class'), idx: i })
      for (let i = 0; i < nRoom; i++) affected.push({ arr: pickArr('room'), idx: i })
    }
    for (const w of b.when) {
      const di = slots.days.indexOf(w.day)
      if (di < 0) continue
      const ss: number[] = []
      if (!w.slotIds || w.slotIds.length === 0) for (let p = 0; p < slots.dayLength[di]; p++) ss.push(slots.dayStart[di] + p)
      else for (const id of w.slotIds) { const s = slots.slotOf(w.day, id); if (s >= 0) ss.push(s) }
      for (const a of affected) for (const s of ss) a.arr[a.idx * S + s] = hard ? 0 : 1
    }
  }

  const classHomeroom = new Int32Array(nClass).fill(-1)
  data.classes.forEach((c, ci) => { if (c.homeroomRoomId && roomIdx.has(c.homeroomRoomId)) classHomeroom[ci] = roomIdx.get(c.homeroomRoomId)! })

  const teacherDailyCap = new Int32Array(nTeacher)
  const teacherWeeklyCap = new Int32Array(nTeacher)
  data.teachers.forEach((t, ti) => {
    const cap = typeof t.maxDailyHours === 'number' && t.maxDailyHours > 0 ? t.maxDailyHours : rules.maxTeacherDailyHours
    teacherDailyCap[ti] = Math.max(0, Math.floor(cap))
    teacherWeeklyCap[ti] = Math.max(0, Math.floor(t.maxWeeklyHours))
  })

  const roomsOfType = new Map<string, number[]>()
  data.rooms.forEach((r, ri) => {
    const arr = roomsOfType.get(r.roomTypeId) ?? []
    arr.push(ri)
    roomsOfType.set(r.roomTypeId, arr)
  })

  const groups: CGroup[] = data.groups.map((g) => {
    const teachers = g.teacherIds.map((id) => teacherIdx.get(id) ?? -1)
    const classes = g.classIds.map((id) => classIdx.get(id) ?? -1)
    const subj = subjIdx.get(g.subjectId) ?? -1
    const hours = Math.max(0, Math.floor(g.weeklyHours))
    const doubles = Math.max(0, Math.floor(g.doubles || 0))
    const req = resolveRoomRequirement(data, g.room, g.subjectId)
    let room: CRoomReq
    if (req === 'none') room = { kind: 'none' }
    else if (req === 'homeroom') room = { kind: 'homeroom' }
    else if ('roomId' in req) room = roomIdx.has(req.roomId) ? { kind: 'room', room: roomIdx.get(req.roomId)! } : { kind: 'invalid' }
    else room = (roomsOfType.get(req.roomTypeId)?.length ?? 0) ? { kind: 'type', rooms: roomsOfType.get(req.roomTypeId)! } : { kind: 'invalid' }
    const auto = g.teacherIds.length === 0
    const qualified = g.teacherIds.every((id) => data.teachers.find((t) => t.id === id)?.subjectIds.includes(g.subjectId))
    const candidates: number[] = []
    if (auto) data.teachers.forEach((t, ti) => { if (t.subjectIds.includes(g.subjectId)) candidates.push(ti) })
    const baseValid = subj >= 0 && (auto ? candidates.length > 0 : teachers.every((t) => t >= 0)) && classes.length > 0 &&
      classes.every((c) => c >= 0) && qualified && hours > 0 && doubles * 2 <= hours && room.kind !== 'invalid' &&
      (room.kind !== 'homeroom' || classes.every((c) => classHomeroom[c] >= 0))
    const resolved = auto ? [] : teachers.filter((t) => t >= 0)
    return {
      id: g.id, subj, teachers: resolved, classes: classes.filter((c) => c >= 0),
      hours, doubles: Math.min(doubles, Math.floor(hours / 2)), singles: hours - 2 * Math.min(doubles, Math.floor(hours / 2)), room,
      baseValid, valid: baseValid && resolved.length > 0, auto, candidates,
    }
  })
  const groupIdx = new Map(groups.map((g, i) => [g.id, i]))

  return {
    data, rules, weights, slots, S, D, nClass, nTeacher, nRoom, groups,
    classIdx, teacherIdx, roomIdx, groupIdx,
    teacherOk, classOk, roomOk, teacherSoft, classSoft, roomSoft,
    classHomeroom, teacherDailyCap, teacherWeeklyCap, teacherDayOff,
  }
}
