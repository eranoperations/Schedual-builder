import type { TFunction } from 'i18next'
import type { Issue, Weekday } from '../model/types'

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export const dayName = (t: TFunction, d: number, style: 'full' | 'short' | 'sentence' = 'full') =>
  t(style === 'full' ? `day.${DAY_KEYS[d]}` : `day.${DAY_KEYS[d]}.${style}`)

export const formatNumber = (lang: string, n: number) => new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-GB').format(n)

export const formatDateTime = (lang: string, iso: string) =>
  new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))

/** Renders an Issue through its i18n template (`issues.<CODE>`); a `day` param becomes a day name. */
export function issueText(t: TFunction, issue: Issue): string {
  const params: Record<string, string | number> = { ...issue.params }
  if (typeof params.day === 'number') params.day = dayName(t, params.day as Weekday, 'sentence')
  const key = `issues.${issue.code}`
  const out = t(key, params)
  return out === key ? t('issues.unknown', { code: issue.code }) : out
}
