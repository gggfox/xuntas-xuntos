import type { ReactNode } from 'react'
import * as m from '../../paraglide/messages.js'
import Icons from '../Icons'
import FieldError from './FieldError'
import type { AppErrorCode } from '../../../convex/lib/errorCodes'

/**
 * One confirmation, as a card you press rather than a box you tick.
 *
 * The checkbox is still there and still a real `<input type="checkbox">` —
 * `sr-only`, not `display:none`, because a hidden input is unfocusable and
 * `focusFirst()` sends the reader to `#ck1`, `#ck2` and `#ck3` by id when a
 * confirmation is what is missing. Everything the reader sees is driven off
 * its `:checked` state through `group-has-[…]`, so there is no second copy of
 * the state to fall out of step with the first.
 *
 * Colour is not the only difference between accepted and not: the card also
 * gains a tick, and the icon and border change with it. A card that only
 * turned yellow would say nothing at all to a reader who cannot see yellow.
 */
export default function CheckboxField({
  id,
  title,
  sub,
  icon,
  checked,
  onChange,
  onBlur,
  error,
  doc,
}: {
  id: string
  title: string
  sub: string
  /** Drawn large in the card. One per confirmation, so they read apart at a glance. */
  icon: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  onBlur?: () => void
  error?: AppErrorCode
  /** Document this confirmation claims to accept. Linked at the foot of the card. */
  doc?: { path: string; ready: boolean; label: string }
}) {
  const errorId = `${id}-err`

  return (
    <div className="flex h-full flex-col">
      <label
        htmlFor={id}
        className={`group relative flex h-full cursor-pointer flex-col rounded-[9px] border bg-card p-4 transition-colors duration-150
          has-[:checked]:border-ochre/60 has-[:checked]:bg-yel-s
          has-[:focus-visible]:border-ink has-[:focus-visible]:shadow-[0_0_0_3px_rgba(237,244,95,0.5)]
          has-[:disabled]:cursor-default ${error ? 'border-bad/60 bg-bad/[0.03]' : 'border-line'}`}
      >
        <input
          id={id}
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />

        <span
          aria-hidden="true"
          className="mb-3 inline-flex size-9 flex-none items-center justify-center rounded-full border border-line bg-paper text-soft transition-colors duration-150 group-has-[:checked]:border-ochre/40 group-has-[:checked]:bg-card group-has-[:checked]:text-ochre"
        >
          {icon}
        </span>

        {/* The part that is not colour. Scales in rather than appearing, so
            pressing the card reads as the card answering. */}
        <span
          aria-hidden="true"
          className="absolute top-3.5 right-3.5 inline-flex size-[18px] scale-75 items-center justify-center rounded-full bg-ochre text-paper opacity-0 transition-[opacity,transform] duration-150 group-has-[:checked]:scale-100 group-has-[:checked]:opacity-100"
        >
          <Icons.Check />
        </span>

        <b className="block pr-6 text-[13.5px] font-semibold">{title}</b>
        <span className="mt-1 block text-[12.5px] leading-relaxed font-light text-soft">{sub}</span>

        {doc && (
          /* `mt-auto` is what makes the three cards line up: the links sit on
             one line across the row however tall each card's text runs. */
          <span className="mt-auto block pt-3 text-[12.5px]">
            {/*
              You cannot accept a document you cannot read. The link opens in
              another tab so nothing typed in gets lost, and `onClick` stops
              propagation so opening it does not tick the card.
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
      </label>
      <FieldError id={errorId} code={error} />
    </div>
  )
}
