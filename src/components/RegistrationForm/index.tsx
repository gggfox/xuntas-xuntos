import { useCallback, useState } from 'react'
import { revalidateLogic, useForm, useStore } from '@tanstack/react-form'
import * as m from '../../paraglide/messages.js'
import DateField from '../DateField'
import CheckboxField from './CheckboxField'
import DynamicRows from './DynamicRows'
import ErrorSummary from './ErrorSummary'
import FieldGrid from './FieldGrid'
import FormSection from './FormSection'
import LetterField from './LetterField'
import ProgressBar from './ProgressBar'
import RankingRows from './RankingRows'
import SelectField from './SelectField'
import TextField from './TextField'
import { useDraftAutosave } from '../../hooks/useDraftAutosave'
import { computeProgress } from '../../lib/registrationProgress'
import { errorMessage } from '../../lib/registrationErrors'
import { DOCUMENTS } from '../../lib/documents'
import type { RegistrationData } from '../../lib/registrationSchema'
import {
  checkBranch,
  checkEmail,
  checkGraduationYear,
  checkLetter,
  checkName,
  checkRequiredText,
  checkWhatsapp,
  checkBirthDate,
  validateRegistration,
} from '../../lib/registrationRules'
import type { RegistrationError, RegistrationFieldPath } from '../../lib/registrationRules'

type Props = {
  initial: RegistrationData
  editable: boolean
  onSaveDraft: (data: RegistrationData) => void
  onSubmit: (data: RegistrationData) => Promise<RegistrationError[]>
  alreadySubmitted: boolean
}

/**
 * Where a failing rule sends the reader.
 *
 * `results` and `form` are deliberately absent: neither is one input, so the
 * summary lists them without a link rather than scrolling somewhere arbitrary.
 */
