import * as m from '../../paraglide/messages.js'

/** One numbered section, read-only: the same heading pattern as the form's `FormSection`. */
export default function ReadSection({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-[30px]">
      <h2 className="mb-[9px] font-disp text-[17px] font-bold">
        {n} · {title}
      </h2>
      {children}
    </section>
  )
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="m-0 mt-0.5 text-[14px]">{value || m.detail_empty()}</dd>
    </div>
  )
}

export function Rows({ head, rows }: { head: [string, string]; rows: Array<[string, string]> }) {
  if (rows.length === 0) return <p className="text-[13px] text-soft">{m.detail_empty()}</p>
  return (
    <table className="w-full border-collapse text-[13.5px]">
      <thead>
        <tr className="border-b border-line">
          <th className="py-1 text-left font-mono text-[10.5px] font-medium tracking-[.12em] uppercase text-soft">{head[0]}</th>
          <th className="py-1 text-left font-mono text-[10.5px] font-medium tracking-[.12em] uppercase text-soft">{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([a, b], i) => (
          <tr key={i} className="border-b border-line last:border-0">
            <td className="py-1.5 pr-3">{a}</td>
            <td className="py-1.5 font-mono text-[12.5px]">{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
