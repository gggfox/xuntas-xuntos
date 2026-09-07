import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import * as m from '../paraglide/messages.js'
import { canSeeAthletes } from '../components/Admin/AdminShell'
import NoTools from '../components/Admin/NoTools'
import { Field } from '../components/Admin/ReadSection'
import RegistrationSections from '../components/Admin/RegistrationSections'
import GeneralStream from '../components/Journal/GeneralStream'
import JournalFeed from '../components/Journal/JournalFeed'
import TeamCard from '../components/Journal/TeamCard'
import { useMe } from '../hooks/useMe'
import { can } from '../lib/permissions'
import { describeConvexError } from '../lib/registrationErrors'

/**
 * One member, for the people who work with them: the team's general
 * comments, then the bitácora with its threads, and the record beside it.
 * The underscore un-nests this from the list, like `registros_/$id`.
 * `?entrada=` is the entry a notification pointed at.
 */
export const Route = createFileRoute('/administracion/atletas_/$id')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.admin_nav_athletes() }) }] }),
  validateSearch: (s: Record<string, unknown>): { entrada?: string } =>
    typeof s.entrada === 'string' && /^[a-z0-9]{10,64}$/i.test(s.entrada) ? { entrada: s.entrada } : {},
  errorComponent: ({ error }) => <p className="mt-8 text-[13px] text-bad">{describeConvexError(error)}</p>,
  component: AthletePage,
})

function AthletePage() {
  const { id } = Route.useParams()
  const { entrada } = Route.useSearch()
  const me = useMe()
  const athleteUserId = id as Id<'users'>
  const detail = useQuery(api.members.detail, me && canSeeAthletes(me.roles) ? { athleteUserId } : 'skip')

  if (!me) return null
  if (!canSeeAthletes(me.roles)) return <NoTools />
  if (detail === undefined) return <p className="mt-8 text-soft">{m.common_loading()}</p>

  const r = detail.registration
  return (
    <>
      <Link to="/administracion/atletas" className="mt-6 inline-block text-[13px] text-soft no-underline hover:text-ink">
        ← {m.athlete_back()}
      </Link>
      <h2 className="h-display mt-3 text-[clamp(22px,3.6vw,30px)]">{r.personal.name || detail.account.email}</h2>
      {detail.frozen && <p className="nota mt-4 max-w-[62ch]">{m.athlete_frozen()}</p>}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-6">
          <GeneralStream athleteUserId={athleteUserId} composerPrimary />
          <JournalFeed athleteUserId={athleteUserId} canEdit={false} focusEntryId={entrada} composerPrimary />
        </div>
        <div className="grid content-start gap-4">
          {can(me.roles, 'view_all_athletes') && <TeamCard team={detail.team} />}
          <section className="card px-[21px] py-[19px]">
            <p className="eyebrow">{m.athlete_profile_title()}</p>
            <dl className="mt-2 grid gap-3">
              <Field label={m.reg_branch()} value={r.personal.branch === 'womens' ? m.reg_branch_womens() : m.reg_branch_mens()} />
              <Field label={m.reg_city()} value={`${r.personal.city}, ${r.personal.state}`} />
              <Field label={m.reg_club()} value={r.athletic.club} />
              <Field label={m.reg_coach()} value={r.athletic.coach} />
              <Field label={m.reg_ghin()} value={r.athletic.ghin} />
              <Field label={m.reg_school()} value={r.academic.school} />
            </dl>
          </section>
        </div>
      </div>

      <details className="mt-8">
        <summary className="cursor-pointer font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">
          {m.athlete_profile_full()}
        </summary>
        <div className="mt-4 max-w-[900px]">
          <RegistrationSections registration={r} />
        </div>
      </details>
    </>
  )
}
