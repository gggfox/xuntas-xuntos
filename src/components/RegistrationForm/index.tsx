import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@tanstack/react-form'
import * as m from '../../paraglide/messages.js'
import ErrorSummary from './ErrorSummary'
import FormSection from './FormSection'
import ProgressBar from './ProgressBar'
import StepNav from './StepNav'
import Stepper from './Stepper'
import { useRegistrationForm } from './useRegistrationForm'
import { LAST_STEP, STEPS, STEP_FIELDS } from './steps'
import { useDraftAutosave } from '../../hooks/useDraftAutosave'
import { computeProgress } from '../../lib/registrationProgress'
import type { AccountMilestones } from '../../lib/registrationProgress'
import {
  clampStep,
  firstIncompleteStep,
  firstStepWithError,
  stepErrors,
  stepOfField,
} from '../../lib/registrationSteps'
import { validateRegistration } from '../../lib/registrationRules'
import type { RegistrationData } from '../../lib/registrationSchema'
import type { RegistrationError, RegistrationFieldPath } from '../../lib/registrationRules'

type Props = {
  initial: RegistrationData
  editable: boolean
  onSaveDraft: (data: RegistrationData) => void
  onSubmit: (data: RegistrationData) => Promise<RegistrationError[]>
  alreadySubmitted: boolean
  /** The window's closing date, already in the page's locale. For the footer eyebrow. */
  closesOnText: string
  /** What the reader had already done before this form opened. For the bar. */
  account: AccountMilestones
  /** The step the URL asked for. Treated as a request, not an instruction. */
  initialStep?: number
  /** Where a step change is written back to, so a reload lands in the same place. */
  onStepChange?: (step: number) => void
}

/**
 * Where a failing rule sends the reader.
 *
 * `results`, `rankings` and `form` are deliberately absent: none of them is
 * one input, so the summary lists them without a link rather than scrolling
 * somewhere arbitrary.
 */
const FIELD_IDS: Partial<Record<RegistrationFieldPath, string>> = {
  'personal.name': 'name',
  'personal.email': 'mail',
  'personal.whatsapp': 'tel',
  'personal.birthDate': 'birth',
  'personal.branch': 'branch',
  'personal.state': 'state',
  'personal.city': 'city',
  'academic.school': 'school',
  'academic.grade': 'grade',
  'academic.graduationYear': 'grad',
  'athletic.club': 'club',
  'athletic.coach': 'coach',
  'athletic.ghin': 'ghin',
  motivationLetter: 'letter',
  'confirmations.rules': 'ck1',
  'confirmations.scholarshipUnderstood': 'ck2',
  'confirmations.privacy': 'ck3',
}

function focusById(id: string | undefined) {
  const el = id ? document.getElementById(id) : null
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.focus({ preventScroll: true })
  return true
}

/**
 * The registration, one step at a time.
 *
 * This file coordinates and renders almost nothing: the eight steps and their
 * fields live in `./steps`, one file each, and the whole form is a single
 * TanStack store created in `./useRegistrationForm`. What is left here is the
 * three things only something above all eight steps can answer — which step
 * is showing, whether the reader may leave it, and where a failing rule sends
 * them when the field it names is not currently on screen.
 *
 * The section copy is the one from registro_xuntas.html: XUNTAS approved it,
 * and changing it reopens a conversation the calendar has no room for.
 */
