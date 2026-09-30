import { CircleCheck, Circle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStore, type Page } from '../app/store'
import { Alert, Button, Card, PageHeader } from '../components/ui'
import { largeSampleSchoolProject, sampleSchoolProject } from '../model/sample'

export function HomePage() {
  const { t } = useTranslation()
  const { project: p, replace, go } = useStore()
  const steps: [Page, string, boolean][] = [
    ['week', 'step.week', p.school.week.days.length > 0],
    ['rooms', 'step.rooms', p.rooms.length > 0],
    ['subjects', 'step.subjects', p.subjects.length > 0],
    ['teachers', 'step.teachers', p.teachers.length > 0],
    ['classes', 'step.classes', p.classes.length > 0],
    ['planning', 'step.planning', p.groups.length > 0],
    ['blocks', 'step.blocks', true],
    ['generate', 'step.generate', p.timetables.length > 0],
  ]
  const loadSample = (large: boolean) => {
    if (!window.confirm(t('home.sampleConfirm'))) return
    replace(large ? largeSampleSchoolProject() : sampleSchoolProject())
  }
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('onboarding.title')} description={t('onboarding.body')}
        actions={<Button variant="primary" size="lg" onClick={() => go('generate')}>{t('step.generate')}</Button>} />
      <Card title={t('home.progress')}>
        <ol className="grid gap-2 sm:grid-cols-2">
          {steps.map(([page, key, done], i) => (
            <li key={page}>
              <button type="button" onClick={() => go(page)} className="flex w-full items-center gap-3 rounded-lg border border-line-subtle p-3 text-start hover:bg-surface-sunken">
                {done ? <CircleCheck className="size-5 text-success-fg" aria-hidden /> : <Circle className="size-5 text-fg-muted" aria-hidden />}
                <span className="font-medium">{i + 1}. {t(key)}</span>
                <span className="ms-auto text-sm text-fg-muted">{done ? t('home.stepDone') : t('home.stepTodo')}</span>
              </button>
            </li>
          ))}
        </ol>
      </Card>
      <Card title={t('home.samples')}>
        <p className="mb-3 text-sm text-fg-muted">{t('home.samplesHelp')}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => loadSample(false)}>{t('action.sample')}</Button>
          <Button onClick={() => loadSample(true)}>{t('action.sampleLarge')}</Button>
        </div>
      </Card>
      <Alert severity="info" title={t('home.localOnly')} />
    </div>
  )
}
