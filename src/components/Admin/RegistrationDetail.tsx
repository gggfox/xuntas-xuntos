import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../../convex/_generated/api'
import * as m from '../../paraglide/messages.js'
import { SECTIONS_TOTAL } from '../../../convex/lib/decisionRules'
import ReadSection, { Field, Rows } from './ReadSection'
import { GuardianChip } from './StatusChip'

export type Detail = FunctionReturnType<typeof api.registrations.detail>

/**
 * Every section stacked on one page. Someone reading two hundred of these
 * should never click "next", and the letter is the thing being judged, so it
 * is printed whole.
 */
export default function RegistrationDetail({ detail }: { detail: Detail }) {
  const r = detail.registration
  const yes = m.detail_yes()
  const no = m.detail_no()
  // `undefined` here means the account predates the field that would have
  // answered this, not that the athlete is of age — an unknown must read as
  // unknown, never silently as the reassuring answer.
  const minorFlag = r.wasMinorAtCycleStart ?? detail.account.wasMinorAtSignup
  return (
    <article>
      <section className="card mb-[30px] px-[21px] py-[15px]">
        <p className="eyebrow">{m.detail_account()}</p>
        <dl className="mt-2 grid gap-3 sm:grid-cols-3">
          <Field label={m.detail_account_email()} value={detail.account.email} />
          <Field label={m.detail_birth()} value={detail.account.birthDate} />
          <Field
            label={m.detail_guardian()}
            value={
              <span className="flex flex-wrap items-center gap-2">
                <GuardianChip required={detail.guardian.required} confirmed={detail.guardian.confirmed} />
                {detail.guardian.required && (
                  <span className="text-[12px] text-soft">
                    {detail.guardian.guardianName
                      ? `${detail.guardian.guardianName} · ${detail.guardian.guardianEmail} · ${m.detail_guardian_sent({ n: detail.guardian.timesSent ?? 0 })}`
                      : m.detail_guardian_missing_cycle()}
                  </span>
                )}
              </span>
            }
          />
        </dl>
        <p className="mt-3 font-mono text-[11px] text-soft">
          {m.regs_col_sections()}: {m.regs_sections({ n: detail.sectionsComplete, total: SECTIONS_TOTAL })}
          {' · '}
          {minorFlag === undefined ? m.detail_age_unknown() : minorFlag ? m.detail_minor() : m.detail_adult()}
        </p>
      </section>

      <ReadSection n={1} title={m.reg_s1_title()}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label={m.reg_name()} value={r.personal.name} />
          <Field label={m.reg_email()} value={r.personal.email} />
          <Field label={m.reg_whatsapp()} value={r.personal.whatsapp} />
          <Field label={m.reg_birth_date()} value={r.personal.birthDate} />
          <Field label={m.reg_branch()} value={r.personal.branch === 'womens' ? m.reg_branch_womens() : r.personal.branch === 'mens' ? m.reg_branch_mens() : ''} />
          <Field label={m.reg_state()} value={r.personal.state} />
          <Field label={m.reg_city()} value={r.personal.city} />
        </dl>
      </ReadSection>

      <ReadSection n={2} title={m.reg_s2_title()}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label={m.reg_school()} value={r.academic.school} />
          <Field label={m.reg_grade()} value={r.academic.grade} />
          <Field label={m.reg_graduation()} value={r.academic.graduationYear} />
          <Field label={m.reg_interest()} value={r.academic.interest} />
        </dl>
      </ReadSection>

      <ReadSection n={3} title={m.reg_s3_title()}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label={m.reg_club()} value={r.athletic.club} />
          <Field label={m.reg_coach()} value={r.athletic.coach} />
          <Field label={m.reg_ghin()} value={r.athletic.ghin} />
          <Field label={m.reg_status()} value={r.athletic.amateurStatus ? m.reg_status_amateur() : m.reg_status_pro()} />
        </dl>
      </ReadSection>

      <ReadSection n={4} title={m.reg_s4_title()}>
        <Rows head={[m.reg_tournament_name(), m.reg_tournament_result()]} rows={r.results.map((x) => [x.tournament, x.result])} />
      </ReadSection>

      <ReadSection n={5} title={m.reg_s5_title()}>
        <Rows head={[m.reg_s5_title(), m.reg_ranking_position()]} rows={r.rankings.map((x) => [x.name, x.position])} />
      </ReadSection>

      <ReadSection n={6} title={m.reg_s6_title()}>
        <Rows head={[m.reg_event_name(), m.reg_event_date()]} rows={r.calendar.map((x) => [x.event, x.date])} />
      </ReadSection>

      <ReadSection n={7} title={m.reg_s7_title()}>
        <p className="max-w-[62ch] text-[14.5px] leading-relaxed font-light whitespace-pre-wrap">{r.motivationLetter || m.detail_empty()}</p>
      </ReadSection>

      <ReadSection n={8} title={m.reg_s8_title()}>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Field label={m.reg_ck_rules()} value={r.confirmations.rules ? yes : no} />
          <Field label={m.reg_ck_scholarship()} value={r.confirmations.scholarshipUnderstood ? yes : no} />
          <Field label={m.reg_ck_privacy()} value={r.confirmations.privacy ? yes : no} />
        </dl>
      </ReadSection>
    </article>
  )
}
