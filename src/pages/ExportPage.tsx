import { Download, Printer, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../app/store'
import { Alert, Button, Card, PageHeader } from '../components/ui'
import { parseProjectFile, projectFileName, serializeProject, withNewIds } from '../storage/projectFile'

export function ExportPage() {
  const { t } = useTranslation()
  const { project, replace, go } = useStore()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const exportJson = () => {
    const blob = new Blob([serializeProject(project)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = projectFileName(project)
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const onFile = async (f: File | undefined) => {
    if (!f) return
    setError(null)
    const r = parseProjectFile(await f.text())
    if (!r.ok) { setError(t(r.error, r.params)); return }
    const same = r.project.school.id === project.school.id
    if (same && !window.confirm(`${t('io.exists', { name: r.project.school.name })} ${t('io.replace')}?`)) {
      replace(withNewIds(r.project))
      return
    }
    replace(r.project)
  }
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('nav.export')} />
      <Card title={t('io.title')}>
        <p className="mb-3 text-sm text-fg-muted">{t('io.help')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={exportJson}><Download />{t('action.exportJson')}</Button>
          <Button onClick={() => input.current?.click()}><Upload />{t('action.importJson')}</Button>
          <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        {error && <Alert className="mt-3" severity="error" title={error} />}
      </Card>
      <Card title={t('action.print')}>
        <p className="mb-3 text-sm text-fg-muted">{t('export.printHelp')}</p>
        <Button onClick={() => go('timetable')}><Printer />{t('nav.timetable')}</Button>
      </Card>
    </div>
  )
}
