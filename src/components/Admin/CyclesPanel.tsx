import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import * as m from '../../paraglide/messages.js'
import CycleForm from './CycleForm'
import Pill from '../Pill'
import { useDateFormats } from '../DateField/format'
import { describeConvexError } from '../../lib/registrationErrors'

/**
 * Every call for applications: create one, edit its window, make one the
 * current call, and read the trail of who moved which date. `manage_cycles`
 * only — the route is what enforces that; this assumes it.
 */
export default function CyclesPanel() {
  const cycles = useQuery(api.cycles.list)
  const create = useMutation(api.cycles.create)
  const update = useMutation(api.cycles.update)
  const setActive = useMutation(api.cycles.setActive)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fmt = useDateFormats()

  if (cycles === undefined) return <p className="mt-8 text-soft">{m.common_loading()}</p>

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <h2 className="h-display text-[18px]">{m.cycles_title()}</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating((c) => !c)}>
          {m.cycles_new()}
        </button>
        {notice && <span className="text-[12.5px] text-soft">{notice}</span>}
      </div>

      {creating && (
        <CycleForm
          submitLabel={m.cycles_create()}
          onSubmit={async (input) => {
            await create(input)
            setNotice(m.cycles_created())
          }}
          onDone={() => setCreating(false)}
        />
      )}

      <ul className="mt-4 grid gap-3">
        {cycles.map((c) => (
          <li key={c.cycle} className="card px-[21px] py-[15px]">
            <div className="flex flex-wrap items-center gap-3">
              <b className="font-disp text-[15px]">{c.cycle}</b>
              {c.isActive && <Pill tone="brand">{m.cycles_active()}</Pill>}
              <span className="font-mono text-[11px] text-soft">
                {c.opensOn} → {c.closesOn} · {m.cycles_review()}: {c.reviewOn}
              </span>
              <span className="ml-auto flex gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(editing === c.cycle ? null : c.cycle)}>
                  {m.cycles_edit()}
                </button>
                {!c.isActive && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      try {
                        await setActive({ cycle: c.cycle })
                        setNotice(m.cycles_activated())
                      } catch (err) {
                        setNotice(describeConvexError(err))
                      }
                    }}
                  >
                    {m.cycles_activate()}
                  </button>
                )}
              </span>
            </div>
            {editing === c.cycle && (
              <>
                <CycleForm
                  initial={c}
                  lockName
                  submitLabel={m.cycles_save()}
                  onSubmit={async (input) => {
                    await update(input)
                    setNotice(m.cycles_saved())
                  }}
                  onDone={() => setEditing(null)}
                />
                <History cycle={c.cycle} format={(ms) => fmt.full.format(new Date(ms))} />
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

function History({ cycle, format }: { cycle: string; format: (ms: number) => string }) {
  const changes = useQuery(api.cycles.changes, { cycle })
  if (!changes) return null
  return (
    <div className="mt-4">
      <p className="eyebrow">{m.cycles_history()}</p>
      {changes.length === 0 && <p className="mt-1 text-[12.5px] text-soft">{m.cycles_history_none()}</p>}
      <ul className="mt-1 grid gap-1 font-mono text-[11px] text-soft">
        {changes.map((ch, i) => (
          <li key={i}>
            {m.cycles_changed_by({ name: ch.changedByName, when: format(ch.changedAt) })}
            {' · '}
            {ch.before ? `${ch.before.opensOn}→${ch.before.closesOn}${ch.before.isActive ? ' *' : ''}` : '—'}
            {' ⇒ '}
            {`${ch.after.opensOn}→${ch.after.closesOn}${ch.after.isActive ? ' *' : ''}`}
          </li>
        ))}
      </ul>
    </div>
  )
}
