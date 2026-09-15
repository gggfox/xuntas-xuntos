import * as m from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { zoomLinkIn, type CommentsVisibility, type PostKind } from '../../../convex/lib/pipRules'
import Markdown from './Markdown'
import MediaGrid, { attachmentSummary, type AttachmentView } from './MediaGrid'
import PostThread from './PostThread'
import ReactionRow, { type Reaction } from './ReactionRow'

export type PostView = {
  _id: string
  kind: PostKind
  title: string
  body: string
  authorName: string
  publishedAt: number
  editedAt?: number
  commentsVisibility: CommentsVisibility
  attachments: AttachmentView[]
  reactions: Reaction[]
  commentCount: number
}

const KIND_GLYPH: Record<PostKind, string> = { content: '▶', session: '◉', challenge: '◆' }

export function kindLabel(kind: PostKind): string {
  return kind === 'content' ? m.pip_kind_content() : kind === 'session' ? m.pip_kind_session() : m.pip_kind_challenge()
}

/** "12 de septiembre", in the reader's locale. */
export function dayLabel(ms: number): string {
  return new Intl.DateTimeFormat(getLocale() === 'en' ? 'en' : 'es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' }).format(new Date(ms))
}

/** The body's prose, headings and marks dropped, for three lines of it. */
function excerpt(body: string): string {
  return body
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#') && !l.startsWith('|'))
    .join(' ')
    .replace(/[*_>`]|https?:\/\/\S+|\[([^\]]+)\]\([^)]+\)/g, '$1')
}

function ZoomCard({ href }: { href: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[9px] border border-line-2 bg-wash px-3 py-2">
      <span aria-hidden="true" className="inline-flex size-9 flex-none items-center justify-center rounded-full bg-[#2d8cff] text-[15px] text-white">▣</span>
      <div className="min-w-0 flex-1">
        <b className="block text-[13.5px] font-semibold">{m.pip_zoom()}</b>
        <span className="block truncate font-mono text-[11px] text-soft">{href}</span>
      </div>
      <a href={href} target="_blank" rel="noreferrer" className="btn btn-sm no-underline">{m.pip_zoom_enter()}</a>
    </div>
  )
}

type Props = {
  post: PostView
  open: boolean
  onToggle: () => void
}

/**
 * A post as a card that folds. Collapsed it shows the kind, the day, the
 * title, three lines of prose, what it carries, its reactions and the way
 * into its thread; open it shows everything. Reactions stay in view either
 * way: the row is the post's pulse. Prototype E, made real.
 */
export default function PostCard({ post, open, onToggle }: Props) {
  const zoom = zoomLinkIn(post.body)
  const off = post.commentsVisibility === 'off'
  const summary = attachmentSummary(post.attachments)
  const commentsLabel = off
    ? m.pip_comments_none()
    : post.commentsVisibility === 'lead'
      ? post.commentCount
        ? m.pip_comments_lead_n({ n: post.commentCount })
        : m.pip_comments_lead_none()
      : post.commentCount === 1
        ? m.pip_comments_one()
        : m.pip_comments_n({ n: post.commentCount })

  return (
    <article id={`post-${post._id}`} className={`card px-[18px] py-[15px] sm:px-[22px] sm:py-[17px] ${open ? 'border-ink' : ''}`}>
      <button type="button" className="grid w-full gap-1 text-left" aria-expanded={open} aria-label={open ? m.pip_collapse() : m.pip_expand()} onClick={onToggle}>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">
            <span aria-hidden="true" className="text-ochre">{KIND_GLYPH[post.kind]}</span>
            {kindLabel(post.kind)}
          </span>
          <span className="font-mono text-[10.5px] tracking-[.06em] text-soft">{dayLabel(post.publishedAt)}</span>
          {post.editedAt && <span className="font-mono text-[10.5px] tracking-[.06em] text-soft">· {m.pip_edited()}</span>}
          <span aria-hidden="true" className={`ml-auto text-soft transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
        </span>
        <span className="font-disp text-[17px] font-bold">{post.title}</span>
        {!open && <span className="line-clamp-3 text-[13.5px] leading-relaxed font-light text-soft">{excerpt(post.body)}</span>}
        {!open && summary.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {summary.map((x) => (
              <span key={x.text} className="inline-flex items-center gap-1.5 font-mono text-[10.5px] tracking-[.06em] text-soft">
                <span aria-hidden="true" className="text-ochre">{x.glyph}</span>
                {x.text}
              </span>
            ))}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3">
          <Markdown body={post.body} className="max-w-[62ch]" />
          {zoom && <div className="mt-4"><ZoomCard href={zoom} /></div>}
          {post.attachments.length > 0 && <div className="mt-4"><MediaGrid attachments={post.attachments} /></div>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ReactionRow targetKind="post" targetId={post._id} reactions={post.reactions} />
        {!open && (
          <button type="button" className="ml-auto font-mono text-[11px] tracking-[.06em] text-soft underline" onClick={onToggle}>
            {commentsLabel}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 border-t border-line pt-4">
          {/* A direct check on the property, not the `off` alias: TS narrows
              `post.commentsVisibility` to `'lead' | 'group'` in this branch
              only when the discriminant itself is the condition. */}
          {post.commentsVisibility === 'off' ? (
            <p className="text-[12.5px] text-soft">{m.pip_visibility_off()}</p>
          ) : (
            <PostThread postId={post._id} commentsVisibility={post.commentsVisibility} />
          )}
        </div>
      )}
    </article>
  )
}
