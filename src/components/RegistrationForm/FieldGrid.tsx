/** Two columns on a wide screen, one on a narrow one. */
export default function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-[15px] sm:grid-cols-2">{children}</div>
}
