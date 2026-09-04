import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import RegistrationForm from '../../src/components/RegistrationForm'
import { emptyRegistration } from '../../convex/lib/registrationSchema'
import { RESULTS_MIN } from '../../convex/lib/registrationRules'
import { FIXED_RANKINGS } from '../../convex/lib/registrationSchema'
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
    state: 'Nuevo León',
    city: 'Monterrey',
  })
}

function complete(): RegistrationData {
  const d = throughStep1()
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
      closesOnText="18 de septiembre de 2026"
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

  /**
   * The ticks used to be session memory: a reload, or a sent registration
   * reopened at the top, drew eight steps as though the form were untouched.
   */
  it('remembers what is filled in when the form is reopened at the top', () => {
    renderWizard({ initial: complete(), initialStep: 0 })
    expect(shownStep()).toBe(1)

    for (const n of [2, 5, 8]) {
      expect(pill(n)).toHaveTextContent(m.reg_step_state_done())
      expect(pill(n)).toBeEnabled()
    }
  })

  it('does not tick a step the draft has not got to yet', () => {
    renderWizard({ initial: throughStep1(), initialStep: 0 })
    expect(pill(1)).not.toHaveTextContent(m.reg_step_state_done())
    expect(pill(5)).not.toHaveTextContent(m.reg_step_state_done())
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

  /**
   * It used to follow the reader everywhere. On the old one-page form the
   * summary sat above every field it named; here it was a list of problems
   * with a step they had already left, on screen for the rest of the session.
   */
  it('stops showing the summary once the reader moves on', async () => {
    const broken = complete()
    broken.confirmations.privacy = false
    renderWizard({ initial: broken })

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(back())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  /** But it has to survive the jump it was drawn for. */
  it('keeps the summary when it is what sent the reader to another step', async () => {
    const broken = complete()
    broken.academic.school = ''
    renderWizard({ initial: broken, initialStep: 7, editable: false })

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })
    expect(shownStep()).toBe(2)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('sends the registration when the last step is reached and everything holds', async () => {
    const { onSubmit } = renderWizard({ initial: complete() })
    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})

/**
 * Steps 4 and 5 are the two whose rule is a count rather than a filled box,
 * and both used to let anyone through: results wanted one row, rankings
 * wanted nothing at all. Neither field has an id in `FIELD_IDS` — an array is
 * not one input — so the message under the rows is the only thing that says
 * what is wrong, which is what these check.
 */
describe('the counted steps', () => {
  /** `n` complete rows, and the blanks the form seeds left as they are. */
  function withResults(n: number) {
    const d = complete()
    d.results = d.results.map((_row, i) =>
      i < n ? { tournament: `Torneo ${i + 1}`, result: `${i + 1}º` } : { tournament: '', result: '' },
    )
    return d
  }

  function positions(...given: (string | undefined)[]) {
    const d = complete()
    d.rankings = FIXED_RANKINGS.map((name, i) => ({ name, position: given[i] ?? '' }))
    return d
  }

  const resultsError = () => m.reg_results_error({ n: RESULTS_MIN })

  it('opens the form on step 4 while it is a row short', () => {
    renderWizard({ initial: withResults(RESULTS_MIN - 1) })
    expect(shownStep()).toBe(4)
  })

  it('holds the reader on step 4 and says how many results are wanted', () => {
    renderWizard({ initial: withResults(RESULTS_MIN - 1) })
    fireEvent.click(next())

    expect(shownStep()).toBe(4)
    expect(screen.getByText(resultsError())).toBeInTheDocument()
  })

  it('lets the last row typed in be the one that opens the gate', () => {
    renderWizard({ initial: withResults(RESULTS_MIN - 1) })
    fireEvent.click(next())
    expect(shownStep()).toBe(4)

    const i = RESULTS_MIN
    fireEvent.change(screen.getByLabelText(`${m.reg_tournament_name()} ${i}`), {
      target: { value: 'Campestre invierno' },
    })
    const score = screen.getByLabelText(`${m.reg_tournament_result()} ${i}`)
    fireEvent.change(score, { target: { value: '2º' } })
    // Blur, not change: the form revalidates on blur until the first submit,
    // so that nobody is told they are wrong halfway through typing.
    fireEvent.blur(score)

    expect(screen.queryByText(resultsError())).not.toBeInTheDocument()
    fireEvent.click(next())
    expect(shownStep()).toBe(5)
  })

  /** Half a row is someone who started typing, not a result. */
  it('does not count a row with only a tournament on it', () => {
    renderWizard({ initial: withResults(RESULTS_MIN - 1) })
    fireEvent.change(screen.getByLabelText(`${m.reg_tournament_name()} ${RESULTS_MIN}`), {
      target: { value: 'Campestre invierno' },
    })
    fireEvent.click(next())

    expect(shownStep()).toBe(4)
    expect(screen.getByText(resultsError())).toBeInTheDocument()
  })

  it('holds the reader on step 5 until one ranking has a position', () => {
    renderWizard({ initial: positions() })
    expect(shownStep()).toBe(5)

    fireEvent.click(next())
    expect(shownStep()).toBe(5)
    expect(screen.getByText(m.reg_rankings_error())).toBeInTheDocument()
  })

  it('asks for one, not all four', () => {
    renderWizard({ initial: positions() })
    const position = screen.getByLabelText(`${m.reg_ranking_position()} ${FIXED_RANKINGS[1]}`)
    fireEvent.change(position, { target: { value: '41' } })
    fireEvent.blur(position)

    expect(screen.queryByText(m.reg_rankings_error())).not.toBeInTheDocument()
    fireEvent.click(next())
    expect(shownStep()).toBe(6)
  })

  /** Someone who appears only in a list XUNTAS does not name still qualifies. */
  it('takes the free-form row as an answer', () => {
    renderWizard({ initial: positions() })
    fireEvent.change(screen.getByLabelText(m.reg_ranking_other()), {
      target: { value: 'Ranking estatal' },
    })
    fireEvent.change(
      screen.getByLabelText(`${m.reg_ranking_position()} ${m.reg_ranking_other()}`),
      { target: { value: '3' } },
    )

    fireEvent.click(next())
    expect(shownStep()).toBe(6)
  })

  /** A closed window has nothing to gate, counted steps included. */
  it('lets both go once the window has closed', () => {
    renderWizard({ initial: withResults(0), editable: false, initialStep: 3 })
    fireEvent.click(next())
    expect(shownStep()).toBe(5)
    fireEvent.click(next())
    expect(shownStep()).toBe(6)
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

/**
 * The confirmations are cards you press, not boxes you tick. The input is
 * still a real checkbox underneath — `sr-only` rather than hidden, because a
 * hidden input cannot be focused and `focusFirst()` sends the reader to these
 * by id when a confirmation is what is missing.
 */
describe('the confirmation cards', () => {
  function goToConfirmations() {
    const d = complete()
    d.confirmations = { rules: false, scholarshipUnderstood: false, privacy: false }
    // With the confirmations unset, step 8 is where the form opens anyway.
    renderWizard({ initial: d })
  }

  it('keeps a real checkbox behind each card', () => {
    goToConfirmations()
    const box = document.getElementById('ck1') as HTMLInputElement
    expect(box).toBeInTheDocument()
    expect(box.type).toBe('checkbox')
  })

  /** `display:none` would break `focusFirst`, which targets these by id. */
  it('leaves that checkbox focusable', () => {
    goToConfirmations()
    const box = document.getElementById('ck1') as HTMLInputElement
    box.focus()
    expect(box).toHaveFocus()
  })

  it('ticks from a press on the card itself', () => {
    goToConfirmations()
    const box = document.getElementById('ck1') as HTMLInputElement
    expect(box.checked).toBe(false)

    fireEvent.click(screen.getByText(m.reg_ck_rules()))
    expect((document.getElementById('ck1') as HTMLInputElement).checked).toBe(true)
  })

  /** Opening the document must not count as accepting it. */
  it('does not tick when the document link is followed', () => {
    goToConfirmations()
    fireEvent.click(screen.getByRole('link', { name: m.rules_title() }))
    expect((document.getElementById('ck1') as HTMLInputElement).checked).toBe(false)
  })
})

/**
 * An error message used to render nothing at all when the field was fine, so
 * every message appearing pushed the rest of the form down. In the row of
 * confirmation cards it was worse: the message sat under each card, so a card
 * with a two-line message, one with a single line and one with none all came
 * out different heights.
 */
describe('an error does not move the page', () => {
  it('keeps the slot under a field that has nothing wrong with it', () => {
    renderWizard({ initial: emptyRegistration(), initialStep: 0 })
    const slot = document.getElementById('name-err')
    expect(slot).toBeInTheDocument()
    expect(slot).toHaveClass('min-h-[1.45em]')
    expect(slot?.textContent).toBe('')
  })

  it('leaves two lines under a confirmation, whose sentences wrap', () => {
    const d = complete()
    d.confirmations = { rules: false, scholarshipUnderstood: false, privacy: false }
    renderWizard({ initial: d })
    expect(document.getElementById('ck1-err')).toHaveClass('min-h-[2.9em]')
  })

  /** The three cards are one grid row, and a row is as tall as its tallest cell. */
  it('gives every confirmation the same slot whether or not it is wrong', () => {
    const d = complete()
    d.confirmations = { rules: false, scholarshipUnderstood: false, privacy: true }
    renderWizard({ initial: d })

    const slots = ['ck1-err', 'ck2-err', 'ck3-err'].map((id) => document.getElementById(id))
    expect(slots.every(Boolean)).toBe(true)
    for (const s of slots) expect(s).toHaveClass('min-h-[2.9em]')
  })
})

/**
 * The competitive calendar asks which month a tournament falls in, and for a
 * while it asked with a bare text box — so `10/2025`, `oct`, `otoño` and a
 * blank were all equally acceptable answers, and a month already past was as
 * easy to write as one ahead. It is a `MonthField` now: the same walk through
 * years and months as the date of birth, stopping a step early, in a popover
 * so the rows under it stay where the reader left them.
 */
describe('the competitive calendar rows', () => {
  /* Frozen so the range the picker offers does not depend on the day the
     suite runs: from this September, October is always a month ahead. */
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-15T18:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function goToCalendar(calendar: RegistrationData['calendar']) {
    const d = complete()
    d.calendar = calendar
    d.motivationLetter = ''
    // With the letter empty the form opens on step 7; the calendar is behind it.
    renderWizard({ initial: d })
    fireEvent.click(back())
    expect(shownStep()).toBe(6)
  }

  const dateBox = (n: number) => screen.getByLabelText(`${m.reg_event_date()} ${n}`)
  const openers = () => screen.getAllByRole('button', { name: m.date_open_months() })

  it('offers a month to pick rather than a box to type a date into', () => {
    goToCalendar([{ event: 'Campestre invierno', date: '' }])
    fireEvent.click(openers()[0])

    expect(screen.getByRole('button', { name: /^oct/i })).toBeInTheDocument()
    // The funnel stops at months: no day grid, so no cell named for a day.
    expect(screen.queryByRole('button', { name: '15' })).not.toBeInTheDocument()
  })

  it('writes the month into the row that was asked, and no other', () => {
    goToCalendar([
      { event: 'Campestre invierno', date: '' },
      { event: 'Nacional', date: '' },
    ])
    fireEvent.click(openers()[1])
    fireEvent.click(screen.getByRole('button', { name: /^oct/i }))

    expect(dateBox(2)).toHaveValue('10/2026')
    expect(dateBox(1)).toHaveValue('')
  })

  it('prints a month that came back from a draft', () => {
    goToCalendar([{ event: 'Nacional', date: '2027-03' }])
    expect(dateBox(1)).toHaveValue('03/2027')
  })

  it('refuses a month already behind the reader', () => {
    goToCalendar([{ event: 'Nacional', date: '' }])
    fireEvent.change(dateBox(1), { target: { value: '012026' } })

    expect(dateBox(1)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(m.date_month_past())).toBeInTheDocument()
  })

  /** The results rows share `DynamicRows`; their second column is prose. */
  it('leaves the results rows a plain pair of text boxes', () => {
    const d = complete()
    d.results = []
    renderWizard({ initial: d })
    expect(shownStep()).toBe(4)
    expect(screen.queryByRole('button', { name: m.date_open_months() })).not.toBeInTheDocument()
  })
})
