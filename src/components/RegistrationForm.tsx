import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as m from '../paraglide/messages.js'
import DateField from './DateField'
import type { RegistrationData, Row } from '../lib/form'
import {
  LETTER_LIMIT,
  FIXED_RANKINGS,
  emptyRow,
  emptyRegistration,
  validateRegistration,
} from '../lib/form'
import { DOCUMENTS } from '../lib/documents'

type Props = {
  initial: RegistrationData
  editable: boolean
  onSaveDraft: (data: RegistrationData) => void
  onSubmit: (data: RegistrationData) => Promise<string[]>
  alreadySubmitted: boolean
}

/**
 * Registration form. The eight sections and their copy are the ones from
 * registro_xuntas.html: XUNTAS already approved them, and changing them
 * reopens a conversation the calendar has no room for.
 */
export default function RegistrationForm({
  initial,
  editable,
  onSaveDraft,
  onSubmit,
  alreadySubmitted,
}: Props) {
  const [data, setData] = useState<RegistrationData>(initial)
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  /**
   * Fingerprint of the last thing sent to be saved. It starts with what came
   * from the server, so opening the form and touching nothing saves nothing.
   */
  const lastSaved = useRef(JSON.stringify(initial))

  /**
   * Autosave. An eight-section form with a one-page letter cannot be lost
   * because the wifi dropped at the club.
   *
   * The comparison against `lastSaved` is not an optimization, it is what cuts
   * a loop: saving changes `updatedAt`, that invalidates the reactive query
   * feeding this screen, the parent re-renders and the effect fires again.
   * Without this cut, every open tab wrote to Convex every 1.2 s forever, even
   * if nobody was typing.
   *
   * Why an effect and not the change handlers: the save is not one
   * interaction, it is the silence after the last of them. Every keystroke has
   * to cancel the timer the one before it started, which is exactly what the
   * cleanup does; a handler would have to hold the same timer in a ref and
   * rebuild the cancelling by hand, in every one of the form's setters.
   * `onSaveDraft` is memoised by the route, so it does not restart the timer.
   * See `.agents/skills/vercel-react-best-practices/rules/rerender-move-effect-to-event.md`.
   */
  useEffect(() => {
    if (!editable) return
    const fingerprint = JSON.stringify(data)
    if (fingerprint === lastSaved.current) return

    const t = setTimeout(() => {
      lastSaved.current = fingerprint
      onSaveDraft(data)
    }, 1200)
    return () => clearTimeout(t)
  }, [data, editable, onSaveDraft])

  const set = useCallback(<K extends keyof RegistrationData>(key: K, value: RegistrationData[K]) => {
    setData((d) => ({ ...d, [key]: value }))
  }, [])

  const progress = useMemo(() => computeProgress(data), [data])

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const localErrors = validateRegistration(data)
    if (localErrors.length > 0) {
      setErrors(localErrors)
      document.getElementById('errors')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSubmitting(true)
    try {
      const serverErrors = await onSubmit(data)
      setErrors(serverErrors)
      if (serverErrors.length > 0) {
        document.getElementById('errors')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {/* Sticky progress bar, as in the prototype. */}
      <div className="sticky top-0 z-40 -mx-[22px] mb-8 border-b border-line bg-paper/95 px-[22px] py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="eyebrow whitespace-nowrap">{progress}% completado</span>
          <div className="h-[3px] flex-1 overflow-hidden rounded-sm bg-line">
            <i
              className="block h-full bg-yel transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div
          id="errors"
          role="alert"
          className="mb-8 rounded-[9px] border border-bad/40 bg-bad/5 px-5 py-4"
        >
          <b className="mb-2 block font-disp text-[14.5px] text-bad">
            Falta algo antes de enviar
          </b>
          <ul className="m-0 list-disc pl-5 text-[13px] text-ink-3">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <Section n={1} title={m.reg_s1_title()} sub={m.reg_s1_sub()}>
        <Grid>
          <Field
            id="name"
            label={m.reg_name()}
            req
            value={data.personal.name}
            onChange={(v) => set('personal', { ...data.personal, name: v })}
            autoComplete="name"
          />
          <Field
            id="mail"
            type="email"
            label={m.reg_email()}
            req
            value={data.personal.email}
            onChange={(v) => set('personal', { ...data.personal, email: v })}
            autoComplete="email"
          />
          <Field
            id="tel"
            type="tel"
            label={m.reg_whatsapp()}
            req
            value={data.personal.whatsapp}
            onChange={(v) => set('personal', { ...data.personal, whatsapp: v })}
            autoComplete="tel"
          />
          <div className="mb-[15px]">
            <DateField
              id="birth"
              label={m.reg_birth_date()}
              req
              value={data.personal.birthDate}
              onChange={(v) => set('personal', { ...data.personal, birthDate: v })}
              autoComplete="bday"
            />
          </div>
          <Select
            id="branch"
            label={m.reg_branch()}
            req
            value={data.personal.branch}
            onChange={(v) => set('personal', { ...data.personal, branch: v as 'womens' | 'mens' })}
            options={[
              { v: '', t: m.reg_branch_select() },
              { v: 'womens', t: m.reg_branch_womens() },
              { v: 'mens', t: m.reg_branch_mens() },
            ]}
          />
          <Field
            id="city"
            label={m.reg_city()}
            req
            value={data.personal.cityState}
            onChange={(v) => set('personal', { ...data.personal, cityState: v })}
          />
        </Grid>
      </Section>

      <Section n={2} title={m.reg_s2_title()} sub={m.reg_s2_sub()}>
        <Grid>
          <Field
            id="school"
            label={m.reg_school()}
            req
            value={data.academic.school}
            onChange={(v) => set('academic', { ...data.academic, school: v })}
          />
          <Field
            id="grade"
            label={m.reg_grade()}
            req
            value={data.academic.grade}
            onChange={(v) => set('academic', { ...data.academic, grade: v })}
          />
          <Field
            id="grad"
            label={m.reg_graduation()}
            help={m.reg_graduation_help()}
            value={data.academic.graduationYear ?? ''}
            onChange={(v) => set('academic', { ...data.academic, graduationYear: v })}
          />
          <Field
            id="interest"
            label={m.reg_interest()}
            value={data.academic.interest ?? ''}
            onChange={(v) => set('academic', { ...data.academic, interest: v })}
          />
        </Grid>
      </Section>

      <Section n={3} title={m.reg_s3_title()}>
        <Grid>
          <Field
            id="club"
            label={m.reg_club()}
            req
            value={data.athletic.club}
            onChange={(v) => set('athletic', { ...data.athletic, club: v })}
          />
          <Field
            id="coach"
            label={m.reg_coach()}
            req
            value={data.athletic.coach}
            onChange={(v) => set('athletic', { ...data.athletic, coach: v })}
          />
          <Select
            id="status"
            label={m.reg_status()}
            req
            help={m.reg_status_help()}
            value={data.athletic.amateurStatus ? 'amateur' : ''}
            onChange={(v) =>
              set('athletic', { ...data.athletic, amateurStatus: v === 'amateur' })
            }
            options={[
              { v: '', t: m.reg_branch_select() },
              { v: 'amateur', t: m.reg_status_amateur() },
              { v: 'pro', t: m.reg_status_pro() },
            ]}
          />
          <Field
            id="ghin"
            label={m.reg_ghin()}
            req
            value={data.athletic.ghin}
            onChange={(v) => set('athletic', { ...data.athletic, ghin: v })}
          />
        </Grid>
      </Section>

      <Section n={4} title={m.reg_s4_title()} sub={m.reg_s4_sub()}>
        <DynamicRows
          rows={data.results.map((r) => ({ a: r.tournament, b: r.result }))}
          phA={m.reg_tournament_name()}
          phB={m.reg_tournament_result()}
          addLabel={m.reg_add_tournament()}
          onChange={(rows) =>
            set('results', rows.map((f) => ({ tournament: f.a, result: f.b })))
          }
        />
      </Section>

      <Section n={5} title={m.reg_s5_title()} sub={m.reg_s5_sub()}>
        {FIXED_RANKINGS.map((name, i) => (
          <div key={name} className="mb-[9px] grid grid-cols-[1fr_128px] gap-[10px]">
            <input className="fld-input bg-paper text-soft" value={name} readOnly tabIndex={-1} />
            <input
              className="fld-input"
              aria-label={`${m.reg_ranking_position()} ${name}`}
              placeholder={m.reg_ranking_position()}
              value={data.rankings[i]?.position ?? ''}
              onChange={(e) => {
                const copy = [...data.rankings]
                copy[i] = { name, position: e.target.value }
                set('rankings', copy)
              }}
            />
          </div>
        ))}
        <div className="mb-[9px] grid grid-cols-[1fr_128px] gap-[10px]">
          <input
            className="fld-input"
            placeholder={m.reg_ranking_other()}
            aria-label={m.reg_ranking_other()}
            value={data.rankings[FIXED_RANKINGS.length]?.name ?? ''}
            onChange={(e) => {
              const copy = [...data.rankings]
              copy[FIXED_RANKINGS.length] = {
                name: e.target.value,
                position: copy[FIXED_RANKINGS.length]?.position ?? '',
              }
              set('rankings', copy)
            }}
          />
          <input
            className="fld-input"
            aria-label={`${m.reg_ranking_position()} ${m.reg_ranking_other()}`}
            placeholder={m.reg_ranking_position()}
            value={data.rankings[FIXED_RANKINGS.length]?.position ?? ''}
            onChange={(e) => {
              const copy = [...data.rankings]
              copy[FIXED_RANKINGS.length] = {
                name: copy[FIXED_RANKINGS.length]?.name ?? '',
                position: e.target.value,
              }
              set('rankings', copy)
            }}
          />
        </div>
      </Section>

      <Section n={6} title={m.reg_s6_title()} sub={m.reg_s6_sub()}>
        <DynamicRows
          rows={data.calendar.map((c) => ({ a: c.event, b: c.date }))}
          phA={m.reg_event_name()}
          phB={m.reg_event_date()}
          addLabel={m.reg_add_event()}
          onChange={(rows) => set('calendar', rows.map((f) => ({ event: f.a, date: f.b })))}
        />
      </Section>

      <Section n={7} title={m.reg_s7_title()} sub={m.reg_s7_sub()}>
        <textarea
          id="letter"
          className="fld-input min-h-[240px] resize-y leading-[1.65]"
          value={data.motivationLetter}
          maxLength={LETTER_LIMIT}
          onChange={(e) => set('motivationLetter', e.target.value)}
          aria-label={m.reg_s7_title()}
        />
        <p
          className={`mt-1.5 font-mono text-[11.5px] ${
            data.motivationLetter.length > LETTER_LIMIT * 0.92 ? 'text-warn' : 'text-soft'
          }`}
        >
          {data.motivationLetter.length.toLocaleString('es-MX')} /{' '}
          {LETTER_LIMIT.toLocaleString('es-MX')} caracteres
        </p>
      </Section>

      <Section n={8} title={m.reg_s8_title()}>
        <Checkbox
          id="ck1"
          title={m.reg_ck_rules()}
          sub={m.reg_ck_rules_sub()}
          checked={data.confirmations.rules}
          onChange={(v) => set('confirmations', { ...data.confirmations, rules: v })}
          doc={{ ...DOCUMENTS.rules, label: m.rules_title() }}
        />
        <Checkbox
          id="ck2"
          title={m.reg_ck_scholarship()}
          sub={m.reg_ck_scholarship_sub()}
          checked={data.confirmations.scholarshipUnderstood}
          onChange={(v) => set('confirmations', { ...data.confirmations, scholarshipUnderstood: v })}
        />
        <Checkbox
          id="ck3"
          title={m.reg_ck_privacy()}
          sub={m.reg_ck_privacy_sub()}
          checked={data.confirmations.privacy}
          onChange={(v) => set('confirmations', { ...data.confirmations, privacy: v })}
          doc={{ ...DOCUMENTS.privacyNotice, label: m.privacy_title() }}
        />
      </Section>

      <div className="mt-9 flex flex-wrap items-center gap-4">
        <button type="submit" className="btn" disabled={!editable || submitting}>
          {submitting ? m.common_loading() : alreadySubmitted ? m.reg_save_changes() : m.reg_submit()}
        </button>
        <span className="eyebrow">{editable ? m.reg_closing() : m.reg_closed()}</span>
      </div>
    </form>
  )
}

// --- pieces -----------------------------------------------------------------

function Section({
  n,
  title,
  sub,
  children,
}: {
  n: number
  title: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="mb-[34px] scroll-mt-20 border-0 p-0">
      <legend className="mb-[3px] flex items-baseline gap-[9px] p-0 font-disp text-[18px] font-bold">
        {n} · {title}
      </legend>
      {sub && <p className="mt-0 mb-[17px] max-w-[62ch] text-[13.5px] font-light text-soft">{sub}</p>}
      {children}
    </fieldset>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-[15px] sm:grid-cols-2">{children}</div>
}

function Field({
  id,
  label,
  req,
  help,
  type = 'text',
  value,
  onChange,
  autoComplete,
}: {
  id: string
  label: string
  req?: boolean
  help?: string
  type?: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
}) {
  return (
    <div className="mb-[15px] flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-medium">
        {label} {req && <span className="text-bad">*</span>}
      </label>
      <input
        id={id}
        type={type}
        className="fld-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
      {help && <p className="text-[11.5px] text-soft">{help}</p>}
    </div>
  )
}

function Select({
  id,
  label,
  req,
  help,
  value,
  onChange,
  options,
}: {
  id: string
  label: string
  req?: boolean
  help?: string
  value: string
  onChange: (v: string) => void
  options: Array<{ v: string; t: string }>
}) {
  return (
    <div className="mb-[15px] flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-medium">
        {label} {req && <span className="text-bad">*</span>}
      </label>
      <select
        id={id}
        className="fld-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.t}
          </option>
        ))}
      </select>
      {help && <p className="text-[11.5px] text-soft">{help}</p>}
    </div>
  )
}

