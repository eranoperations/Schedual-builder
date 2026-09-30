/**
 * Demo data (spec US-15): a grades 7–9 Israeli middle school (חטיבת ביניים)
 * with several parallels per grade, study groups based on the Ministry
 * middle-school hours (~36 weekly hours per class, research §2), homerooms,
 * labs, a gym and some blocks. Fresh UUIDs on every call.
 */
import { classDisplayName, newSchool, scoped } from './defaults'
import type {
  Block, Room, RoomRequirement, RoomType, SchoolClass, SchoolProject, StudyGroup, Subject, Teacher, Weekday,
} from './types'
import { lessonSlots, type WeekTemplate } from './week'

type SubjectKey =
  | 'math' | 'english' | 'hebrew' | 'tanach' | 'science' | 'history' | 'geography'
  | 'literature' | 'civics' | 'pe' | 'homeroom' | 'arabic' | 'computers' | 'art'

type RoomTypeKey = 'classroom' | 'lab' | 'computers' | 'gym' | 'art' | 'music' | 'library'

const ROOM_TYPES: [RoomTypeKey, string][] = [
  ['classroom', 'כיתה'], ['lab', 'מעבדת מדעים'], ['computers', 'חדר מחשבים'], ['gym', 'אולם ספורט'],
  ['art', 'חדר אמנות'], ['music', 'חדר מוזיקה'], ['library', 'ספרייה'],
]

const SUBJECTS: [SubjectKey, string, string, RoomTypeKey | 'homeroom'][] = [
  ['math', 'מתמטיקה', 'subject-1', 'homeroom'],
  ['english', 'אנגלית', 'subject-9', 'homeroom'],
  ['hebrew', 'עברית', 'subject-6', 'homeroom'],
  ['tanach', 'תנ״ך', 'subject-12', 'homeroom'],
  ['science', 'מדע וטכנולוגיה', 'subject-10', 'lab'],
  ['history', 'היסטוריה', 'subject-5', 'homeroom'],
  ['geography', 'גאוגרפיה', 'subject-3', 'homeroom'],
  ['literature', 'ספרות', 'subject-2', 'homeroom'],
  ['civics', 'אזרחות', 'subject-11', 'homeroom'],
  ['pe', 'חינוך גופני', 'subject-8', 'gym'],
  ['homeroom', 'שעת חינוך', 'subject-7', 'homeroom'],
  ['arabic', 'ערבית', 'subject-4', 'homeroom'],
  ['computers', 'מדעי המחשב', 'subject-1', 'computers'],
  ['art', 'אמנות', 'subject-9', 'art'],
]

/** [weekly hours, doubles] per grade. 36 / 36 / 35 hours. */
export const CURRICULUM: Record<7 | 8 | 9, Partial<Record<SubjectKey, [number, number]>>> = {
  7: { math: [5, 0], english: [4, 0], hebrew: [3, 0], tanach: [3, 0], science: [5, 1], history: [2, 0], geography: [2, 0], literature: [2, 0], pe: [3, 1], homeroom: [1, 0], arabic: [3, 0], computers: [2, 1], art: [1, 0] },
  8: { math: [5, 0], english: [4, 0], hebrew: [3, 0], tanach: [3, 0], science: [5, 1], history: [2, 0], geography: [2, 0], literature: [2, 0], pe: [3, 1], homeroom: [1, 0], arabic: [3, 0], computers: [2, 1], art: [1, 0] },
  9: { math: [5, 0], english: [4, 0], hebrew: [3, 0], tanach: [3, 0], science: [4, 1], history: [2, 0], geography: [1, 0], literature: [2, 0], civics: [2, 0], pe: [3, 1], homeroom: [1, 0], arabic: [3, 0], computers: [2, 1] },
}

