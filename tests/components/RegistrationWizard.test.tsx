import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import RegistrationForm from '../../src/components/RegistrationForm'
import { emptyRegistration } from '../../convex/lib/registrationSchema'
import type { RegistrationData } from '../../convex/lib/registrationSchema'
import type { RegistrationError } from '../../src/lib/registrationRules'

const SIGNED_UP = { created: true, emailVerified: true, ageDeclared: true }

/** Everything section 1 asks for, and nothing after it. */
function throughStep1(): RegistrationData {
  return emptyRegistration({
    name: 'Ana Gómez',
    email: 'ana@example.com',
    whatsapp: '5512345678',
    birthDate: '2008-04-11',
    branch: 'womens',
    cityState: 'Monterrey, NL',
  })
}

function complete(): RegistrationData {
  const d = throughStep1()
  d.academic = { school: 'ITESM', grade: '11', graduationYear: '2027', interest: '' }
  d.athletic = { club: 'Campestre', coach: 'L. Ruiz', ghin: '4.2', amateurStatus: true }
  d.results = [{ tournament: 'CNIJ', result: '2º' }]
  d.motivationLetter = 'Quiero jugar.'
  d.confirmations = { rules: true, scholarshipUnderstood: true, privacy: true }
  return d
}

function renderWizard(overrides: Partial<Parameters<typeof RegistrationForm>[0]> = {}) {
  const onSubmit = vi.fn<(d: RegistrationData) => Promise<RegistrationError[]>>(async () => [])
  const onSaveDraft = vi.fn()
  const onStepChange = vi.fn()
  render(
    <RegistrationForm
      initial={overrides.initial ?? emptyRegistration()}
      editable
      account={SIGNED_UP}
      alreadySubmitted={false}
      onSaveDraft={onSaveDraft}
      onSubmit={onSubmit}
      onStepChange={onStepChange}
      {...overrides}
    />,
  )
  return { onSubmit, onSaveDraft, onStepChange }
}

/** The step showing, read off the legend that heads it: `3 · Club, academia…`. */
function shownStep(): number {
  const legend = document.querySelector('legend')
  return Number(legend?.textContent?.trim().split(' ')[0])
}

const next = () => screen.getByRole('button', { name: m.reg_step_next() })
const back = () => screen.getByRole('button', { name: m.reg_step_prev() })

describe('which step the form opens on', () => {
  it('starts an untouched registration at the beginning', () => {
    renderWizard()
    expect(shownStep()).toBe(1)
  })

  it('picks up where the draft ran out', () => {
    const d = complete()
    d.motivationLetter = ''
    renderWizard({ initial: d })
    expect(shownStep()).toBe(7)
  })

  /** Coming back to a finished draft means coming back to send it. */
  it('opens a complete draft where the submit button is', () => {
    renderWizard({ initial: complete() })
    expect(shownStep()).toBe(8)
    expect(screen.getByRole('button', { name: m.reg_submit() })).toBeInTheDocument()
  })

  it('honours a step the URL asked for', () => {
    renderWizard({ initial: complete(), initialStep: 3 })
    expect(shownStep()).toBe(4)
  })

  /**
   * The gate on "next" would be worth nothing if a hand-typed `?paso=8` went
   * around it.
   */
  it('will not let the URL skip past what has been filled in', () => {
    renderWizard({ initial: emptyRegistration(), initialStep: 7 })
    expect(shownStep()).toBe(1)
  })
})

describe('moving between steps', () => {
  it('refuses to advance while the step is incomplete, and says why', () => {
    renderWizard()
    fireEvent.click(next())

    expect(shownStep()).toBe(1)
    const name = screen.getByLabelText(new RegExp(`^${m.reg_name()}`, 'i'))
    expect(name).toHaveAttribute('aria-invalid', 'true')
  })

  it('advances once the step is answered', () => {
    renderWizard({ initial: throughStep1(), initialStep: 0 })
    fireEvent.click(next())
    expect(shownStep()).toBe(2)
  })

  it('goes back without asking anything', () => {
    renderWizard({ initial: throughStep1(), initialStep: 0 })
    fireEvent.click(next())
    expect(shownStep()).toBe(2)

    fireEvent.click(back())
    expect(shownStep()).toBe(1)
  })

  it('tells the route where the reader went', () => {
    const { onStepChange } = renderWizard({ initial: throughStep1(), initialStep: 0 })
    fireEvent.click(next())
    expect(onStepChange).toHaveBeenCalledWith(1)
  })

  it('offers no way back from the first step', () => {
    renderWizard()
    expect(back()).toBeDisabled()
  })
})

