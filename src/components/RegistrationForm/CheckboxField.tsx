import * as m from '../../paraglide/messages.js'
import FieldError from './FieldError'
import type { AppErrorCode } from '../../../convex/lib/errorCodes'

export default function CheckboxField({
  id,
  title,
  sub,
  checked,
  onChange,
  onBlur,
  error,
  doc,
}: {
  id: string
  title: string
  sub: string
  checked: boolean
  onChange: (v: boolean) => void
  onBlur?: () => void
  error?: AppErrorCode
  /** Document this checkbox claims to accept. It is linked next to the text. */
  doc?: { path: string; ready: boolean; label: string }
}) {
  const errorId = `${id}-err`

  return (
    <div className="mb-3">
      <label
        htmlFor={id}
        className={`flex cursor-pointer gap-3 rounded-[9px] border bg-card px-4 py-3.5 ${
          error ? 'border-bad/60' : 'border-line'
        }`}
      >
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 size-4 flex-none accent-ochre"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        <span>
          <b className="block text-[13.5px] font-semibold">{title}</b>
          <span className="mt-1 block text-[12.5px] leading-relaxed font-light text-soft">
            {sub}
          </span>
          {doc && (
            <span className="mt-1.5 block text-[12.5px]">
              {/*
                You cannot accept a document you cannot read. The link opens
                in another tab so nothing typed in gets lost, and `onClick`
                stops propagation so opening it does not tick the checkbox.
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
        </span>
      </label>
      <FieldError id={errorId} code={error} />
    </div>
  )
}