function base(name: string, template: WeekTemplate) {
  const school = newSchool(name, template, { regular: 'רגיל', friday: 'יום שישי' })
  const S = () => scoped(school.id)
  const roomTypes: RoomType[] = ROOM_TYPES.map(([, n]) => ({ ...S(), name: n }))
  const rt = Object.fromEntries(ROOM_TYPES.map(([k], i) => [k, roomTypes[i].id])) as Record<RoomTypeKey, string>
  const subjects: Subject[] = SUBJECTS.map(([, n, color, room]) => ({
    ...S(), name: n, color, defaultRoom: (room === 'homeroom' ? 'homeroom' : { roomTypeId: rt[room] }) as RoomRequirement,
  }))
  const sid = Object.fromEntries(SUBJECTS.map(([k], i) => [k, subjects[i].id])) as Record<SubjectKey, string>
  const room = (n: string, type: RoomTypeKey, capacity?: number): Room => ({ ...S(), name: n, roomTypeId: rt[type], ...(capacity ? { capacity } : {}) })
  const teacher = (n: string, x: number, subj: SubjectKey[], dayOff: Weekday): Teacher =>
    ({ ...S(), name: n, maxWeeklyHours: x, subjectIds: subj.map((k) => sid[k]), dayOff })
  const klass = (grade: 7 | 8 | 9, parallel: number, homeroomRoomId: string): SchoolClass =>
    ({ ...S(), grade, parallel, displayName: classDisplayName(grade, parallel), homeroomRoomId, homeroomTeacherId: null })
  const group = (subject: SubjectKey, teacherId: string, classId: string, hours: number, doubles: number): StudyGroup =>
    ({ ...S(), subjectId: sid[subject], teacherIds: [teacherId], classIds: [classId], weeklyHours: hours, doubles, clusterId: null, level: null })
  const block = (target: Block['target'], when: Block['when'], hardness: Block['hardness'], note: string): Block =>
    ({ ...S(), target, when, hardness, note })
  return { school, roomTypes, subjects, sid, room, teacher, klass, group, block }
}

const AUTO_SUBJECTS: SubjectKey[] = ['pe', 'arabic']

/**
 * 9 classes (ז׳1–ט׳3), 21 teachers, 15 rooms, 114 study groups, Sun–Thu
 * template (40 lesson slots). Σ class hours = 321; every teacher ≤ X ≤ 23,
 * daily cap 6 (school rule). Verified solvable by the test-suite.
 */
