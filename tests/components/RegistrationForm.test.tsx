import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import RegistrationForm from '../../src/components/RegistrationForm'
import { emptyRegistration } from '../../convex/lib/registrationSchema'
import { RESULTS_MIN } from '../../convex/lib/registrationRules'
import type { RegistrationData } from '../../convex/lib/registrationSchema'
import type { RegistrationError } from '../../src/lib/registrationRules'

/**
 * Labels are matched through the message functions rather than as literals.
 *
 * Paraglide resolves the locale from the URL, and this jsdom harness has no
 * locale prefix, so it renders English while the node tests render Spanish.
 * Hardcoding either would make the suite depend on which harness it ran in.
 */
function label(text: string) {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
}

/**
 * `DateField` puts the field's label on its calendar panel as well as on its
 * input, so a label match alone is ambiguous there. Everything this suite
 * asks about is a form control.
 */
function control(text: string) {
  return screen.getByLabelText(label(text), { selector: 'input, select, textarea' })
}

function complete(): RegistrationData {
  const d = emptyRegistration({
    name: 'Ana Gómez',
    email: 'ana@example.com',
    whatsapp: '5512345678',
    birthDate: '2008-04-11',
    branch: 'womens',
    state: 'Nuevo León',
    city: 'Monterrey',
  })
  d.academic = { school: 'ITESM', grade: '11', graduationYear: '2027', interest: '' }
  d.athletic = { club: 'Campestre', coach: 'L. Ruiz', ghin: '4.2', amateurStatus: true }
  d.results = Array.from({ length: RESULTS_MIN }, (_, i) => ({
    tournament: `Torneo ${i + 1}`,
    result: `${i + 1}º`,
  }))
  d.rankings = [{ name: 'CNIJ', position: '12' }]
  d.motivationLetter = 'Quiero jugar.'
  d.confirmations = { rules: true, scholarshipUnderstood: true, privacy: true }
  return d
}

/** The panel only renders the form once all three are true. */
const SIGNED_UP = { created: true, emailVerified: true, ageDeclared: true }

function renderForm(overrides: Partial<Parameters<typeof RegistrationForm>[0]> = {}) {
  const onSubmit = vi.fn<(d: RegistrationData) => Promise<RegistrationError[]>>(async () => [])
  const onSaveDraft = vi.fn()
  const initial = overrides.initial ?? emptyRegistration()
  render(
    <RegistrationForm
      initial={initial}
      editable
      account={SIGNED_UP}
      alreadySubmitted={false}
      closesOnText="18 de septiembre de 2026"
      onSaveDraft={onSaveDraft}
      onSubmit={onSubmit}
      {...overrides}
    />,
  )
  return { onSubmit, onSaveDraft }
}

describe('RegistrationForm validation', () => {
  it('marks nothing as wrong before the reader has touched it', () => {
    renderForm()
    expect(screen.getByLabelText(label(m.reg_name()))).toHaveAttribute('aria-invalid', 'false')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  /**
   * Blur, not change: telling someone their name is invalid after one
   * keystroke is the behaviour this replaced.
   */
  it('reports a field as wrong when it is left, not while it is typed', () => {
    renderForm()
    const email = screen.getByLabelText(label(m.reg_email()))

    fireEvent.change(email, { target: { value: 'nope' } })
    expect(email).toHaveAttribute('aria-invalid', 'false')

    fireEvent.blur(email)
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(m.reg_email_error())).toBeInTheDocument()
  })

  it('wires the message to the input with aria-describedby', () => {
    renderForm()
    const email = screen.getByLabelText(label(m.reg_email()))
    fireEvent.change(email, { target: { value: 'nope' } })
    fireEvent.blur(email)

    const describedBy = email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)).toHaveTextContent(m.reg_email_error())
  })

  it('clears a field error once it is fixed', () => {
    renderForm()
    const email = screen.getByLabelText(label(m.reg_email()))
    fireEvent.change(email, { target: { value: 'nope' } })
    fireEvent.blur(email)
    expect(email).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(email, { target: { value: 'ana@example.com' } })
    fireEvent.blur(email)
    expect(email).toHaveAttribute('aria-invalid', 'false')
  })

  it('summarises the problems at the top when an empty form is submitted', async () => {
    const { onSubmit } = renderForm()
    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })

    const summary = await screen.findByRole('alert')
    expect(summary).toHaveTextContent(m.reg_errors_title())
    expect(summary).toHaveTextContent(m.reg_name_error())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  /**
   * The old form pushed the checkbox LABEL as the error text, so the summary
   * read as a list of statements ("I accept the terms…") rather than problems.
   */
  it('states what is wrong with a confirmation rather than repeating its label', async () => {
    renderForm()
    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })
    const summary = await screen.findByRole('alert')
    expect(summary).toHaveTextContent(m.reg_ck_rules_error())
    // The label itself is the statement, not the problem.
    expect(summary).not.toHaveTextContent(m.reg_ck_rules())
  })

  it('submits a complete form and passes the values on', async () => {
    const { onSubmit } = renderForm({ initial: complete() })
    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0].personal.email).toBe('ana@example.com')
  })

  it('shows what the server rejected', async () => {
    const onSubmit = vi.fn(async (): Promise<RegistrationError[]> => [
      { field: 'form', code: 'window_closed' },
    ])
    render(
      <RegistrationForm
        initial={complete()}
        editable
        account={SIGNED_UP}
        alreadySubmitted={false}
        closesOnText="18 de septiembre de 2026"
        onSaveDraft={vi.fn()}
        onSubmit={onSubmit}
      />,
    )
    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(m.err_window_closed())
  })
})

