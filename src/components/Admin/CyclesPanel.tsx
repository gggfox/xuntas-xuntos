import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import * as m from '../../paraglide/messages.js'
import CycleForm from './CycleForm'
import Pill from '../Pill'
import { Bone, Loading } from '../Skeleton'
import { useDateFormats } from '../DateField/format'
import { describeConvexError } from '../../lib/registrationErrors'

/** What the strip under the heading reports: a confirmation or a failure. */
type Notice = { text: string; tone: 'ok' | 'bad' }

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
  const [editing, setEditing] = useState<Id<'cycles'> | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const fmt = useDateFormats()

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <h2 className="h-display text-[18px]">{m.cycles_title()}</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating((c) => !c)}>
          {m.cycles_new()}
        </button>
        {notice && (
          <span className={`text-[12.5px] ${notice.tone === 'bad' ? 'text-bad' : 'text-soft'}`}>{notice.text}</span>
        )}
      </div>

      {creating && (
        <CycleForm
          submitLabel={m.cycles_create()}
          onSubmit={async (input) => {
            await create(input)
            setNotice({ text: m.cycles_created(), tone: 'ok' })
          }}
          onDone={() => setCreating(false)}
        />
      )}

      {cycles === undefined ? (
        <Loading className="mt-4">
          <ul className="grid list-none gap-3 p-0" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="card flex items-center gap-3 px-[21px] py-[15px]">
                <Bone className="h-[15px] w-[180px]" />
                <Bone className="h-[9px] w-[260px]" />
                <Bone className="ml-auto h-[26px] w-[60px] rounded-[7px]" />
              </li>
            ))}
          </ul>
        </Loading>
      ) : (
        <ul className="mt-4 grid gap-3">
          {cycles.map((c) => (
            <li key={c._id} className="card px-[21px] py-[15px]">
              <div className="flex flex-wrap items-center gap-3">
                <b className="font-disp text-[15px]">{c.title}</b>
                {c.isActive && <Pill tone="ok">{m.cycles_active()}</Pill>}
                <span className="font-mono text-[11px] text-soft">
                  {c.opensOn} → {c.closesOn} · {m.cycles_review()}: {c.reviewOn}
                </span>
                <span className="ml-auto flex gap-2">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(editing === c._id ? null : c._id)}>
                    {m.cycles_edit()}
                  </button>
                  {!c.isActive && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        try {
                          await setActive({ cycle: c._id })
                          setNotice({ text: m.cycles_activated(), tone: 'ok' })
                        } catch (err) {
                          setNotice({ text: describeConvexError(err), tone: 'bad' })
                        }
                      }}
                    >
                      {m.cycles_activate()}
                    </button>
                  )}
                </span>
              </div>
              {editing === c._id && (
                <>
                  <CycleForm
                    initial={c}
                    submitLabel={m.cycles_save()}
                    onSubmit={async (input) => {
                      await update({ id: c._id, ...input })
                      setNotice({ text: m.cycles_saved(), tone: 'ok' })
                    }}
                    onDone={() => setEditing(null)}
                  />
                  <History cycle={c._id} format={(ms) => fmt.full.format(new Date(ms))} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function History({ cycle, format }: { cycle: Id<'cycles'>; format: (ms: number) => string }) {
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
