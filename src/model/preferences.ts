/**
 * Soft preferences (spec §3.3): per-school on/off toggles with fixed internal
 * weights. A missing key means the default, so new keys need no migration.
 */
import type { Preferences, SoftWeights } from './types'

export const PREFERENCE_KEYS = [
  'avoidTeacherGaps', 'compactClassDays', 'spreadSubjects', 'balanceTeacherLoad', 'respectSoftBlocks',
] as const
export type PreferenceKey = (typeof PREFERENCE_KEYS)[number]

export const PREFERENCE_DEFAULTS: Record<PreferenceKey, boolean> = {
  avoidTeacherGaps: true,
  compactClassDays: true,
  spreadSubjects: true,
  balanceTeacherLoad: false,
  respectSoftBlocks: true,
}

/** spreadSubjects: at most this many hours of one group per day (a double counts as one session). */
export const MAX_GROUP_HOURS_PER_DAY = 2

export const INTERNAL_WEIGHTS: SoftWeights = {
  teacherGaps: 3,
  classGaps: 5,
  spreadExcess: 6,
  maxGroupHoursPerDay: MAX_GROUP_HOURS_PER_DAY,
  teacherLoadBalance: 2,
  softBlocks: 8,
}

export function resolvePreferences(prefs: Preferences | undefined): Record<PreferenceKey, boolean> {
  const out = { ...PREFERENCE_DEFAULTS }
  for (const k of PREFERENCE_KEYS) {
    const v = prefs?.[k]
    if (typeof v === 'boolean') out[k] = v
  }
  return out
}

/** Solver weights for a school's preferences (disabled → weight 0). */
export function weightsFromPreferences(prefs: Preferences | undefined): SoftWeights {
  const p = resolvePreferences(prefs)
  const w = INTERNAL_WEIGHTS
  return {
    ...w,
    teacherGaps: p.avoidTeacherGaps ? w.teacherGaps : 0,
    classGaps: p.compactClassDays ? w.classGaps : 0,
    spreadExcess: p.spreadSubjects ? w.spreadExcess : 0,
    teacherLoadBalance: p.balanceTeacherLoad ? w.teacherLoadBalance : 0,
    softBlocks: p.respectSoftBlocks ? w.softBlocks : 0,
  }
}
