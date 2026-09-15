import { useMutation, useQuery } from 'convex/react'
import { useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import * as m from '../../paraglide/messages.js'
import { PIP_COMMENT_LIMIT, validatePipComment } from '../../../convex/lib/pipRules'
import { describeConvexError, errorMessage } from '../../lib/registrationErrors'
import Pill from '../Pill'
import { useDateFormats } from '../DateField/format'
import Markdown from './Markdown'
import ReactionRow, { type Reaction } from './ReactionRow'

export type CommentView = {
  _id: string
  authorName: string
  isLead: boolean
  isMine: boolean
  inactive: boolean
  body: string
  createdAt: number
  visibility: 'lead' | 'group'
  hidden: boolean
  reactions: Reaction[]
  replies: CommentView[]
}

type Props = {
  postId: string
  commentsVisibility: 'lead' | 'group'
}

function Composer({ placeholder, onSend, small = false }: { placeholder: string; onSend: (body: string) => Promise<void>; small?: boolean }) {
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const boxId = useId()
  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const problem = validatePipComment(body)
    if (problem) {
      setError(errorMessage(problem))
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onSend(body.trim())
      setBody('')
    } catch (err) {
      setError(describeConvexError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} noValidate className={small ? 'flex items-end gap-2' : 'grid gap-1.5'}>
      <label htmlFor={boxId} className="sr-only">{m.pip_comment_label()}</label>
      <textarea
        id={boxId}
        className={`fld-input resize-y ${small ? 'min-h-[42px] flex-1' : 'min-h-[72px]'}`}
        value={body}
        maxLength={PIP_COMMENT_LIMIT}
        placeholder={placeholder}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-ghost btn-sm" disabled={busy}>
          {busy ? m.common_loading() : m.pip_comment_send()}
        </button>
        {error && <span className="text-[11.5px] text-bad">{error}</span>}
      </div>
    </form>
  )
}

function Author({ c }: { c: CommentView }) {
  return (
    <span className="group/author relative inline-flex items-center gap-1.5">
      <b className={`text-[13px] font-semibold ${c.inactive ? 'text-soft' : ''}`}>{c.authorName}</b>
      {c.isLead && <Pill tone="brand">{m.pip_lead_pill()}</Pill>}
      {c.inactive && (
        <>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-faint" />
          {/* Hover on a laptop, long press on a phone (the browser's own on a touch-held element). */}
          <span
            role="tooltip"
            className="pointer-events-none absolute top-full left-0 z-10 mt-1 rounded-[7px] border border-line bg-card px-2 py-1 font-mono text-[10.5px] whitespace-nowrap text-soft opacity-0 shadow group-hover/author:opacity-100 group-focus-within/author:opacity-100"
          >
            {m.pip_inactive_member()}
          </span>
        </>
      )}
    </span>
  )
}

type CommentProps = {
  c: CommentView
  postId: string
  postVisibility: 'lead' | 'group'
  depth: number
  canComment: boolean
  replyingTo: string | null
  setReplyingTo: (id: string | null) => void
  onSend: (body: string, parentId?: string) => Promise<void>
  onDelete: (id: string) => void
}

function Comment({ c, postId, postVisibility, depth, canComment, replyingTo, setReplyingTo, onSend, onDelete }: CommentProps) {
  const fmt = useDateFormats()
  if (c.hidden) {
    return (
      <div className="rounded-[9px] border border-dashed border-line-2 px-3 py-2 text-[12.5px] text-soft">
        <Author c={c} /> · <span className="italic">{m.pip_comment_hidden()}</span>
      </div>
    )
  }
  const replying = replyingTo === c._id
  const deletable = c.isMine && c.replies.length === 0 && c.reactions.length === 0
  return (
    <div className={depth ? 'ml-6 border-l border-line pl-4' : ''}>
      <div className="flex flex-wrap items-center gap-2">
        <Author c={c} />
        <span className="font-mono text-[10.5px] text-soft">{fmt.full.format(new Date(c.createdAt))}</span>
        {c.visibility === 'lead' && postVisibility === 'group' && (
          <span className="font-mono text-[10px] tracking-[.08em] uppercase text-soft">· {m.pip_written_private()}</span>
        )}
      </div>
      <Markdown body={c.body} inlineOnly className="mt-1" />
      {depth === 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <ReactionRow targetKind="comment" targetId={c._id} reactions={c.reactions} />
          {canComment && (
            <button type="button" className="font-mono text-[11px] tracking-[.06em] text-soft underline" onClick={() => setReplyingTo(replying ? null : c._id)}>
              {replying ? m.pip_reply_cancel() : m.pip_reply()}
            </button>
          )}
          {deletable && (
            <button type="button" className="font-mono text-[11px] tracking-[.06em] text-soft underline hover:text-bad" onClick={() => onDelete(c._id)}>
              {m.common_delete()}
            </button>
          )}
        </div>
      )}
      {depth > 0 && deletable && (
        <button type="button" className="mt-1 font-mono text-[11px] tracking-[.06em] text-soft underline hover:text-bad" onClick={() => onDelete(c._id)}>
          {m.common_delete()}
        </button>
      )}
      {replying && (
        <div className="mt-2">
          <Composer small placeholder={m.pip_reply_placeholder()} onSend={async (b) => { await onSend(b, c._id); setReplyingTo(null) }} />
        </div>
      )}
      {c.replies.length > 0 && (
        <div className="mt-3 grid gap-3">
          {c.replies.map((r) => (
            <Comment key={r._id} c={r} postId={postId} postVisibility={postVisibility} depth={depth + 1} canComment={canComment} replyingTo={replyingTo} setReplyingTo={setReplyingTo} onSend={onSend} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * A post's thread: who reads it, the box to add to it, the comments with
 * their replies. One reply box open at a time — opening another closes
 * the first. The server decides `canComment`; the box appears only where
 * a comment would be accepted.
 */
export default function PostThread({ postId, commentsVisibility }: Props) {
  const thread = useQuery(api.pip.comments, { postId: postId as Id<'pipPosts'> })
  const add = useMutation(api.pip.addComment)
  const remove = useMutation(api.pip.deleteComment)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const send = async (body: string, parentId?: string) => {
    await add(parentId ? { postId: postId as Id<'pipPosts'>, body, parentId: parentId as Id<'pipComments'> } : { postId: postId as Id<'pipPosts'>, body })
  }
  const del = (id: string) => {
    setDeleteError(null)
    remove({ id: id as Id<'pipComments'> }).catch((err) => setDeleteError(describeConvexError(err)))
  }

  if (thread === undefined) return <p className="text-[12.5px] text-soft">{m.common_loading()}</p>
  const note = commentsVisibility === 'lead' ? m.pip_visibility_lead() : m.pip_visibility_group()
  const placeholder = commentsVisibility === 'lead' ? m.pip_compose_lead() : m.pip_compose_group()
  return (
    <div className="grid gap-4">
      <p className="text-[12px] font-light text-soft">{note}</p>
      {deleteError && <span className="text-[11.5px] text-bad">{deleteError}</span>}
      {thread.canComment && <Composer placeholder={placeholder} onSend={(b) => send(b)} />}
      {thread.comments.length === 0 && (
        <p className="text-[12.5px] text-soft">{commentsVisibility === 'lead' ? m.pip_no_comments_lead() : m.pip_no_comments_group()}</p>
      )}
      {thread.comments.map((c) => (
        <Comment key={c._id} c={c} postId={postId} postVisibility={commentsVisibility} depth={0} canComment={thread.canComment} replyingTo={replyingTo} setReplyingTo={setReplyingTo} onSend={send} onDelete={del} />
      ))}
    </div>
  )
}
