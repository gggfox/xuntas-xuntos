import { Show } from '@clerk/tanstack-react-start'
import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'
import EntryDialog from '../components/Journal/EntryDialog'
import GeneralStream from '../components/Journal/GeneralStream'
import JournalFeed from '../components/Journal/JournalFeed'
import { SignedOut } from './perfil'

/**
 * The athlete's bitácora. `?entrada=` is the entry a notification pointed
 * at: it leads the feed with its thread open.
 */
export const Route = createFileRoute('/bitacora')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.nav_journal() }) }] }),
  validateSearch: (s: Record<string, unknown>): { entrada?: string } =>
    typeof s.entrada === 'string' && /^[a-z0-9]{10,64}$/i.test(s.entrada) ? { entrada: s.entrada } : {},
  component: JournalPage,
})

function JournalPage() {
  return (
    <>
      <Show when="signed-out">
        <SignedOut />
      </Show>
      <Show when="signed-in">
        <Journal />
      </Show>
    </>
  )
}

function Journal() {
  const { entrada } = Route.useSearch()
  const profile = useQuery(api.members.myProfile)
  const create = useMutation(api.journal.createEntry)
  const [writing, setWriting] = useState(false)

  if (profile === undefined) {
    return (
      <main className="col pt-[38px] pb-[90px]">
        <p className="text-soft">{m.common_loading()}</p>
      </main>
    )
  }
  if (profile === null) return <Navigate to="/mi-registro" replace />

  const athleteUserId = profile.registration.userId
  return (
    <main className="col max-w-[1240px] pt-[38px] pb-[90px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{m.journal_eyebrow()}</p>
          <h1 className="h-display mt-1 text-[clamp(26px,4.6vw,36px)]">{m.journal_title()}</h1>
          <p className="mt-2 max-w-[62ch] font-light text-soft">{m.journal_intro()}</p>
        </div>
        {/* The screen's one solid yellow: writing is what this page is for. */}
        <button type="button" className="btn" onClick={() => setWriting(true)}>
          {m.journal_new_entry()}
        </button>
      </div>

      {/* The feed is the page; the team's words about the whole process sit
          beside it, where they stay in view while the entries scroll. Below
          `lg` the aside stacks under the feed. */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <JournalFeed athleteUserId={athleteUserId} canEdit focusEntryId={entrada} />
        <aside className="grid content-start gap-4 lg:sticky lg:top-6 lg:self-start">
          <GeneralStream athleteUserId={athleteUserId} />
        </aside>
      </div>

      {writing && <EntryDialog onSubmit={(input) => create(input)} onClose={() => setWriting(false)} />}
    </main>
  )
}