function Checkbox({
  id,
  title,
  sub,
  checked,
  onChange,
  doc,
}: {
  id: string
  title: string
  sub: string
  checked: boolean
  onChange: (v: boolean) => void
  /** Document this checkbox claims to accept. It is linked next to the text. */
  doc?: { path: string; ready: boolean; label: string }
}) {
  return (
    <label
      htmlFor={id}
      className="mb-3 flex cursor-pointer gap-3 rounded-[9px] border border-line bg-card px-4 py-3.5"
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 flex-none accent-ochre"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <b className="block text-[13.5px] font-semibold">{title}</b>
        <span className="mt-1 block text-[12.5px] leading-relaxed font-light text-soft">{sub}</span>
        {doc && (
          <span className="mt-1.5 block text-[12.5px]">
            {/*
              You cannot accept a document you cannot read. The link opens
              in another tab so nothing typed in gets lost, and `onClick`
              stops propagation so opening it does not tick the checkbox.
            */}
            <a
              href={doc.path}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="underline"
            >
              {doc.label}
            </a>
            {!doc.ready && (
              <span className="ml-2 text-[11.5px] text-warn">{m.doc_pending_chip()}</span>
            )}
          </span>
        )}
      </span>
    </label>
  )
}

/** Rows that grow: results and calendar. There is always an empty one at the end. */
function DynamicRows({
  rows,
  phA,
  phB,
  addLabel,
  onChange,
}: {
  rows: Row[]
  phA: string
  phB: string
  addLabel: string
  onChange: (rows: Row[]) => void
}) {
  function edit(i: number, field: 'a' | 'b', v: string) {
    const copy = rows.map((f, j) => (j === i ? { ...f, [field]: v } : f))
    onChange(copy)
  }

  return (
    <>
      {rows.map((f, i) => (
        <div key={i} className="mb-[9px] grid grid-cols-[1fr_150px_40px] items-center gap-[9px]">
          <input
            className="fld-input"
            placeholder={phA}
            aria-label={`${phA} ${i + 1}`}
            value={f.a}
            onChange={(e) => edit(i, 'a', e.target.value)}
          />
          <input
            className="fld-input"
            placeholder={phB}
            aria-label={`${phB} ${i + 1}`}
            value={f.b}
            onChange={(e) => edit(i, 'b', e.target.value)}
          />
          <button
            type="button"
            className="rounded-ctl border border-line-2 py-2 text-soft hover:border-bad hover:text-bad"
            aria-label={`Quitar fila ${i + 1}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={() => onChange([...rows, emptyRow()])}>
        {addLabel}
      </button>
    </>
  )
}

/** Approximate progress, only for the bar. It is not the validation. */
function computeProgress(d: RegistrationData): number {
  const fields = [
    d.personal.name,
    d.personal.email,
    d.personal.whatsapp,
    d.personal.birthDate,
    d.personal.branch,
    d.personal.cityState,
    d.academic.school,
    d.academic.grade,
    d.athletic.club,
    d.athletic.coach,
    d.athletic.ghin,
    d.results.some((r) => r.tournament && r.result) ? 'x' : '',
    d.motivationLetter,
    d.confirmations.rules ? 'x' : '',
    d.confirmations.scholarshipUnderstood ? 'x' : '',
    d.confirmations.privacy ? 'x' : '',
  ]
  const filled = fields.filter((c) => String(c).trim()).length
  return Math.round((filled / fields.length) * 100)
}

export { emptyRegistration }
