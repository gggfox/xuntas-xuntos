/** One numbered section of the form. */
export default function FormSection({
  n,
  title,
  sub,
  children,
}: {
  n: number
  title: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="mb-[34px] scroll-mt-20 border-0 p-0">
      <legend className="mb-[3px] flex items-baseline gap-[9px] p-0 font-disp text-[18px] font-bold">
        {n} · {title}
      </legend>
      {sub && (
        <p className="mt-0 mb-[17px] max-w-[62ch] text-[13.5px] font-light text-soft">{sub}</p>
      )}
      {children}
    </fieldset>
  )
}