export default function RegistrationForm({
  initial,
  editable,
  onSaveDraft,
  onSubmit,
  alreadySubmitted,
  closesOnText,
  account,
  initialStep,
  onStepChange,
}: Props) {
  /**
   * Errors shown in the summary at the top. Distinct from the per-field state
   * TanStack owns: this is the whole-form picture at the moment of a submit,
   * including problems the server found that no field validator can know.
   */
  const [summary, setSummary] = useState<RegistrationError[]>([])

  /**
   * Where the reader is, and the furthest they have got.
   *
   * The URL is a request. Clamping it to the first unfilled step is what stops
   * a hand-typed `?paso=8` from walking around the gate on "next"; it is
   * applied here, on arrival, and never again, because someone who reaches
   * step 5 and then empties a field on step 2 has not been sent back to step 2.
   */
  const [step, setStep] = useState(() => {
    const wanted = initialStep ?? firstIncompleteStep(STEP_FIELDS, initial)
    // Same reason the gate and the stepper drop their restrictions once the
    // window has closed: with nothing left to fill in there is no order to
    // read it in, and clamping would fight the stepper on every reload.
    return editable ? clampStep(wanted, STEP_FIELDS, initial) : Math.min(Math.max(0, wanted), LAST_STEP)
  })
  /* The furthest step reached, which on arrival is as far as the draft itself
     proves the reader got. Seeded from `step` alone it was session memory and
     nothing else: a reload landing on step 1 — or a sent registration reopened
     at the top — drew eight steps nobody had ever visited, ticks and all
     gone. `firstIncompleteStep` reads the same thing back out of the data,
     since everything before it validates and nothing validates by accident. */
  const [reachable, setReachable] = useState(() =>
    Math.max(step, firstIncompleteStep(STEP_FIELDS, initial)),
  )

  const headingRef = useRef<HTMLLegendElement>(null)
  /** Set when the thing to focus after a step change is a field, not the heading. */
  const pendingField = useRef<string | null>(null)
  const isFirstRender = useRef(true)

  const form = useRegistrationForm({
    initial,
    onValid: async (value) => {
      const serverErrors = await onSubmit(value)
      setSummary(serverErrors)
      if (serverErrors.length > 0) goToFirstError(serverErrors)
    },
    onInvalid: (value) => {
      // The fields have already marked themselves. This fills the summary
      // from the same rules, so the two can never disagree.
      const localErrors = validateRegistration(value)
      setSummary(localErrors)
      goToFirstError(localErrors)
    },
  })

  const values = useStore(form.store, (s) => s.values)
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)

  const flushDraft = useDraftAutosave({ values, initial, enabled: editable, onSave: onSaveDraft })

  /** One pass of the shared rules, reused by the stepper, the gate and the bar. */
  const errors = useMemo(() => validateRegistration(values), [values])

  const errorSteps = useMemo(() => {
    const marked = new Set<number>()
    for (const e of errors) {
      const s = stepOfField(STEP_FIELDS, e.field)
      // Only steps already visited: a step nobody has opened is not "wrong",
      // it is unwritten, and colouring it red on arrival would be a lie.
      if (s !== null && s <= reachable) marked.add(s)
    }
    return marked
  }, [errors, reachable])

  const doneSteps = useMemo(() => {
    const done = new Set<number>()
    for (let i = 0; i <= reachable; i++) {
      if (!errorSteps.has(i)) done.add(i)
    }
    return done
  }, [errorSteps, reachable])

  const go = useCallback(
    (next: number, opts?: { keepSummary?: boolean }) => {
      const target = Math.min(Math.max(0, next), LAST_STEP)
      // Leaving a step is a moment where the work is finished but the debounce
      // has not run out. Cheap when nothing changed — the fingerprint decides.
      flushDraft()
      /* The summary is the picture at the moment of a submit. Once the reader
         has moved on it is a list of problems with a step they are no longer
         looking at, and the stepper says which steps those are anyway. It has
         to survive the jump to the failing step, though — that jump is what
         it was drawn for. */
      if (!opts?.keepSummary) setSummary([])
      setStep(target)
      setReachable((r) => Math.max(r, target))
      onStepChange?.(target)
    },
    [flushDraft, onStepChange],
  )

  const goToFirstError = useCallback(
    (list: RegistrationError[]) => {
      const target = firstStepWithError(STEP_FIELDS, list)
      const id = list.map((e) => FIELD_IDS[e.field]).find(Boolean)
      if (target === null) {
        // Nothing that belongs to a step — a rejection of the whole submission.
        document.getElementById('errors')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      if (target === step) {
        if (!focusById(id)) {
          document.getElementById('errors')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        return
      }
      // The input does not exist yet. The layout effect below focuses it once
      // the step it lives on has mounted.
      pendingField.current = id ?? null
      go(target, { keepSummary: true })
    },
    [go, step],
  )

  /**
   * Focus follows the step.
   *
   * Doing nothing here is worse than it sounds: the button that was just
   * pressed unmounts, focus falls back to `<body>`, and the next Tab starts
   * again from the top of the page.
   */
  useLayoutEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const id = pendingField.current
    pendingField.current = null
    if (id && focusById(id)) return
    headingRef.current?.focus({ preventScroll: true })
    headingRef.current?.scrollIntoView({ block: 'start' })
  }, [step])

  const onNext = useCallback(() => {
    // A closed window has nothing to gate. Holding someone on a step over a
    // field they are no longer allowed to fill in would be a door with no
    // handle — and the stepper beside it already lets them past.
    const blocking = editable ? stepErrors(STEP_FIELDS, step, errors) : []
    if (blocking.length > 0) {
      // Nothing is disabled, so this is the moment the reader finds out what
      // is missing: mark the step's fields so each one says so for itself.
      for (const field of STEPS[step].fields) void form.validateField(field, 'submit')
      focusById(blocking.map((e) => FIELD_IDS[e.field]).find(Boolean))
      return
    }
    go(step + 1)
  }, [editable, errors, form, go, step])

  const onSelectError = useCallback(
    (field: RegistrationError['field'], id: string) => {
      const target = stepOfField(STEP_FIELDS, field)
      if (target === null || target === step) {
        focusById(id)
        return
      }
      pendingField.current = id
      go(target, { keepSummary: true })
    },
    [go, step],
  )

  const fieldId = useCallback((field: RegistrationFieldPath) => FIELD_IDS[field], [])

  const current = STEPS[step]
  const Step = current.Component

  return (
    <form
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault()
        void form.handleSubmit()
      }}
    >
      {/* One header, one stepper. Rendering a second copy for a narrow screen
          would put eight buttons and a landmark on the page twice, which a
          screen reader has no way to know is the same set of eight. The
          account pill sheds its label instead. */}
      <div className="sticky top-0 z-40 -mx-[22px] mb-6 border-b border-line bg-paper/95 px-[22px] backdrop-blur">
        <ProgressBar percent={computeProgress(values, account)} />
        <Stepper
          steps={STEPS}
          current={step}
          /* A closed window has nothing to gate: nothing can be changed, so
             there is no wrong order to read it in. */
          reachable={editable ? reachable : LAST_STEP}
          errorSteps={errorSteps}
          doneSteps={doneSteps}
          onSelect={(i) => go(i)}
        />
      </div>

      {/* The position only. The title is announced by the legend that focus
          lands on, and saying both here would say everything twice. */}
      <p aria-live="polite" className="sr-only">
        {m.reg_step_of({ n: step + 1, total: STEPS.length })}
      </p>

      <ErrorSummary errors={summary} fieldId={fieldId} onSelect={onSelectError} />

      <FormSection
        key={step}
        n={current.n}
        title={current.title()}
        sub={current.sub?.()}
        headingRef={headingRef}
        disabled={!editable}
      >
        <Step form={form} />
      </FormSection>

      <StepNav
        step={step}
        isLast={step === LAST_STEP}
        editable={editable}
        isSubmitting={isSubmitting}
        alreadySubmitted={alreadySubmitted}
        onBack={() => go(step - 1)}
        onNext={onNext}
      />

      <p className="eyebrow mt-4">
        {editable ? m.reg_closing({ date: closesOnText }) : m.reg_closed({ date: closesOnText })}
      </p>
    </form>
  )
}
