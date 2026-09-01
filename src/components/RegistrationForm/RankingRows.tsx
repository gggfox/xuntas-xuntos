import * as m from '../../paraglide/messages.js'
import { FIXED_RANKINGS } from '../../lib/registrationSchema'

export type Ranking = { name: string; position: string }

/**
 * The four rankings XUNTAS follows, plus one free-form row.
 *
 * The fixed names are not editable — they are the list, not an answer — so
 * their inputs are read-only and out of the tab order. Only the positions and
 * the last row's name are typed into.
 */
export default function RankingRows({
  rankings,
  onChange,
  onBlur,
}: {
  rankings: Ranking[]
  onChange: (index: number, value: Ranking) => void
  onBlur?: () => void
}) {
  const otherIndex = FIXED_RANKINGS.length
  const other = rankings[otherIndex]

  return (
    <>
      {FIXED_RANKINGS.map((name, i) => (
        <div key={name} className="mb-[9px] grid grid-cols-[1fr_128px] gap-[10px]">
          <input className="fld-input bg-paper text-soft" value={name} readOnly tabIndex={-1} />
          <input
            className="fld-input"
            aria-label={`${m.reg_ranking_position()} ${name}`}
            placeholder={m.reg_ranking_position()}
            value={rankings[i]?.position ?? ''}
            onChange={(e) => onChange(i, { name, position: e.target.value })}
            onBlur={onBlur}
          />
        </div>
      ))}
      <div className="mb-[9px] grid grid-cols-[1fr_128px] gap-[10px]">
        <input
          className="fld-input"
          placeholder={m.reg_ranking_other()}
          aria-label={m.reg_ranking_other()}
          value={other?.name ?? ''}
          onChange={(e) => onChange(otherIndex, { name: e.target.value, position: other?.position ?? '' })}
          onBlur={onBlur}
        />
        <input
          className="fld-input"
          aria-label={`${m.reg_ranking_position()} ${m.reg_ranking_other()}`}
          placeholder={m.reg_ranking_position()}
          value={other?.position ?? ''}
          onChange={(e) => onChange(otherIndex, { name: other?.name ?? '', position: e.target.value })}
          onBlur={onBlur}
        />
      </div>
    </>
  )
}