/**
 * Scoped to the nav: step 1 renders the calendar, whose day buttons are named
 * "5", "6" and so on, and a bare number matches those too.
 */
function pill(n: number) {
  const nav = screen.getByRole('navigation', { name: m.reg_steps_label() })
  return within(nav).getByRole('button', { name: new RegExp(`\\b${n}\\b`) })
}

describe('the stepper', () => {
  it('will not jump to a step nobody has reached', () => {
    renderWizard()
    expect(pill(5)).toBeDisabled()
  })

  it('lets the reader back to a step they have already seen', () => {
    renderWizard({ initial: throughStep1(), initialStep: 0 })
    fireEvent.click(next())
    expect(shownStep()).toBe(2)

    fireEvent.click(pill(1))
    expect(shownStep()).toBe(1)
  })

  it('marks the step being read', () => {
    renderWizard()
    expect(pill(1)).toHaveAttribute('aria-current', 'step')
    expect(pill(2)).not.toHaveAttribute('aria-current')
  })
})

describe('submitting from the last step', () => {
  /**
   * The journey that gets there in spite of the gate: finish everything, go
   * back to an earlier step through the stepper, empty a field, and return to
   * the end — which is allowed, because that step has already been visited.
   * The failing input is then on a step that is not rendered.
   */
  it('goes to the step holding the problem instead of reporting it nowhere', async () => {
    const { onSubmit } = renderWizard({ initial: complete() })
    expect(shownStep()).toBe(8)

    fireEvent.click(pill(2))
    const school = screen.getByLabelText(new RegExp(`^${m.reg_school()}`, 'i'))
    fireEvent.change(school, { target: { value: '' } })

    fireEvent.click(pill(8))
    expect(shownStep()).toBe(8)

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })

    expect(onSubmit).not.toHaveBeenCalled()
    expect(shownStep()).toBe(2)
    expect(screen.getByLabelText(new RegExp(`^${m.reg_school()}`, 'i'))).toHaveFocus()
  })

  it('sends the registration when the last step is reached and everything holds', async () => {
    const { onSubmit } = renderWizard({ initial: complete() })
    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})

describe('once the window has closed', () => {
  it('locks every field on the step', () => {
    renderWizard({ initial: complete(), editable: false, initialStep: 0 })
    expect(screen.getByLabelText(new RegExp(`^${m.reg_name()}`, 'i'))).toBeDisabled()
  })

  it('drops the gate, because there is no longer an order to enforce', () => {
    renderWizard({ initial: complete(), editable: false, initialStep: 0 })
    expect(pill(6)).toBeEnabled()
  })

  /**
   * The stepper beside it already lets the reader past, so a "next" that
   * refused would be a door with no handle over a field they are no longer
   * allowed to fill in.
   */
  it('moves on without gating, since nothing can be fixed anyway', () => {
    renderWizard({ initial: emptyRegistration(), editable: false, initialStep: 0 })
    expect(shownStep()).toBe(1)
    fireEvent.click(next())
    expect(shownStep()).toBe(2)
  })

  it('opens wherever the URL asked, since there is nothing left to gate', () => {
    renderWizard({ initial: emptyRegistration(), editable: false, initialStep: 5 })
    expect(shownStep()).toBe(6)
  })

  it('will not submit', () => {
    renderWizard({ initial: complete(), editable: false })
    expect(screen.getByRole('button', { name: m.reg_submit() })).toBeDisabled()
  })
})
