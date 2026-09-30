import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../app/store'
import { Card, Input, NumberInput, PageHeader, Switch } from '../components/ui'
import { PREFERENCE_KEYS, resolvePreferences } from '../model/preferences'
import { resolveRules } from '../model/rules'

export function SettingsPage() {
  const { t } = useTranslation()
  const { project: p, update } = useStore()
  const rules = resolveRules(p.school.rules)
  const prefs = resolvePreferences(p.school.preferences)
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('nav.settings')} />
      <Card title={t('settings.tab.details')}>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm">{t('field.schoolName')}
            <Input className="w-72" value={p.school.name} onChange={(e) => update((d) => { d.school.name = e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">{t('field.institutionCode')}
            <Input className="w-40" dir="ltr" value={p.school.institutionCode ?? ''} onChange={(e) => update((d) => { d.school.institutionCode = e.target.value || undefined })} /></label>
        </div>
      </Card>
      <Card title={t('rules.title')}>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 text-sm">{t('rules.maxTeacherDailyHours')}
            <NumberInput value={rules.maxTeacherDailyHours} min={1} max={12} onChange={(v) => update((d) => { d.school.rules.maxTeacherDailyHours = v })} /></label>
          <label className="flex items-center gap-3 text-sm">{t('rules.maxJoinedLessonMinutes')}
            <NumberInput value={rules.maxJoinedLessonMinutes} min={60} max={180} onChange={(v) => update((d) => { d.school.rules.maxJoinedLessonMinutes = v })} /></label>
          <Switch label={t('rules.allowZeroHour')} checked={rules.allowZeroHour} onCheckedChange={(v) => update((d) => { d.school.rules.allowZeroHour = v })} />
        </div>
      </Card>
      <Card title={t('prefs.title')}>
        <div className="flex flex-col gap-3">
          {PREFERENCE_KEYS.map((k) => (
            <div key={k}>
              <Switch label={t(`prefs.${k}`)} checked={prefs[k]} onCheckedChange={(v) => update((d) => { d.school.preferences[k] = v })} />
              <p className="ms-14 text-xs text-fg-muted">{t(`prefs.${k}.help`)}</p>
            </div>
          ))}
          <p className="text-xs text-fg-muted">{t('prefs.note')}</p>
        </div>
      </Card>
      <Card title={t('constraints.hard.title')}>
        <ul className="flex flex-col gap-1.5 text-sm">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <li key={n} className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-fg" />{t(`constraints.hard.${n}`)}</li>)}
        </ul>
        <p className="mt-2 text-xs text-fg-muted">{t('constraints.hard.note')}</p>
      </Card>
    </div>
  )
}
