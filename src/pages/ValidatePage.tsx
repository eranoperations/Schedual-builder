import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { pageForRef, useStore } from '../app/store'
import { Alert, Button, Card, PageHeader, StatusIcon } from '../components/ui'
import { issueText } from '../i18n/format'
import { validate } from '../solver'

export function ValidatePage() {
  const { t } = useTranslation()
  const { project, go } = useStore()
  const issues = useMemo(() => validate(project), [project])
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')
  const infos = issues.filter((i) => i.severity === 'info')
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('validate.title')}
        actions={<Button variant="primary" disabled={errors.length > 0} onClick={() => go('generate')}>{t('step.generate')}</Button>} />
      {errors.length > 0
        ? <Alert severity="error" title={t('validate.blocked', { count: errors.length })} />
        : <Alert severity="success" title={t('validate.allGood')} />}
      {([['error', errors], ['warning', warnings], ['info', infos]] as const).map(([sev, list]) => list.length > 0 && (
        <Card key={sev} title={t(sev === 'error' ? 'count.errors' : sev === 'warning' ? 'count.warnings' : 'count.notes', { count: list.length })}>
          <ul className="flex flex-col divide-y divide-line-subtle">
            {list.map((i, k) => (
              <li key={k} className="flex items-start gap-3 py-2">
                <StatusIcon severity={sev} className="mt-0.5" />
                <span className="flex-1 text-sm">{issueText(t, i)}</span>
                {i.ref && <Button variant="link" size="sm" onClick={() => go(pageForRef(i.ref!.kind), { kind: i.ref!.kind, id: i.ref!.id })}>{t('action.fix')}</Button>}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}
