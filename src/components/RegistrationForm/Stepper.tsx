import * as m from '../../paraglide/messages.js'
import Icons from '../Icons'
import type { StepDef } from './steps'

/**
 * Where the reader is in the eight steps, and where they are allowed to go.
 *
 * The first pill is the account, and it is not a step: making one, confirming
 * an address and giving a date of birth all happened before this form opened,
 * and the panel will not render at all until they have. It is here because
 * the reader did that work and the form used to open as though they had not.
 * It is a `<span>` rather than a button on purpose — the account details are
 * already on the screen above, in `AccountStatus`, and a stop that showed
 * them a second time would be a stop worth nothing.
 *
 * The pills carry numbers, not titles: eight titles do not fit on one line at
 * any width worth designing for, and the step's own heading is directly
 * underneath saying `1 · Datos personales y de contacto` in full. The title
 * is in the accessible name of each pill, so it is never only visual.
 */
export default function Stepper({
  steps,
  current,
  reachable,
  errorSteps,
  doneSteps,
  onSelect,
}: {
  steps: readonly StepDef[]
  current: number
  /** The furthest step reached so far. Beyond it the gate has not been passed. */
  reachable: number
  errorSteps: ReadonlySet<number>
  doneSteps: ReadonlySet<number>
  onSelect: (step: number) => void
}) {
  return (
    <nav aria-label={m.reg_steps_label()} className="pb-3">
      <ol className="flex list-none flex-wrap items-center gap-1.5 p-0">
        <li>
          <span
            className="inline-flex h-[30px] items-center gap-1.5 rounded-full border border-ochre/35 bg-yel-s px-2.5 text-[11.5px] font-medium text-ochre"
            title={m.reg_step_account_sub()}
          >
            <Icons.Check />
            <span className="hidden sm:inline">{m.reg_step_account()}</span>
          </span>
        </li>

        {steps.map((step, i) => {
          const isCurrent = i === current
          const hasErrors = errorSteps.has(i)
          const isDone = doneSteps.has(i) && !isCurrent
          const canGo = i <= reachable

          const tone = isCurrent
            ? 'border-ink bg-ink text-paper'
            : hasErrors
              ? 'border-bad/50 bg-bad/5 text-bad'
              : isDone
                ? 'border-ochre/35 bg-yel-s text-ochre'
                : canGo
                  ? 'border-line bg-card text-soft'
                  : 'border-line bg-transparent text-soft/45'

          return (
            <li key={step.n}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                disabled={!canGo}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={m.reg_step_goto({ n: step.n, title: step.title() })}
                title={step.title()}
                className={`inline-flex h-[30px] min-w-[30px] items-center justify-center rounded-full border font-mono text-[12px] tabular-nums transition-colors duration-150 ${tone} ${
                  canGo ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                {isDone ? <Icons.Check /> : step.n}
                {/* Color alone must not be the difference between a step that
                    is done and one that is not, and neither must a tick that
                    a screen reader never reaches. */}
                <span className="sr-only">
                  {hasErrors
                    ? ` — ${m.reg_step_state_errors()}`
                    : isDone
                      ? ` — ${m.reg_step_state_done()}`
                      : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
