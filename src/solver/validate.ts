/**
 * Pre-solve validation (spec US-8). Every `error` is a proof that no timetable
 * satisfying §3.1 exists (or that the data is invalid per §2) and is shown in
 * plain language with a link to the record to fix. Warnings don't block.
 * Also serves as the "teacher assignment pre-check": qualification, weekly max
 * vs load, daily max × working days, unblocked-slot capacity.
 */
import type { EntityKind, Issue, SchoolSnapshot, Weekday } from '../model/types'
import { teachingDays, validateWeek } from '../model/week'
import { compile, resolveRoomRequirement } from './compile'
import { nameLookup } from './names'

export function validate(data: SchoolSnapshot): Issue[] {
  const out: Issue[] = []
  const add = (severity: Issue['severity'], code: string, params: Issue['params'], kind?: EntityKind, id?: string) =>
    out.push({ code, severity, params, ...(kind ? { ref: { kind, ...(id ? { id } : {}) } } : {}) })
  const error = (code: string, params: Issue['params'], kind?: EntityKind, id?: string) => add('error', code, params, kind, id)
  const warn = (code: string, params: Issue['params'], kind?: EntityKind, id?: string) => add('warning', code, params, kind, id)
  const info = (code: string, params: Issue['params'], kind?: EntityKind, id?: string) => add('info', code, params, kind, id)
  const name = nameLookup(data)

  out.push(...validateWeek(data.school.week, data.school.rules))
  const cp = compile(data)
  const { S, D, slots } = cp
  const days = teachingDays(data.school.week)

  // ---- duplicates / empty names -------------------------------------------
  const dup = (kind: EntityKind, items: { id: string; name: string }[]) => {
    const seen = new Set<string>()
    for (const it of items) {
      const n = it.name.trim()
      if (!n) warn('W_EMPTY_NAME', { kind }, kind, it.id)
      else if (seen.has(n)) warn('W_DUPLICATE_NAME', { kind, name: n }, kind, it.id)
      seen.add(n)
    }
  }
  dup('subject', data.subjects)
  dup('room', data.rooms)
  dup('teacher', data.teachers)
  dup('class', data.classes.map((c) => ({ id: c.id, name: c.displayName })))

  // ---- groups -------------------------------------------------------------
  const teacherLoad = new Map<string, number>()
  const classLoad = new Map<string, number>()
  const typeDemand = new Map<string, number>()
  const homeroomDemand = new Map<string, number>()
  const subjectIds = new Set(data.subjects.map((s) => s.id))
  const roomTypeIds = new Set(data.roomTypes.map((t) => t.id))
  data.groups.forEach((g, gi) => {
    const p = { subject: name(g.subjectId), class: g.classIds.map(name).join(', '), teacher: g.teacherIds.map(name).join(', ') }
    const gref = ['group', g.id] as const
    if (!subjectIds.has(g.subjectId)) error('E_GROUP_UNKNOWN_SUBJECT', p, ...gref)
    if (!g.teacherIds.length) error('E_GROUP_NO_TEACHER', p, ...gref)
    if (!g.classIds.length) error('E_GROUP_NO_CLASS', p, ...gref)
    if (g.teacherIds.some((t) => !cp.teacherIdx.has(t)) || g.classIds.some((c) => !cp.classIdx.has(c))) error('E_GROUP_UNKNOWN_REFERENCE', p, ...gref)
    if (!Number.isInteger(g.weeklyHours) || g.weeklyHours <= 0) error('E_GROUP_HOURS_INVALID', { ...p, hours: g.weeklyHours }, ...gref)
    if (!Number.isInteger(g.doubles) || g.doubles < 0 || g.doubles * 2 > g.weeklyHours) error('E_GROUP_DOUBLES_INVALID', { ...p, doubles: g.doubles, hours: g.weeklyHours }, ...gref)
    for (const tid of g.teacherIds) {
      const t = data.teachers.find((x) => x.id === tid)
      if (t && !t.subjectIds.includes(g.subjectId)) error('E_GROUP_TEACHER_NOT_QUALIFIED', { ...p, teacher: t.name }, ...gref)
      teacherLoad.set(tid, (teacherLoad.get(tid) ?? 0) + Math.max(0, g.weeklyHours))
    }
    for (const cid of g.classIds) classLoad.set(cid, (classLoad.get(cid) ?? 0) + Math.max(0, g.weeklyHours))
    const req = resolveRoomRequirement(data, g.room, g.subjectId)
    if (req === 'homeroom') {
      for (const cid of g.classIds) {
        const c = data.classes.find((x) => x.id === cid)
        if (c && (!c.homeroomRoomId || !cp.roomIdx.has(c.homeroomRoomId))) error('E_CLASS_NO_HOMEROOM', { class: c.displayName, subject: p.subject }, 'class', c.id)
        else if (c) homeroomDemand.set(c.homeroomRoomId!, (homeroomDemand.get(c.homeroomRoomId!) ?? 0) + g.weeklyHours)
      }
    } else if (typeof req === 'object' && 'roomTypeId' in req) {
      const n = data.rooms.filter((r) => r.roomTypeId === req.roomTypeId).length
      if (!n) error('E_GROUP_NO_MATCHING_ROOM', { ...p, roomType: roomTypeIds.has(req.roomTypeId) ? name(req.roomTypeId) : req.roomTypeId }, ...gref)
      typeDemand.set(req.roomTypeId, (typeDemand.get(req.roomTypeId) ?? 0) + g.weeklyHours * g.classIds.length)
    } else if (typeof req === 'object' && 'roomId' in req) {
      if (!cp.roomIdx.has(req.roomId)) error('E_GROUP_NO_MATCHING_ROOM', { ...p, roomType: req.roomId }, ...gref)
      else homeroomDemand.set(req.roomId, (homeroomDemand.get(req.roomId) ?? 0) + g.weeklyHours)
    }
    // slot availability for this group (all teachers and classes free of hard blocks/day off)
    const G = cp.groups[gi]
    if (G.teachers.length && G.classes.length) {
      const ok = (s: number) => G.teachers.every((t) => cp.teacherOk[t * S + s]) && G.classes.every((c) => cp.classOk[c * S + s])
      let common = 0
      let pairs = 0
      for (let s = 0; s < S; s++) {
        if (!ok(s)) continue
        common++
        const s2 = slots.nextJoin[s]
        if (s2 >= 0 && ok(s2)) pairs++
      }
      if (common < g.weeklyHours) error('E_GROUP_NOT_ENOUGH_SLOTS', { ...p, hours: g.weeklyHours, slots: common }, ...gref)
      if (g.doubles > 0 && pairs === 0) error('E_GROUP_NO_JOINABLE_PAIR', { ...p, doubles: g.doubles }, ...gref)
      else if (g.doubles > 0) {
        // doubles on distinct days are not required, but two doubles can't overlap: count disjoint pairs
        let disjoint = 0
        for (let s = 0; s < S; s++) { const s2 = slots.nextJoin[s]; if (s2 >= 0 && ok(s) && ok(s2)) { disjoint++; s++ } }
        if (disjoint < g.doubles) error('E_GROUP_NO_JOINABLE_PAIR', { ...p, doubles: g.doubles }, ...gref)
      }
      if (g.weeklyHours > D * 2 && D > 0) warn('W_GROUP_SPREAD', { ...p, hours: g.weeklyHours, days: D }, ...gref)
    }
  })

  // ---- teachers -------------------------------------------------------------
  data.teachers.forEach((t, ti) => {
    const X = t.maxWeeklyHours
    if (!Number.isInteger(X) || X <= 0) error('E_TEACHER_HOURS_INVALID', { teacher: t.name, hours: X }, 'teacher', t.id)
    if (t.maxDailyHours !== undefined && (!Number.isInteger(t.maxDailyHours) || t.maxDailyHours <= 0)) error('E_TEACHER_DAILY_INVALID', { teacher: t.name, hours: t.maxDailyHours }, 'teacher', t.id)
    if (!t.subjectIds.some((s) => subjectIds.has(s))) error('E_TEACHER_NO_SUBJECTS', { teacher: t.name }, 'teacher', t.id)
    if (!days.includes(t.dayOff as Weekday)) error('E_TEACHER_DAY_OFF_INVALID', { teacher: t.name, day: t.dayOff }, 'teacher', t.id)
    const load = teacherLoad.get(t.id) ?? 0
    if (load > X) error('E_TEACHER_OVER_X', { teacher: t.name, hours: load, max: X }, 'teacher', t.id)
    const cap = cp.teacherDailyCap[ti]
    const workDays = slots.days.filter((d) => d !== t.dayOff)
    if (load > cap * workDays.length) {
      error('E_TEACHER_DAILY_CAPACITY', { teacher: t.name, hours: load, days: workDays.length, perDay: cap, capacity: cap * workDays.length }, 'teacher', t.id)
    } else {
      let capacity = 0
      for (let di = 0; di < D; di++) {
        let free = 0
        for (let p = 0; p < slots.dayLength[di]; p++) free += cp.teacherOk[ti * S + slots.dayStart[di] + p]
        capacity += Math.min(cap, free)
      }
      if (load > capacity) error('E_TEACHER_SLOT_CAPACITY', { teacher: t.name, hours: load, slots: capacity }, 'teacher', t.id)
    }
    if (load > 0 && load < X) info('I_TEACHER_UNDER_X', { teacher: t.name, hours: load, max: X }, 'teacher', t.id)
    if (load === 0) info('I_TEACHER_NO_GROUPS', { teacher: t.name }, 'teacher', t.id)
  })

  // ---- classes ----------------------------------------------------------------
  data.classes.forEach((c, ci) => {
    let avail = 0
    for (let s = 0; s < S; s++) avail += cp.classOk[ci * S + s]
    const load = classLoad.get(c.id) ?? 0
    if (load > avail) error('E_CLASS_OVER_SLOTS', { class: c.displayName, hours: load, slots: avail }, 'class', c.id)
    if (load === 0) info('I_CLASS_NO_GROUPS', { class: c.displayName }, 'class', c.id)
    if (c.homeroomRoomId && !cp.roomIdx.has(c.homeroomRoomId)) error('E_CLASS_NO_HOMEROOM', { class: c.displayName, subject: '—' }, 'class', c.id)
    if (c.homeroomTeacherId && !cp.teacherIdx.has(c.homeroomTeacherId)) warn('W_CLASS_HOMEROOM_TEACHER_UNKNOWN', { class: c.displayName }, 'class', c.id)
  })

  // ---- rooms ------------------------------------------------------------------------
  const roomSlots = (ri: number) => { let n = 0; for (let s = 0; s < S; s++) n += cp.roomOk[ri * S + s]; return n }
  data.rooms.forEach((r) => { if (!roomTypeIds.has(r.roomTypeId)) warn('W_ROOM_UNKNOWN_TYPE', { room: r.name }, 'room', r.id) })
  for (const [typeId, demand] of typeDemand) {
    const cap = data.rooms.reduce((a, r, ri) => a + (r.roomTypeId === typeId ? roomSlots(ri) : 0), 0)
    if (cap > 0 && demand > cap) error('E_ROOM_TYPE_CAPACITY', { roomType: name(typeId), hours: demand, slots: cap }, 'roomType', typeId)
  }
  for (const [roomId, demand] of homeroomDemand) {
    const ri = cp.roomIdx.get(roomId)!
    const cap = roomSlots(ri)
    if (demand > cap) error('E_ROOM_CAPACITY', { room: name(roomId), hours: demand, slots: cap }, 'room', roomId)
  }

  // ---- blocks: references to removed days/slots are flagged, never dropped ------------
  for (const b of data.blocks) {
    const t = b.target
    const known = t.type === 'school' || (t.type === 'grade' && !!t.id) ||
      (t.type === 'teacher' && cp.teacherIdx.has(t.id ?? '')) || (t.type === 'class' && cp.classIdx.has(t.id ?? '')) || (t.type === 'room' && cp.roomIdx.has(t.id ?? ''))
    if (!known) warn('W_BLOCK_UNKNOWN_TARGET', { target: t.type }, 'block', b.id)
    for (const w of b.when) {
      if (!days.includes(w.day)) { warn('W_BLOCK_REMOVED_DAY', { day: w.day }, 'block', b.id); continue }
      const missing = (w.slotIds ?? []).filter((id) => cp.slots.slotOf(w.day, id) < 0 && !data.school.week.bellSchedules.some((bs) => bs.id === data.school.week.dayBellSchedule[w.day] && bs.slots.some((s) => s.id === id && s.type === 'lesson')))
      if (missing.length) warn('W_BLOCK_REMOVED_SLOT', { day: w.day, count: missing.length }, 'block', b.id)
    }
  }

  if (data.clusters.length) warn('W_CLUSTERS_NOT_SUPPORTED', { count: data.clusters.length }, 'cluster')
  return out
}

export function hasBlockingErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === 'error')
}
