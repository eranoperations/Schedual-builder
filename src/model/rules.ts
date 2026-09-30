import type { Rules } from './types'

/** Spec §3.2 defaults; a missing key means the default. */
export const RULE_DEFAULTS: Required<Rules> = {
  maxTeacherDailyHours: 6,
  maxJoinedLessonMinutes: 100,
  allowZeroHour: false,
}

export function resolveRules(rules: Rules | undefined): Required<Rules> {
  return {
    maxTeacherDailyHours: numOr(rules?.maxTeacherDailyHours, RULE_DEFAULTS.maxTeacherDailyHours),
    maxJoinedLessonMinutes: numOr(rules?.maxJoinedLessonMinutes, RULE_DEFAULTS.maxJoinedLessonMinutes),
    allowZeroHour: typeof rules?.allowZeroHour === 'boolean' ? rules.allowZeroHour : RULE_DEFAULTS.allowZeroHour,
  }
}

function numOr(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d
}
