/**
 * Core data model — PRODUCT_SPEC.md v0.5.1 §2 / §3. Pure types, no runtime code.
 *
 * Multi-school from day one: every record has a client-generated UUID `id`,
 * a `schoolId` (except School) and createdAt/updatedAt ISO timestamps.
 * Entities/fields marked (reserved) are typed and exported but get no UI or
 * solver support yet (clusters, levels, pinned lessons).
 *
 * Days are 0..6 (0 = Sunday … 6 = Saturday). Slots are referenced by their
 * stable `Slot.id`; `Slot.index` is the displayed period number (0 = zero hour).
 */

export type Id = string
/** ISO-8601 timestamp */
export type Timestamp = string
/** 0 = Sunday … 6 = Saturday */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface BaseRecord {
  id: Id
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface SchoolScoped extends BaseRecord {
  schoolId: Id
}

// ---------------------------------------------------------------------------
// Week & bell schedules (§2.1)

export interface Slot {
  /** Stable id, so blocks and lessons survive edits. */
  id: Id
  /** Period number as shown (0 = zero hour, then 1, 2, …). Breaks carry the index of the preceding lesson. */
  index: number
  type: 'lesson' | 'break'
  /** "HH:MM" */
  start: string
  end: string
  /** Lesson slots only: can form a double with the next lesson slot. */
  joinableWithNext: boolean
}

export interface BellSchedule {
  id: Id
  name: string
  slots: Slot[]
}

export interface Week {
  /** Teaching days, any subset of Sun..Sat (Sunday-first order). */
  days: Weekday[]
  /** At least one. */
  bellSchedules: BellSchedule[]
  /** Teaching day -> bell schedule id (JSON keys are day numbers as strings). */
  dayBellSchedule: Partial<Record<Weekday, Id>>
}

// ---------------------------------------------------------------------------
// Rules (§3.2, hard) & preferences (§3.3, soft)

/** A missing key means the default (see model/rules.ts). */
export interface Rules {
  maxTeacherDailyHours?: number
  maxJoinedLessonMinutes?: number
  allowZeroHour?: boolean
}

/**
 * `{ [key]: boolean }`, a missing key means the default. Known keys:
 * avoidTeacherGaps, compactClassDays, spreadSubjects, balanceTeacherLoad,
 * respectSoftBlocks (see model/preferences.ts).
 */
export type Preferences = Record<string, boolean | undefined>

export interface School extends BaseRecord {
  name: string
  /** סמל מוסד */
  institutionCode?: string
  week: Week
  rules: Rules
  preferences: Preferences
}

// ---------------------------------------------------------------------------
// Entities

export interface RoomType extends SchoolScoped {
  name: string
}

export interface Room extends SchoolScoped {
  name: string
  roomTypeId: Id
  capacity?: number
}

/** Room requirement of a subject: the class's homeroom, any room of a type, or no room. */
export type RoomRequirement = 'homeroom' | 'none' | { roomTypeId: Id }

/** A study group's optional override: same as RoomRequirement, or a specific room. */
export type RoomOverride = RoomRequirement | { roomId: Id }

export interface Subject extends SchoolScoped {
  name: string
  ministryCode?: string
  /** Display colour (hex). */
  color: string
  defaultRoom: RoomRequirement
}

export interface Teacher extends SchoolScoped {
  name: string
  /** X — upper limit of weekly teaching hours. */
  maxWeeklyHours: number
  /** Personal daily cap; overrides rules.maxTeacherDailyHours. */
  maxDailyHours?: number
  /** Subjects the teacher is qualified to teach (at least one). */
  subjectIds: Id[]
  /** Exactly one of the school's teaching days, required. */
  dayOff: Weekday
}

export type Grade = 7 | 8 | 9

/** כיתת אם */
export interface SchoolClass extends SchoolScoped {
  grade: number
  parallel: number
  /** Auto-formatted (e.g. ז׳3), editable. */
  displayName: string
  homeroomRoomId: Id | null
  homeroomTeacherId?: Id | null
}

/** קבוצת לימוד — the scheduled unit. */
export interface StudyGroup extends SchoolScoped {
  subjectId: Id
  /**
   * Fixed teacher(s). OPTIONAL since v0.5.1: an empty array means "Auto": the
   * solver assigns exactly one qualified teacher who teaches every lesson of
   * the group. MVP UI: zero or one. Solver and checker handle arrays.
   */
  teacherIds: Id[]
  /** MVP UI: exactly one. Solver and checker handle arrays. */
  classIds: Id[]
  weeklyHours: number
  /** How many of the weekly hours are taught as double periods (each double = 2 hours). */
  doubles: number
  /** Overrides the subject's default room requirement. */
  room?: RoomOverride
  /** (reserved) */
  clusterId?: Id | null
  /** (reserved) */
  level?: string | null
}

/** (reserved) All member groups must be placed in identical slots. */
export interface Cluster extends SchoolScoped {
  name: string
  studyGroupIds: Id[]
}

export type BlockTargetType = 'teacher' | 'class' | 'room' | 'grade' | 'school'

/** חסם */
export interface Block extends SchoolScoped {
  /** `id` is the entity id; for `grade` it is the grade number as a string; omitted for `school`. */
  target: { type: BlockTargetType; id?: string }
  /** No slotIds = whole day. */
  when: { day: Weekday; slotIds?: Id[] }[]
  hardness: 'hard' | 'soft'
  note?: string
}

/** A placed lesson: one slot, or two for a double. */
export interface Lesson {
  studyGroupId: Id
  /**
   * Resolved teachers of the group (fixed, or chosen by the solver for auto
   * groups). Always set by the solver. When absent (hand-made data), the
   * checker falls back to the group's fixed `teacherIds`.
   */
  teacherIds?: Id[]
  day: Weekday
  slotIds: Id[]
  /** One per class of the group (same order as classIds); empty if no room is needed. */
  roomIds: Id[]
  /** (reserved) */
  pinned?: boolean
}

// ---------------------------------------------------------------------------
// Solver output

export type Severity = 'error' | 'warning' | 'info'

export type EntityKind =
  | 'school' | 'week' | 'rules' | 'roomType' | 'room' | 'subject' | 'teacher' | 'class' | 'group' | 'block' | 'cluster'

/**
 * A language-neutral message. `code` selects a template in the i18n files;
 * `params` fills it in (names already resolved; a `day` param is a weekday
 * index 0..6; `period` params are displayed period numbers).
 */
export interface Issue {
  code: string
  severity: Severity
  params: Record<string, string | number>
  /** Record to fix (the UI links to it). */
  ref?: { kind: EntityKind; id?: Id }
}

export interface UnplacedLesson {
  studyGroupId: Id
  /** 1 = single, 2 = double */
  length: 1 | 2
  count: number
  reason: Issue
}

export type QualityMetricKey =
  | 'avoidTeacherGaps' | 'compactClassDays' | 'spreadSubjects' | 'balanceTeacherLoad' | 'respectSoftBlocks'

export interface QualityMetric {
  key: QualityMetricKey
  enabled: boolean
  /** In the final timetable. */
  count: number
  /** On the first valid (pre-optimisation) solution. */
  initialCount: number
  affected: { kind: 'teacher' | 'class' | 'group'; id: Id; count: number }[]
}

export interface SolveStats {
  seed: number
  elapsedMs: number
  placementMs: number
  optimizeMs: number
  placementNodes: number
  placementAttempts: number
  saIterations: number
  initialSoftScore: number
  finalSoftScore: number
  cancelled: boolean
  timedOut: boolean
  /** lesson-hours */
  totalHours: number
  placedHours: number
}

/**
 * complete   – every lesson placed, all hard constraints met
 * infeasible – proven impossible (see `reasons`); best partial returned
 * incomplete – not found within the limits (not proven impossible); best valid partial returned
 * cancelled  – stopped by the user; best valid partial returned
 */
export type SolveStatus = 'complete' | 'infeasible' | 'incomplete' | 'cancelled'

/** Pure solver output. Every returned lesson satisfies all hard constraints. */
export interface SolveResult {
  status: SolveStatus
  lessons: Lesson[]
  /**
   * Resolved teachers per study group: the fixed teachers, or the one teacher
   * the solver chose for an auto group (empty if an auto group got no teacher).
   */
  teacherAssignments: Record<Id, Id[]>
  unplaced: UnplacedLesson[]
  /** Blocking pre-solve findings (non-empty only when status = infeasible). */
  reasons: Issue[]
  qualityReport: QualityMetric[]
  stats: SolveStats
  /** Hash of the solver input, used to flag a stale timetable. */
  dataFingerprint: string
}

/** Persisted timetable record. */
export interface Timetable extends SchoolScoped {
  name: string
  status: 'draft' | 'accepted'
  /** Resolved teachers of every group (fixed or solver-chosen), keyed by studyGroupId. */
  teacherAssignments: Record<Id, Id[]>
  lessons: Lesson[]
  qualityReport: QualityMetric[]
  /** Solver metadata (extension). */
  result: Omit<SolveResult, 'lessons' | 'qualityReport' | 'teacherAssignments'>
}

/** Solver input: a snapshot of one school and all its records. */
export interface SchoolSnapshot {
  school: School
  roomTypes: RoomType[]
  rooms: Room[]
  subjects: Subject[]
  teachers: Teacher[]
  classes: SchoolClass[]
  groups: StudyGroup[]
  blocks: Block[]
  /** (reserved) */
  clusters: Cluster[]
}

/** Everything stored for one school (= JSON project payload). */
export interface SchoolProject extends SchoolSnapshot {
  timetables: Timetable[]
}

/** Internal soft weights (fixed per preference; overridable per solve for benchmarks). */
export interface SoftWeights {
  teacherGaps: number
  classGaps: number
  /** per group-hour beyond maxGroupHoursPerDay */
  spreadExcess: number
  maxGroupHoursPerDay: number
  teacherLoadBalance: number
  softBlocks: number
}

export interface SolverOptions {
  seed: number
  /** Wall-clock cap for the whole solve. */
  timeLimitMs: number
  /** Simulated-annealing iterations (deterministic budget). */
  optimizeIterations: number
  /** Max placement attempts (restarts). */
  maxAttempts: number
  /** Override internal soft weights (benchmarks/tests). */
  weights?: Partial<SoftWeights>
}

