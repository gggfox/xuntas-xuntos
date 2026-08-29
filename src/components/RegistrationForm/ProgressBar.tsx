import * as m from '../../paraglide/messages.js'

/**
 * The progress bar. It reports how much of the form has been answered, not how
 * much of it is valid — see `computeProgress`.
 *
 * Not sticky itself: it sits inside the form's sticky header, alongside the
 * stepper, and two independently pinned elements would stack.
 */
export default function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="py-3">
      <div className="flex items-center gap-3">
        <span className="eyebrow whitespace-nowrap">{m.reg_progress({ percent })}</span>
        <div
          className="h-[3px] flex-1 overflow-hidden rounded-sm bg-line"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={m.reg_progress({ percent })}
        >
          <i
            className="block h-full bg-yel transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  )
}
