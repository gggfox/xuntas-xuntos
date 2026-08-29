import * as m from '../paraglide/messages.js'

type Props = {
  /** Prefixes the field ids so two of these can coexist on a page. */
  idPrefix: string
  name: string
  onNameChange: (value: string) => void
  email: string
  onEmailChange: (value: string) => void
  errors?: { name?: string; email?: string }
}

/**
 * The guardian block that appears once the declared birth date belongs to a
 * minor. Shown in `/empezar` and in the age-gate recovery of `/mi-registro`.
 *
 * Revealing it is the caller's job: this only renders the fields, so whoever
 * owns the date owns the decision to ask for a guardian.
 */
export default function GuardianFields({
  idPrefix,
  name,
  onNameChange,
  email,
  onEmailChange,
  errors,
}: Props) {
  const nameId = `${idPrefix}-name`
  const emailId = `${idPrefix}-email`

  return (
    <section className="nota mb-5">
      <b className="mb-1.5 block font-disp text-[14.5px]">{m.gate_minor_title()}</b>
      <p className="m-0 text-[13px] leading-relaxed font-light text-ink-3">{m.gate_minor_text()}</p>

      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor={nameId} className="text-[12.5px] font-medium">
          {m.gate_guardian_name()} <span className="text-bad">*</span>
        </label>
        <input
          id={nameId}
          className="fld-input"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          aria-invalid={Boolean(errors?.name)}
          autoComplete="off"
        />
        {errors?.name && <p className="text-[11.5px] text-bad">{errors.name}</p>}
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor={emailId} className="text-[12.5px] font-medium">
          {m.gate_guardian_email()} <span className="text-bad">*</span>
        </label>
        <input
          id={emailId}
          type="email"
          className="fld-input"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          aria-invalid={Boolean(errors?.email)}
          autoComplete="off"
        />
        <p className="text-[11.5px] text-soft">{m.gate_guardian_help()}</p>
        {errors?.email && <p className="text-[11.5px] text-bad">{errors.email}</p>}
      </div>
    </section>
  )
}
