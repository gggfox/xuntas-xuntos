import type { Ref } from 'react'

/**
 * One numbered section of the form, which in the wizard is one step.
 *
 * `disabled` rides on the `<fieldset>` itself: a closed window or an already
 * reviewed registration makes every control inside read-only natively, with
 * no `disabled` prop threaded through six field wrappers to drift out of sync.
 *
 * `headingRef` is where focus lands when the step changes. The legend, not a
 * heading element: it is already the accessible name of the group the reader
 * has just been moved into, so focusing it says both what this step is and
 * that they are now inside it.
 */
export default function FormSection({
  n,
  title,
  sub,
  headingRef,
  disabled,
  children,
}: {
  n: number
  title: string
  sub?: string
  headingRef?: Ref<HTMLLegendElement>
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <fieldset disabled={disabled} className="mb-[34px] scroll-mt-32 border-0 p-0">
      <legend
        ref={headingRef}
        tabIndex={headingRef ? -1 : undefined}
        /* The scroll margin belongs here, not on the fieldset: focus moves to
           the legend on a step change and `scrollIntoView` is called on it, so
           the offset that clears the sticky header has to be its own. */
        className="mb-[3px] flex scroll-mt-28 items-baseline gap-[9px] p-0 font-disp text-[18px] font-bold outline-none"
      >
        {n} · {title}
      </legend>
      {sub && (
        <p className="mt-0 mb-[17px] max-w-[62ch] text-[13.5px] font-light text-soft">{sub}</p>
      )}
      {children}
    </fieldset>
  )
}
