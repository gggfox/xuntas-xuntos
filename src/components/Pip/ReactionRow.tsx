import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import * as m from '../../paraglide/messages.js'

export type Reaction = { emoji: string; count: number; mine: boolean }

/** The quick row before anyone has picked anything. */
export const QUICK_EMOJI = ['👍', '❤️', '💡', '🔥', '🙌'] as const

/** The library behind the plus. A curated set, not the whole of Unicode: the picker is one row of buttons, not a search engine. */
export const ALL_EMOJI = [
  '👍', '❤️', '💡', '🔥', '🙌', '😂', '😮', '😢', '👏', '🎯', '⛳', '💪', '🧠', '🌱', '✨', '🤝',
  '👀', '🫶', '😤', '🥲', '🙏', '🏌️', '🏆', '🌤️', '😴', '🫡', '🤯', '😌', '🥹', '💯', '🎉', '🍀',
  '📝', '⏱️', '🧘', '🤞', '😅', '🙂', '😍', '🤩', '😎', '🥳', '😇', '🤔', '😬', '🫠', '🤗', '👊',
] as const

const RECENT_KEY = 'pip.recentEmoji'
const RECENT_LIMIT = 5

/** Most recently used first, per device. The quick row fills the rest. Never throws: storage may be absent. */
export function recentEmoji(): string[] {
  let stored: string[] = []
  try {
    stored = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    stored = []
  }
  const out: string[] = []
  for (const e of [...stored, ...QUICK_EMOJI]) if (!out.includes(e)) out.push(e)
  return out.slice(0, RECENT_LIMIT)
}

export function rememberEmoji(emoji: string): void {
  const next = [emoji, ...recentEmoji().filter((e) => e !== emoji)].slice(0, RECENT_LIMIT)
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // A private window or blocked storage: the row just does not learn.
  }
}

type Props = {
  targetKind: 'post' | 'comment'
  targetId: string
  reactions: Reaction[]
}

/**
 * The reactions under a post or a top-level comment, and the way to add
 * one. Any emoji, several per member. Counts are everyone's; who reacted
 * is the lead's, which the picker says so nobody wonders.
 */
export default function ReactionRow({ targetKind, targetId, reactions }: Props) {
  const react = useMutation(api.pip.react)
  const [open, setOpen] = useState(false)
  const send = (emoji: string) => {
    void react({ targetKind, targetId: targetId as Id<'pipPosts'> | Id<'pipComments'>, emoji })
  }
  const pick = (emoji: string) => {
    rememberEmoji(emoji)
    send(emoji)
    setOpen(false)
  }
  return (
    <div className="relative flex flex-wrap items-center gap-1.5">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          className="chip chip-toggle inline-flex items-center gap-1.5 tabular-nums"
          aria-pressed={r.mine}
          aria-label={r.mine ? m.pip_reaction_mine({ emoji: r.emoji, n: r.count }) : m.pip_reaction({ emoji: r.emoji, n: r.count })}
          onClick={() => send(r.emoji)}
        >
          <span aria-hidden="true">{r.emoji}</span>
          {r.count}
        </button>
      ))}
      <button
        type="button"
        className="chip chip-more"
        aria-expanded={open}
        aria-label={reactions.length === 0 ? m.pip_react() : m.pip_react_more()}
        onClick={() => setOpen((o) => !o)}
      >
        {reactions.length === 0 ? `☺ ${m.pip_react()}` : '+'}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-2 w-[344px] max-w-[calc(100vw-44px)] rounded-[9px] border border-line bg-card p-3 shadow-[0_12px_32px_rgba(0,0,0,.18)]">
          <p className="mb-1.5 font-mono text-[10px] tracking-[.1em] uppercase text-soft">{m.pip_recent_emoji()}</p>
          <div className="flex gap-0.5">
            {recentEmoji().map((e) => (
              <button key={e} type="button" className="grid size-10 place-items-center rounded-[7px] text-[22px] hover:bg-wash" onClick={() => pick(e)} aria-label={e}>{e}</button>
            ))}
          </div>
          <p className="mt-3 mb-1.5 font-mono text-[10px] tracking-[.1em] uppercase text-soft">{m.pip_all_emoji()}</p>
          <div className="grid max-h-[176px] grid-cols-8 gap-0.5 overflow-y-auto">
            {ALL_EMOJI.map((e) => (
              <button key={e} type="button" className="grid size-10 place-items-center rounded-[7px] text-[22px] hover:bg-wash" onClick={() => pick(e)} aria-label={e}>{e}</button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-soft">{m.pip_only_lead_sees_who()}</p>
        </div>
      )}
    </div>
  )
}