describe('RegistrationForm autosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves the draft after the typing stops', () => {
    const onSaveDraft = vi.fn()
    render(
      <RegistrationForm
        initial={emptyRegistration()}
        editable
        account={SIGNED_UP}
        alreadySubmitted={false}
        closesOnText="18 de septiembre de 2026"
        onSaveDraft={onSaveDraft}
        onSubmit={async () => []}
      />,
    )

    fireEvent.change(screen.getByLabelText(label(m.reg_name())), { target: { value: 'Ana' } })
    expect(onSaveDraft).not.toHaveBeenCalled()

    act(() => void vi.advanceTimersByTime(1500))
    expect(onSaveDraft).toHaveBeenCalledTimes(1)
    expect(onSaveDraft.mock.calls[0][0].personal.name).toBe('Ana')
  })

  it('saves nothing when the form is opened and left alone', () => {
    const onSaveDraft = vi.fn()
    render(
      <RegistrationForm
        initial={complete()}
        editable
        account={SIGNED_UP}
        alreadySubmitted={false}
        closesOnText="18 de septiembre de 2026"
        onSaveDraft={onSaveDraft}
        onSubmit={async () => []}
      />,
    )
    act(() => void vi.advanceTimersByTime(10000))
    expect(onSaveDraft).not.toHaveBeenCalled()
  })

  it('saves nothing once the window has closed', () => {
    const onSaveDraft = vi.fn()
    render(
      <RegistrationForm
        initial={emptyRegistration()}
        editable={false}
        account={SIGNED_UP}
        alreadySubmitted
        closesOnText="18 de septiembre de 2026"
        onSaveDraft={onSaveDraft}
        onSubmit={async () => []}
      />,
    )
    fireEvent.change(screen.getByLabelText(label(m.reg_name())), { target: { value: 'Ana' } })
    act(() => void vi.advanceTimersByTime(10000))
    expect(onSaveDraft).not.toHaveBeenCalled()
  })
})

/**
 * `DateField` is a text box, a toggle and a calendar grid in one widget, and
 * moving between those three is not leaving the field. It reported no blur at
 * all for a while — the component had no `onBlur` prop to report it with — so
 * `personal.birthDate` was the one field of twenty-one whose validator never
 * ran until the form was submitted.
 */
describe('date of birth blur', () => {
  it('reports an empty date of birth once the field is left', () => {
    renderForm()
    const birth = control(m.reg_birth_date())
    expect(birth).toHaveAttribute('aria-invalid', 'false')

    fireEvent.focusOut(birth, { relatedTarget: document.body })
    expect(birth).toHaveAttribute('aria-invalid', 'true')
  })

  it('stays quiet while focus is still moving around inside the field', () => {
    renderForm()
    const birth = control(m.reg_birth_date())
    /* The step opens the calendar with the field, so the toggle is the one
       offering to close it. */
    const toggle = screen.getByRole('button', { name: m.date_close() })

    // On the way to the calendar: the date is empty, but they are not done.
    fireEvent.focusOut(birth, { relatedTarget: toggle })
    expect(birth).toHaveAttribute('aria-invalid', 'false')

    // Out of the widget altogether, and now it is fair to say so.
    fireEvent.focusOut(toggle, { relatedTarget: document.body })
    expect(birth).toHaveAttribute('aria-invalid', 'true')
  })
})

/**
 * Asked generically rather than field by field. A required input that never
 * reports blur cannot report anything until submit, and the type system will
 * not catch the omission: `onBlur` is optional on every field wrapper. The
 * next field wired without one fails here instead of in front of a reader.
 */
describe('every required field in section 1', () => {
  const required = [
    m.reg_name(),
    m.reg_email(),
    m.reg_whatsapp(),
    m.reg_birth_date(),
    m.reg_branch(),
    m.reg_city(),
  ]

  it.each(required)('marks %s as wrong once it is left empty', (text) => {
    renderForm()
    const input = control(text)
    expect(input).toHaveAttribute('aria-invalid', 'false')

    fireEvent.focusOut(input, { relatedTarget: document.body })
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })
})
