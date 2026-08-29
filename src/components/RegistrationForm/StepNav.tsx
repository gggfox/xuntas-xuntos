import * as m from '../../paraglide/messages.js'
import Icons from '../Icons'

/**
 * Back, next, and — on the last step — submit.
 *
 * "Next" is never disabled. A disabled button says nothing about why, and it
 * cannot be focused to be asked: pressing it and being shown what is missing
 * is the interaction that actually tells the reader something.
 */
export default function StepNav({
  step,
  total,
  isLast,
  editable,
  isSubmitting,
  alreadySubmitted,
  onBack,
  onNext,
}: {
  step: number
  total: number
  isLast: boolean
  editable: boolean
  isSubmitting: boolean
  alreadySubmitted: boolean
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="mt-9 flex flex-wrap items-center gap-3 border-t border-line pt-6">
      <button
        type="button"
        className="btn-ghost inline-flex items-center gap-1.5"
        onClick={onBack}
        disabled={step === 0}
      >
        <Icons.Chevron dir="left" />
        {m.reg_step_prev()}
      </button>

      {isLast ? (
        <button type="submit" className="btn" disabled={!editable || isSubmitting}>
          {isSubmitting
            ? m.common_loading()
            : alreadySubmitted
              ? m.reg_save_changes()
              : m.reg_submit()}
        </button>
      ) : (
        <button type="button" className="btn inline-flex items-center gap-1.5" onClick={onNext}>
          {m.reg_step_next()}
          <Icons.Chevron dir="right" />
        </button>
      )}

      <span className="eyebrow ml-auto whitespace-nowrap">
        {m.reg_step_of({ n: step + 1, total })}
      </span>
    </div>
  )
}
