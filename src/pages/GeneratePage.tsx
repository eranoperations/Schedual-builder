import { Check, Sparkles, Square, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../app/store'
import { Alert, Badge, Button, Card, PageHeader, Select, StatusIcon } from '../components/ui'
import { formatDateTime, issueText } from '../i18n/format'
import { acceptDraft, acceptedTimetable, draftTimetable, timetableFromResult } from '../lib/timetables'
import { weightsFromPreferences } from '../model/preferences'
import type { SolveResult } from '../model/types'
import { validate, type SolveProgress } from '../solver'
import { runSolver, type SolveJob } from '../worker/client'

const LIMITS = [30, 60, 120, 300]

export function GeneratePage() {
  const { t, i18n } = useTranslation()
  const { project: p, update, go } = useStore()
  const [limit, setLimit] = useState(60)
  const [progress, setProgress] = useState<SolveProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(0)
  const [now, setNow] = useState(0)
  const job = useRef<SolveJob | null>(null)
  const issues = useMemo(() => validate(p), [p])
  const errors = issues.filter((i) => i.severity === 'error')
  const hours = p.groups.reduce((a, g) => a + g.weeklyHours, 0)
  const draft = draftTimetable(p)
  const accepted = acceptedTimetable(p)
  const running = progress !== null

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [running])
  useEffect(() => () => job.current?.cancel(), [])

  const start = () => {
    setError(null)
    setStarted(Date.now()); setNow(Date.now())
    setProgress({ phase: 'validate', percent: 0 } as SolveProgress)
    const { timetables: _tt, ...snapshot } = p
    void _tt
    const j = runSolver(snapshot, { timeLimitMs: limit * 1000, seed: Date.now() % 100000, weights: weightsFromPreferences(p.school.preferences) }, setProgress)
    job.current = j
    j.promise.then((r: SolveResult) => {
      update((d) => {
        d.timetables = d.timetables.filter((x) => x.status !== 'draft')
        d.timetables.push(timetableFromResult(d, r, formatDateTime(i18n.language, new Date().toISOString())))
      })
    }).catch((e: Error) => setError(e.message)).finally(() => { setProgress(null); job.current = null })
  }

  const phaseKey = progress?.phase === 'validate' ? 'gen.phase1' : progress?.phase === 'optimize' ? 'gen.phase3' : 'gen.phase2'
  const r = draft?.result

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('step.generate')} />
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 font-semibold">
              <StatusIcon severity={errors.length ? 'error' : 'success'} />
              {errors.length ? t('validate.blocked', { count: errors.length }) : t('gen.setupValid')}
            </div>
            <div className="text-sm text-fg-muted">{t('gen.readySummary', { classes: p.classes.length, groups: p.groups.length, teachers: p.teachers.length, hours })}</div>
            <div className="text-sm text-fg-muted">{t('gen.roomsAuto')}</div>
          </div>
          <label className="ms-auto flex items-center gap-2 text-sm">{t('field.timeLimit')}
            <Select value={limit} onChange={(e) => setLimit(Number(e.target.value))} disabled={running}>
              {LIMITS.map((s) => <option key={s} value={s}>{s < 60 ? t('gen.seconds', { n: s }) : t('gen.minutes', { n: s / 60 })}</option>)}
            </Select>
          </label>
          {errors.length > 0
            ? <Button onClick={() => go('validate')}>{t('step.validate')}</Button>
            : running
              ? <Button variant="destructive" onClick={() => job.current?.cancel()}><Square />{t('action.stop')}</Button>
              : <Button variant="primary" size="lg" onClick={start} data-testid="generate"><Sparkles />{draft || accepted ? t('action.regenerate') : t('action.generate')}</Button>}
        </div>
        {running && (
          <div className="mt-4" role="status" aria-live="polite">
            <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{t(phaseKey)}</span>
              <span className="num text-fg-muted">{t('gen.elapsed', { time: `${Math.round((now - started) / 1000)}″` })}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuenow={Math.round(progress.percent)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.percent}%` }} />
            </div>
            {progress.total ? <div className="mt-1 text-sm text-fg-muted">{t('gen.progress', { placed: progress.placed ?? 0, total: progress.total })}</div> : null}
          </div>
        )}
        {error && <Alert className="mt-4" severity="error" title={error} />}
      </Card>

      {draft && r && !running && (
        <Card title={<span className="flex items-center gap-2">{t('gen.newReady')} <Badge>{t('timetable.status.draft')}</Badge></span>}
          actions={<>
            <Button variant="primary" onClick={() => update(acceptDraft)} disabled={r.status === 'infeasible'}><Check />{t('action.accept')}</Button>
            <Button onClick={() => go('timetable')} data-testid="view-timetable">{t('action.viewTimetable')}</Button>
            <Button variant="ghost" onClick={() => update((d) => { d.timetables = d.timetables.filter((x) => x.status !== 'draft') })}><X />{t('action.discard')}</Button>
          </>}>
          {r.status === 'complete' && <Alert severity="success" title={t('gen.success')}>{t('gen.allPlaced', { placed: r.stats.placedHours, total: r.stats.totalHours })}</Alert>}
          {r.status === 'infeasible' && (
            <Alert severity="error" title={t('gen.impossible')}>
              <ul className="list-disc ps-5">{r.reasons.map((x, k) => <li key={k}>{issueText(t, x)}</li>)}</ul>
            </Alert>
          )}
          {(r.status === 'incomplete' || r.status === 'cancelled') && (
            <Alert severity="warning" title={r.status === 'cancelled' ? t('gen.cancelled') : t('gen.notFound', { min: Math.round(limit / 60) })}>
              {t('gen.progress', { placed: r.stats.placedHours, total: r.stats.totalHours })}
              {r.unplaced.length > 0 && (
                <ul className="mt-2 list-disc ps-5">{r.unplaced.slice(0, 12).map((u, k) => {
                  const g = p.groups.find((x) => x.id === u.studyGroupId)
                  const subj = p.subjects.find((s) => s.id === g?.subjectId)?.name ?? ''
                  const cls = g?.classIds.map((c) => p.classes.find((x) => x.id === c)?.displayName).join(', ') ?? ''
                  return <li key={k}>{t('gen.unplacedItem', { subject: subj, class: cls, count: u.count, len: t(u.length === 2 ? 'gen.len2' : 'gen.len1') })} — {issueText(t, u.reason)}</li>
                })}</ul>
              )}
            </Alert>
          )}
          {draft.qualityReport.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 font-semibold">{t('quality.title')}</h3>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {draft.qualityReport.map((m) => (
                  <li key={m.key} className="flex justify-between gap-2 rounded-md bg-surface-sunken px-3 py-1.5">
                    <span>{t(`quality.metric.${m.key}`)}</span>
                    <span className="num font-semibold">{m.enabled ? <>{m.count} <span className="font-normal text-fg-muted">{t('quality.first', { count: m.initialCount })}</span></> : t('quality.off')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 text-xs text-fg-muted">{t('gen.stats', { time: `${(r.stats.elapsedMs / 1000).toFixed(1)}″`, seed: r.stats.seed })}</div>
        </Card>
      )}
      {accepted && <Alert severity="info" title={t('gen.current', { date: formatDateTime(i18n.language, accepted.createdAt) })} />}
    </div>
  )
}