export function sampleSchoolProject(): SchoolProject {
  const b = base('חטיבת ביניים "אופקים"', 'sunThu')
  const rooms: Room[] = [
    ...[101, 102, 103, 104, 105, 106, 107, 108, 109, 110].map((n) => b.room(`חדר ${n}`, 'classroom', 32)),
    b.room('מעבדת מדעים 1', 'lab', 30), b.room('מעבדת מדעים 2', 'lab', 30),
    b.room('חדר מחשבים', 'computers', 30),
    b.room('אולם ספורט', 'gym'), b.room('מגרש ספורט', 'gym'),
    b.room('חדר אמנות', 'art', 30),
  ]
  const classes: SchoolClass[] = []
  ;([7, 8, 9] as const).forEach((g, gi) => [1, 2, 3].forEach((p, pi) => classes.push(b.klass(g, p, rooms[gi * 3 + pi].id))))
  const [z1, z2, z3, h1, h2, h3, t1, t2, t3] = classes
  const T = {
    m1: b.teacher('רונית כהן', 18, ['math', 'homeroom'], 0),
    m2: b.teacher('אבי לוי', 18, ['math', 'computers', 'homeroom'], 1),
    m3: b.teacher('נועה פרץ', 18, ['math', 'science', 'homeroom'], 3),
    e1: b.teacher('מיכל אברהם', 20, ['english', 'homeroom'], 4),
    e2: b.teacher('דוד שמיר', 22, ['english', 'literature'], 2),
    h1: b.teacher('שרה מזרחי', 18, ['hebrew', 'literature', 'homeroom'], 1),
    h2: b.teacher('טל עמר', 18, ['hebrew', 'literature', 'homeroom'], 3),
    h3: b.teacher('אורית גולן', 18, ['hebrew', 'literature', 'homeroom'], 0),
    tn1: b.teacher('משה פרידמן', 21, ['tanach', 'history', 'homeroom'], 2),
    tn2: b.teacher('שחר גבאי', 18, ['tanach', 'history'], 4),
    hs: b.teacher('ענבל רוזן', 14, ['history', 'civics'], 0),
    g1: b.teacher('רחל אוחיון', 23, ['geography', 'civics', 'homeroom'], 1),
    s1: b.teacher('יוסי ביטון', 18, ['science'], 2),
    s2: b.teacher('ליאת שפירא', 18, ['science', 'computers'], 3),
    s3: b.teacher('עידו ברק', 14, ['science', 'math'], 4),
    c1: b.teacher('גיל קליין', 20, ['computers', 'math'], 0),
    p1: b.teacher('עומר דהן', 20, ['pe'], 1),
    p2: b.teacher('מאיה חדד', 10, ['pe'], 3),
    a1: b.teacher('סמיר חורי', 20, ['arabic'], 2),
    a2: b.teacher('חנאן סלאמה', 10, ['arabic'], 4),
    ar: b.teacher('תמר שלום', 8, ['art'], 0),
  }
  // Who teaches what: [subject, teacher per grade 7/8/9 (or per class)]
  const byGrade: Partial<Record<SubjectKey, [Teacher, Teacher, Teacher]>> = {
    math: [T.m1, T.m2, T.m3], hebrew: [T.h1, T.h2, T.h3], literature: [T.h1, T.h2, T.h3],
    tanach: [T.tn1, T.tn1, T.tn2], science: [T.s1, T.s2, T.s3], geography: [T.g1, T.g1, T.g1],
    civics: [T.g1, T.g1, T.g1], computers: [T.c1, T.c1, T.c1], pe: [T.p1, T.p1, T.p2],
    arabic: [T.a1, T.a1, T.a2], art: [T.ar, T.ar, T.ar],
  }
  const perClass: Partial<Record<SubjectKey, Teacher[]>> = {
    english: [T.e1, T.e1, T.e1, T.e1, T.e2, T.e2, T.e2, T.e2, T.e2],
    history: [T.tn2, T.tn2, T.tn2, T.hs, T.hs, T.hs, T.hs, T.hs, T.hs],
    homeroom: [T.m1, T.e1, T.h1, T.m2, T.h2, T.tn1, T.m3, T.h3, T.g1],
  }
  const groups: StudyGroup[] = []
  classes.forEach((c, ci) => {
    const cur = CURRICULUM[c.grade as 7 | 8 | 9]
    for (const [k, v] of Object.entries(cur) as [SubjectKey, [number, number]][]) {
      const t = perClass[k]?.[ci] ?? byGrade[k]![c.grade - 7]
      const g = b.group(k, t.id, c.id, v[0], v[1])
      // v0.5.1: a mix of fixed and "Auto" groups: PE and Arabic are left for the solver to assign.
      if (AUTO_SUBJECTS.includes(k)) g.teacherIds = []
      groups.push(g)
    }
    c.homeroomTeacherId = perClass.homeroom![ci].id
  })
  void [z1, z2, z3, h1, h2, h3, t1, t2, t3]
  const reg = b.school.week.bellSchedules[0]
  const lessonIds = lessonSlots(b.school.week, 0).map((s) => s.id)
  const blocks: Block[] = [
    b.block({ type: 'teacher', id: T.s3.id }, [{ day: 2, slotIds: lessonIds.slice(0, 2) }], 'hard', 'השתלמות מורים'),
    b.block({ type: 'room', id: rooms[13].id }, [{ day: 4, slotIds: lessonIds.slice(6, 8) }], 'hard', 'האולם מושכר לעירייה'),
    b.block({ type: 'room', id: rooms[9].id }, [{ day: 0 }], 'hard', 'חדר 110 בשיפוץ ביום ראשון'),
    b.block({ type: 'grade', id: '9' }, [{ day: 3, slotIds: lessonIds.slice(6, 8) }], 'soft', 'שכבה ט׳ – העדפה לסיים מוקדם ביום רביעי'),
    b.block({ type: 'teacher', id: T.e2.id }, [{ day: 0, slotIds: lessonIds.slice(0, 1) }], 'soft', 'מעדיף לא ללמד בשעה הראשונה ביום ראשון'),
  ]
  void reg
  return {
    school: b.school, roomTypes: b.roomTypes, rooms, subjects: b.subjects,
    teachers: Object.values(T), classes, groups, blocks, clusters: [], timetables: [],
  }
}

const FIRST = ['אורי', 'שירה', 'יונתן', 'הילה', 'עידו', 'מאיה', 'גיל', 'ליאת', 'נדב', 'טל', 'אסף', 'רותם', 'עמית', 'דנה', 'איתי', 'קרן', 'בועז', 'ענבל', 'רועי', 'אלה', 'חיים', 'אילנה', 'יעקב', 'נורית', 'אמיר']
const LAST = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'אזולאי', 'דהן', 'חדד', 'גבאי', 'שפירא', 'קליין', 'אוחיון', 'יוסף', 'רוזן', 'בן דוד', 'שלום', 'עמר', 'ברק']