const FIELD_IDS: Partial<Record<RegistrationFieldPath, string>> = {
  'personal.name': 'name',
  'personal.email': 'mail',
  'personal.whatsapp': 'tel',
  'personal.birthDate': 'birth',
  'personal.branch': 'branch',
  'personal.cityState': 'city',
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

/** The first error in the returned list is the first one in the document. */
function focusFirst(errors: RegistrationError[]) {
  const first = errors.map((e) => FIELD_IDS[e.field]).find(Boolean)
  const el = first ? document.getElementById(first) : null
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.focus({ preventScroll: true })
    return
  }
  document.getElementById('errors')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/**
 * Registration form. The eight sections and their copy are the ones from
 * registro_xuntas.html: XUNTAS already approved them, and changing them
 * reopens a conversation the calendar has no room for.
 *
 * Validation runs on blur before the first submit and on change after it
 * (`revalidateLogic`), so nobody is told they are wrong halfway through
 * typing their own name, and a field they have already fixed clears itself
 * without waiting for another submit.
 */
export default function RegistrationForm({
  initial,
  editable,
  onSaveDraft,
  onSubmit,
  alreadySubmitted,
}: Props) {
  /**
   * Errors shown in the summary at the top. Distinct from the per-field state
   * TanStack owns: this is the whole-form picture at the moment of a submit,
   * including problems the server found that no field validator can know.
   */
  const [summary, setSummary] = useState<RegistrationError[]>([])

  const form = useForm({
    defaultValues: initial,
    validationLogic: revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' }),
    onSubmit: async ({ value }) => {
      const serverErrors = await onSubmit(value)
      setSummary(serverErrors)
      if (serverErrors.length > 0) focusFirst(serverErrors)
    },
    onSubmitInvalid: ({ value }) => {
      // The fields have already marked themselves. This fills the summary
      // from the same rules, so the two can never disagree.
      const localErrors = validateRegistration(value)
      setSummary(localErrors)
      focusFirst(localErrors)
    },
  })

  const values = useStore(form.store, (s) => s.values)
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)

  useDraftAutosave({ values, initial, enabled: editable, onSave: onSaveDraft })

  const fieldId = useCallback((field: RegistrationFieldPath) => FIELD_IDS[field], [])

  return (
    <form
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault()
        void form.handleSubmit()
      }}
    >
      <ProgressBar percent={computeProgress(values)} />

      <ErrorSummary errors={summary} fieldId={fieldId} />

      <FormSection n={1} title={m.reg_s1_title()} sub={m.reg_s1_sub()}>
        <FieldGrid>
          <form.Field name="personal.name" validators={{ onDynamic: ({ value }) => checkName(value) }}>
            {(field) => (
              <TextField
                id="name"
                label={m.reg_name()}
                req
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]}
                autoComplete="name"
              />
            )}
          </form.Field>

          <form.Field name="personal.email" validators={{ onDynamic: ({ value }) => checkEmail(value) }}>
            {(field) => (
              <TextField
                id="mail"
                type="email"
                label={m.reg_email()}
                req
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]}
                autoComplete="email"
              />
            )}
          </form.Field>

          <form.Field name="personal.whatsapp" validators={{ onDynamic: ({ value }) => checkWhatsapp(value) }}>
            {(field) => (
              <TextField
                id="tel"
                type="tel"
                label={m.reg_whatsapp()}
                req
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]}
                autoComplete="tel"
              />
            )}
          </form.Field>

          <form.Field name="personal.birthDate" validators={{ onDynamic: ({ value }) => checkBirthDate(value) }}>
            {(field) => (
              <div className="mb-[15px]">
                <DateField
                  id="birth"
                  label={m.reg_birth_date()}
                  req
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors[0] ? errorMessage(field.state.meta.errors[0]) : undefined}
                  autoComplete="bday"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="personal.branch" validators={{ onDynamic: ({ value }) => checkBranch(value) }}>
            {(field) => (
              <SelectField
                id="branch"
                label={m.reg_branch()}
                req
                value={field.state.value}
                onChange={(v) => field.handleChange(v as 'womens' | 'mens')}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]}
                options={[
                  { v: '', t: m.reg_branch_select() },
                  { v: 'womens', t: m.reg_branch_womens() },
                  { v: 'mens', t: m.reg_branch_mens() },
                ]}
              />
            )}
          </form.Field>

          <form.Field
            name="personal.cityState"
            validators={{ onDynamic: ({ value }) => checkRequiredText(value, 'city_required') }}
          >
            {(field) => (
              <TextField
                id="city"
                label={m.reg_city()}
                req
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]}
              />
            )}
          </form.Field>
        </FieldGrid>
      </FormSection>

      <FormSection n={2} title={m.reg_s2_title()} sub={m.reg_s2_sub()}>
        <FieldGrid>
          <form.Field
            name="academic.school"
            validators={{ onDynamic: ({ value }) => checkRequiredText(value, 'school_required') }}
          >
            {(field) => (
              <TextField
                id="school"
                label={m.reg_school()}
                req
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]}
              />
            )}
          </form.Field>

          <form.Field
            name="academic.grade"
            validators={{ onDynamic: ({ value }) => checkRequiredText(value, 'grade_required') }}
          >
            {(field) => (
              <TextField
                id="grade"
                label={m.reg_grade()}
                req
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]}
              />
            )}
          </form.Field>

          <form.Field
            name="academic.graduationYear"
            validators={{ onDynamic: ({ value }) => checkGraduationYear(value) }}
          >
            {(field) => (
              <TextField
                id="grad"
                label={m.reg_graduation()}
                help={m.reg_graduation_help()}
                value={field.state.value ?? ''}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]}
              />
            )}
          </form.Field>

          <form.Field name="academic.interest">
            {(field) => (
              <TextField
                id="interest"
                label={m.reg_interest()}
                value={field.state.value ?? ''}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              />
            )}
          </form.Field>
        </FieldGrid>
      </FormSection>

      <FormSection n={3} title={m.reg_s3_title()}>
        <FieldGrid>
          <form.Field
            name="athletic.club"
            validators={{ onDynamic: ({ value }) => checkRequiredText(value, 'club_required') }}
          >
            {(field) => (
              <TextField
                id="club"
                label={m.reg_club()}
                req
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]}
              />
            )}
          </form.Field>

          <form.Field
            name="athletic.coach"
            validators={{ onDynamic: ({ value }) => checkRequiredText(value, 'coach_required') }}
          >
            {(field) => (
              <TextField
                id="coach"
                label={m.reg_coach()}
                req
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]}
              />
            )}
          </form.Field>

          <form.Field name="athletic.amateurStatus">
            {(field) => (
              <SelectField
                id="status"
                label={m.reg_status()}
                req
                help={m.reg_status_help()}
                value={field.state.value ? 'amateur' : ''}
                onChange={(v) => field.handleChange(v === 'amateur')}
                onBlur={field.handleBlur}
                options={[
                  { v: '', t: m.reg_branch_select() },
                  { v: 'amateur', t: m.reg_status_amateur() },
                  { v: 'pro', t: m.reg_status_pro() },
                ]}
              />
            )}
          </form.Field>

          <form.Field
            name="athletic.ghin"
            validators={{ onDynamic: ({ value }) => checkRequiredText(value, 'ghin_required') }}
          >
            {(field) => (
              <TextField
                id="ghin"
                label={m.reg_ghin()}
                req
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]}
              />
            )}
          </form.Field>
        </FieldGrid>
      </FormSection>

      <FormSection n={4} title={m.reg_s4_title()} sub={m.reg_s4_sub()}>
        <form.Field
          name="results"
          mode="array"
          validators={{
            onDynamic: ({ value }) =>
              value.some((r) => r.tournament.trim() && r.result.trim())
                ? undefined
                : ('results_required' as const),
          }}
        >
          {(field) => (
            <>
              <DynamicRows
                rows={field.state.value.map((r) => ({ a: r.tournament, b: r.result }))}
                phA={m.reg_tournament_name()}
                phB={m.reg_tournament_result()}
                addLabel={m.reg_add_tournament()}
                onEdit={(i, key, v) => {
                  const row = field.state.value[i]
                  field.replaceValue(i, key === 'a' ? { ...row, tournament: v } : { ...row, result: v })
                }}
                onRemove={(i) => field.removeValue(i)}
                onAdd={() => field.pushValue({ tournament: '', result: '' })}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors[0] && (
                <p className="mt-1.5 text-[11.5px] text-bad">
                  {errorMessage(field.state.meta.errors[0])}
                </p>
              )}
            </>
          )}
        </form.Field>
      </FormSection>

      <FormSection n={5} title={m.reg_s5_title()} sub={m.reg_s5_sub()}>
        <form.Field name="rankings" mode="array">
          {(field) => (
            <RankingRows
              rankings={field.state.value}
              onChange={(i, value) => {
                if (i < field.state.value.length) field.replaceValue(i, value)
                else field.pushValue(value)
              }}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>
      </FormSection>

      <FormSection n={6} title={m.reg_s6_title()} sub={m.reg_s6_sub()}>
        <form.Field name="calendar" mode="array">
          {(field) => (
            <DynamicRows
              rows={field.state.value.map((c) => ({ a: c.event, b: c.date }))}
              phA={m.reg_event_name()}
              phB={m.reg_event_date()}
              addLabel={m.reg_add_event()}
              onEdit={(i, key, v) => {
                const row = field.state.value[i]
                field.replaceValue(i, key === 'a' ? { ...row, event: v } : { ...row, date: v })
              }}
              onRemove={(i) => field.removeValue(i)}
              onAdd={() => field.pushValue({ event: '', date: '' })}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>
      </FormSection>

      <FormSection n={7} title={m.reg_s7_title()} sub={m.reg_s7_sub()}>
        <form.Field name="motivationLetter" validators={{ onDynamic: ({ value }) => checkLetter(value) }}>
          {(field) => (
            <LetterField
              id="letter"
              label={m.reg_s7_title()}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={field.state.meta.errors[0]}
            />
          )}
        </form.Field>
      </FormSection>

      <FormSection n={8} title={m.reg_s8_title()}>
        <form.Field
          name="confirmations.rules"
          validators={{ onDynamic: ({ value }) => (value ? undefined : ('confirm_rules_required' as const)) }}
        >
          {(field) => (
            <CheckboxField
              id="ck1"
              title={m.reg_ck_rules()}
              sub={m.reg_ck_rules_sub()}
              checked={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={field.state.meta.errors[0]}
              doc={{ ...DOCUMENTS.rules, label: m.rules_title() }}
            />
          )}
        </form.Field>

        <form.Field
          name="confirmations.scholarshipUnderstood"
          validators={{
            onDynamic: ({ value }) => (value ? undefined : ('confirm_scholarship_required' as const)),
          }}
        >
          {(field) => (
            <CheckboxField
              id="ck2"
              title={m.reg_ck_scholarship()}
              sub={m.reg_ck_scholarship_sub()}
              checked={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={field.state.meta.errors[0]}
            />
          )}
        </form.Field>

        <form.Field
          name="confirmations.privacy"
          validators={{ onDynamic: ({ value }) => (value ? undefined : ('confirm_privacy_required' as const)) }}
        >
          {(field) => (
            <CheckboxField
              id="ck3"
              title={m.reg_ck_privacy()}
              sub={m.reg_ck_privacy_sub()}
              checked={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={field.state.meta.errors[0]}
              doc={{ ...DOCUMENTS.privacyNotice, label: m.privacy_title() }}
            />
          )}
        </form.Field>
      </FormSection>

      <div className="mt-9 flex flex-wrap items-center gap-4">
        <button type="submit" className="btn" disabled={!editable || isSubmitting}>
          {isSubmitting
            ? m.common_loading()
            : alreadySubmitted
              ? m.reg_save_changes()
              : m.reg_submit()}
        </button>
        <span className="eyebrow">{editable ? m.reg_closing() : m.reg_closed()}</span>
      </div>
    </form>
  )
}