/**
 * Large demo per spec US-9 AC3: 24 classes (8 per grade), ~50 teachers,
 * 35 rooms, ~300 study groups, on either template. Teachers are generated by
 * packing the real demand (loads ≤ 20, X = load + 2 ≤ 23).
 */
export function largeSampleSchoolProject(template: WeekTemplate = 'sunThu'): SchoolProject {
  const b = base(template === 'sunThu' ? 'חטיבה גדולה (הדגמה)' : 'חטיבה גדולה א׳–ו׳ (הדגמה)', template)
  const rooms: Room[] = [
    ...Array.from({ length: 25 }, (_, i) => b.room(`חדר ${101 + i}`, 'classroom', 34)),
    ...[1, 2, 3, 4].map((n) => b.room(`מעבדת מדעים ${n}`, 'lab', 30)),
    ...[1, 2].map((n) => b.room(`חדר מחשבים ${n}`, 'computers', 30)),
    ...[1, 2, 3].map((n) => b.room(`אולם ספורט ${n}`, 'gym')),
    b.room('חדר אמנות', 'art', 30),
  ]
  const classes: SchoolClass[] = []
  ;([7, 8, 9] as const).forEach((g, gi) => { for (let p = 1; p <= 8; p++) classes.push(b.klass(g, p, rooms[gi * 8 + p - 1].id)) })
  const secondary: Partial<Record<SubjectKey, SubjectKey>> = {
    math: 'computers', english: 'literature', hebrew: 'literature', tanach: 'history', science: 'math',
    history: 'civics', geography: 'history', literature: 'hebrew', computers: 'math', arabic: 'hebrew', civics: 'geography',
  }
  const teachers: Teacher[] = []
  const load = new Map<string, number>()
  const groups: StudyGroup[] = []
  let k = 0
  const newTeacher = (key: SubjectKey) => {
    const t = b.teacher(
      `${FIRST[k % FIRST.length]} ${LAST[(k * 7 + Math.floor(k / FIRST.length)) % LAST.length]}`,
      0,
      [key, ...(secondary[key] ? [secondary[key]!] : []), 'homeroom'].filter((v, i, a) => a.indexOf(v) === i) as SubjectKey[],
      0 as Weekday,
    )
    k++
    teachers.push(t)
    load.set(t.id, 0)
    return t
  }
  const keys = (Object.keys(CURRICULUM[7]) as SubjectKey[]).concat('civics').filter((x) => x !== 'homeroom')
  for (const key of keys) {
    let cur: Teacher | null = null
    for (const c of classes) {
      const v = CURRICULUM[c.grade as 7 | 8 | 9][key]
      if (!v) continue
      if (!cur || (load.get(cur.id)! + v[0] > 19 && load.get(cur.id)! >= 10)) cur = newTeacher(key)
      load.set(cur.id, load.get(cur.id)! + v[0])
      groups.push(b.group(key, cur.id, c.id, v[0], v[1]))
    }
  }
  // Homeroom hour: taught by the class's math/english/hebrew teacher with the lowest load.
  for (const c of classes) {
    const cands = groups.filter((g) => g.classIds[0] === c.id && ['math', 'english', 'hebrew', 'tanach'].some((s) => b.sid[s as SubjectKey] === g.subjectId))
      .map((g) => g.teacherIds[0])
    const t = cands.sort((x, y) => load.get(x)! - load.get(y)!)[0]
    load.set(t, load.get(t)! + 1)
    groups.push(b.group('homeroom', t, c.id, 1, 0))
    c.homeroomTeacherId = t
  }
  const nDays = b.school.week.days.length
  teachers.forEach((t, i) => {
    t.maxWeeklyHours = Math.min(23, load.get(t.id)! + 2)
    t.dayOff = b.school.week.days[i % nDays]
  })
  const lessonIds = lessonSlots(b.school.week, 0).map((s) => s.id)
  const blocks: Block[] = [
    b.block({ type: 'room', id: rooms[31].id }, [{ day: 4, slotIds: lessonIds.slice(6, 8) }], 'hard', 'האולם מושכר'),
    b.block({ type: 'grade', id: '9' }, [{ day: 3, slotIds: lessonIds.slice(7, 8) }], 'soft', 'שכבה ט׳ – סיום מוקדם'),
  ]
  return {
    school: b.school, roomTypes: b.roomTypes, rooms, subjects: b.subjects, teachers, classes, groups, blocks, clusters: [], timetables: [],
  }
}
