import { useEffect, useRef, useState, type ReactNode } from 'react'
import Pill from '../../Pill'
import {
  KIND_LABEL,
  ME,
  MORE_EMOJI,
  QUICK_EMOJI,
  ZOOM_RE,
  timeLabel,
  type Attachment,
  type Comment,
  type Post,
} from './data'

/*
 * PROTOTYPE — throwaway. The pieces every variant needs and none should
 * disagree about: how markdown reads, what an attachment looks like, the
 * reaction row, the thread. Layout is the variants' business.
 *
 * Round two changed three shared things after the first judging: every
 * attachment — image, video, YouTube, and the "unavailable" error — is the
 * same 16:9 tile, so a row of them lines up; the bare "suggestion" emoji
 * with no count are gone (they read as reactions nobody had made); and the
 * picker is wider with more to pick from.
 */

export type Actions = {
  onReact: (postId: string, emoji: string) => void
  onComment: (postId: string, body: string, parentId?: string) => void
}

/* ---------- markdown, the subset the spec allows, rendered naively ---------- */

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)]+)/g

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) return <a key={i} href={link[2]} className="underline" target="_blank" rel="noreferrer">{link[1]}</a>
    if (/^https?:\/\//.test(part)) return <a key={i} href={part} className="break-all underline" target="_blank" rel="noreferrer">{part}</a>
    return <span key={i}>{part}</span>
  })
}

export function Md({ body, className = '' }: { body: string; className?: string }) {
  const lines = body.split('\n')
  const out: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (!l.trim()) { i++; continue }
    if (l.startsWith('## ')) { out.push(<h2 key={i} className="mt-5 font-disp text-[19px] font-bold first:mt-0">{inline(l.slice(3))}</h2>); i++; continue }
    if (l.startsWith('### ')) { out.push(<h3 key={i} className="mt-4 font-disp text-[16px] font-bold">{inline(l.slice(4))}</h3>); i++; continue }
    if (l.startsWith('> ')) {
      out.push(<blockquote key={i} className="my-3 border-l-2 border-yel-line pl-4 font-light text-ink-3 italic">{inline(l.slice(2))}</blockquote>); i++; continue
    }
    if (/^- /.test(l) || /^\d+\. /.test(l)) {
      const ordered = /^\d+\. /.test(l)
      const items: string[] = []
      while (i < lines.length && (/^- /.test(lines[i]) || /^\d+\. /.test(lines[i]))) { items.push(lines[i].replace(/^(- |\d+\. )/, '')); i++ }
      const cls = `my-3 grid gap-1 pl-5 ${ordered ? 'list-decimal' : 'list-disc'}`
      out.push(ordered ? <ol key={i} className={cls}>{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ol> : <ul key={i} className={cls}>{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ul>)
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(## |### |> |- |\d+\. )/.test(lines[i])) { para.push(lines[i]); i++ }
    out.push(<p key={i} className="my-3 first:mt-0 last:mb-0">{para.map((t, k) => <span key={k}>{k > 0 && <br />}{inline(t)}</span>)}</p>)
  }
  return <div className={`text-[14.5px] leading-relaxed font-light ${className}`}>{out}</div>
}

/* ---------- kind, zoom, attachments ---------- */

const KIND_GLYPH: Record<Post['kind'], string> = { content: '▶', session: '◉', challenge: '◆' }

export function KindMark({ kind, className = '' }: { kind: Post['kind']; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft ${className}`}>
      <span aria-hidden="true" className="text-ochre">{KIND_GLYPH[kind]}</span>
      {KIND_LABEL[kind]}
    </span>
  )
}

export function zoomLink(post: Post): string | null {
  return post.body.match(ZOOM_RE)?.[0] ?? null
}

export function ZoomCard({ href, compact = false }: { href: string; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-[9px] border border-line-2 bg-wash ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <span aria-hidden="true" className="inline-flex size-9 flex-none items-center justify-center rounded-full bg-[#2d8cff] text-[15px] text-white">▣</span>
      <div className="min-w-0 flex-1">
        <b className="block text-[13.5px] font-semibold">Sesión por Zoom</b>
        <span className="block truncate font-mono text-[11px] text-soft">{href}</span>
      </div>
      <a href={href} target="_blank" rel="noreferrer" className={`btn no-underline ${compact ? 'btn-sm' : ''}`}>Entrar a Zoom</a>
    </div>
  )
}

const gradient = (hue: number) => `linear-gradient(135deg, hsl(${hue} 60% 88%), hsl(${hue + 40} 50% 72%))`

export function attachmentTitle(a: Attachment): string {
  return a.type === 'youtube' ? a.title : a.label
}

/** "2 videos · 1 imagen", for a collapsed row. An unavailable video says so. */
export function attachmentSummary(list: Attachment[]): { glyph: string; text: string }[] {
  const videos = list.filter((a) => a.type !== 'image')
  const images = list.filter((a) => a.type === 'image')
  const broken = list.filter((a) => a.type === 'youtube' && a.unavailable).length
  const out: { glyph: string; text: string }[] = []
  if (videos.length) out.push({ glyph: '▶', text: `${videos.length} ${videos.length === 1 ? 'video' : 'videos'}${broken ? ` (${broken} no disponible)` : ''}` })
  if (images.length) out.push({ glyph: '▣', text: `${images.length} ${images.length === 1 ? 'imagen' : 'imágenes'}` })
  return out
}

/**
 * One attachment as a 16:9 tile with a caption under it. Every type is the
 * same box — an image is cropped to it, the error card fills it — so a row
 * of three lines up whatever they are.
 */
export function AttachmentBlock({ a, size = 'full', onOpen }: { a: Attachment; size?: 'full' | 'strip'; onOpen?: () => void }) {
  const box = size === 'strip' ? 'w-[78%] flex-none snap-start sm:w-[340px]' : 'w-full'
  const tile = `relative aspect-video w-full overflow-hidden rounded-[9px] ${onOpen ? 'cursor-zoom-in focus-visible:shadow-[0_0_0_3px_var(--color-yel-ring)] focus-visible:outline-none' : ''}`
  // A tile that opens is a button; one that does not is a plain box.
  const Tile = ({ className, style, children }: { className: string; style?: React.CSSProperties; children?: ReactNode }) =>
    onOpen ? (
      <button type="button" className={`${className} block text-left`} style={style} onClick={onOpen} aria-label={`Abrir: ${attachmentTitle(a)}`}>{children}</button>
    ) : (
      <div className={className} style={style}>{children}</div>
    )
  if (a.type === 'image') {
    return (
      <figure className={`${box} m-0`}>
        <Tile className={`${tile} border border-line`} style={{ background: gradient(a.hue) }} />
        <figcaption className="mt-1.5 line-clamp-1 text-[13px] font-medium">{a.label}</figcaption>
      </figure>
    )
  }
  if (a.type === 'youtube' && a.unavailable) {
    return (
      <figure className={`${box} m-0`}>
        <Tile className={`${tile} grid content-center border border-bad-line bg-bad-wash px-4 py-3`}>
          <b className="block text-[13px] leading-tight font-semibold text-bad">Video no disponible</b>
          <span className="mt-1 line-clamp-2 block text-[11.5px] leading-snug text-ink-3">YouTube lo marcó privado o lo eliminó. La encargada ve este aviso.</span>
        </Tile>
        <figcaption className="mt-1.5 line-clamp-1 text-[13px] font-medium text-soft line-through">{a.title}</figcaption>
      </figure>
    )
  }
  const title = a.type === 'youtube' ? a.title : a.label
  const badge = a.type === 'youtube' ? 'YouTube' : 'Video'
  return (
    <figure className={`${box} m-0`}>
      <Tile className={`${tile} grid place-items-center bg-ink text-paper`}>
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-yel text-[22px] text-on-yel">▶</span>
        <span className="absolute top-2.5 left-3 rounded-full bg-white/15 px-2 py-0.5 font-mono text-[10px] tracking-[.08em] uppercase">{badge}</span>
        <span className="absolute right-3 bottom-2.5 font-mono text-[11px] tabular-nums opacity-80">{a.duration}</span>
      </Tile>
      <figcaption className="mt-1.5 line-clamp-1 text-[13px] font-medium">{title}</figcaption>
    </figure>
  )
}

/**
 * The attachments of one post. One is full width; two sit side by side;
 * three or more make a grid on a laptop and a swipeable strip on a phone,
 * where a grid of thirds would shrink a video to a thumbnail.
 */
export function MediaGrid({ attachments, onOpen }: { attachments: Attachment[]; onOpen?: (index: number) => void }) {
  const n = attachments.length
  const open = (i: number) => (onOpen ? () => onOpen(i) : undefined)
  if (n === 0) return null
  if (n === 1) return <AttachmentBlock a={attachments[0]} onOpen={open(0)} />
  if (n === 2) return <div className="grid gap-4 sm:grid-cols-2">{attachments.map((a, i) => <AttachmentBlock key={i} a={a} onOpen={open(i)} />)}</div>
  return (
    <>
      <div className="-mx-[18px] flex snap-x snap-mandatory gap-3 overflow-x-auto px-[18px] pb-1 md:hidden">
        {attachments.map((a, i) => <AttachmentBlock key={i} a={a} size="strip" onOpen={open(i)} />)}
      </div>
      <div className="hidden gap-4 md:grid md:grid-cols-3">
        {attachments.map((a, i) => <AttachmentBlock key={i} a={a} onOpen={open(i)} />)}
      </div>
    </>
  )
}

/**
 * The attachment, large, in a native dialog — the same element the journal's
 * entry dialog uses, so Escape and the backdrop behave as the app's dialogs
 * do. Arrows move between a post's attachments.
 */
export function Lightbox({ attachments, index, onClose, onMove }: { attachments: Attachment[]; index: number; onClose: () => void; onMove: (i: number) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const a = attachments[index]
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (!d.open) d.showModal()
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowLeft' && index > 0) onMove(index - 1)
      if (ev.key === 'ArrowRight' && index < attachments.length - 1) onMove(index + 1)
    }
    d.addEventListener('keydown', onKey)
    return () => d.removeEventListener('keydown', onKey)
  }, [index, attachments.length, onMove])
  if (!a) return null
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="m-auto w-[min(96vw,1100px)] rounded-[12px] border border-line bg-card p-0 text-ink shadow-[0_24px_64px_rgba(0,0,0,.5)] backdrop:bg-black/80"
    >
      <div className="grid gap-3 p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">{index + 1} de {attachments.length}</span>
          <b className="min-w-0 flex-1 truncate text-[14px] font-semibold">{attachmentTitle(a)}</b>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-[9px] bg-ink">
          {a.type === 'image' && <div className="h-full w-full" style={{ background: gradient(a.hue) }} />}
          {a.type === 'youtube' && a.unavailable && (
            <div className="grid h-full content-center justify-items-center gap-2 px-6 text-center">
              <b className="text-[17px] font-semibold text-bad">Este video ya no está disponible</b>
              <span className="max-w-[48ch] text-[13.5px] text-paper/70">YouTube lo marcó como privado o lo eliminó. La encargada ve este mismo aviso en su lista y puede reemplazarlo.</span>
            </div>
          )}
          {((a.type === 'youtube' && !a.unavailable) || a.type === 'video') && (
            <div className="grid h-full place-items-center text-paper">
              <span aria-hidden="true" className="grid size-20 place-items-center rounded-full bg-yel text-[30px] text-on-yel">▶</span>
              <span className="absolute top-3 left-4 rounded-full bg-white/15 px-2.5 py-0.5 font-mono text-[10.5px] tracking-[.08em] uppercase">{a.type === 'youtube' ? 'YouTube · aquí iría el embed' : 'Video · aquí iría el reproductor'}</span>
              <span className="absolute right-4 bottom-3 font-mono text-[12px] tabular-nums opacity-80">{a.duration}</span>
            </div>
          )}
          {index > 0 && (
            <button type="button" className="absolute top-1/2 left-2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-paper hover:bg-black/70" onClick={() => onMove(index - 1)} aria-label="Anterior">←</button>
          )}
          {index < attachments.length - 1 && (
            <button type="button" className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-paper hover:bg-black/70" onClick={() => onMove(index + 1)} aria-label="Siguiente">→</button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {attachments.map((x, i) => (
            <button
              key={i}
              type="button"
              className={`aspect-video w-[88px] flex-none overflow-hidden rounded-[6px] border-2 ${i === index ? 'border-yel' : 'border-transparent opacity-60 hover:opacity-100'}`}
              style={x.type === 'image' ? { background: gradient(x.hue) } : undefined}
              onClick={() => onMove(i)}
              aria-label={attachmentTitle(x)}
              aria-current={i === index}
            >
              {x.type !== 'image' && <span className={`grid h-full w-full place-items-center text-[12px] ${x.type === 'youtube' && x.unavailable ? 'bg-bad-wash text-bad' : 'bg-ink text-paper'}`}>{x.type === 'youtube' && x.unavailable ? '!' : '▶'}</span>}
            </button>
          ))}
        </div>
      </div>
    </dialog>
  )
}

/* ---------- reactions ---------- */

export function ReactionRow({ post, onReact }: { post: Post; onReact: Actions['onReact'] }) {
  const [open, setOpen] = useState(false)
  const pick = (e: string) => { onReact(post.id, e); setOpen(false) }
  return (
    <div className="relative flex flex-wrap items-center gap-1.5">
      {post.reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          className="chip chip-toggle inline-flex items-center gap-1.5 tabular-nums"
          aria-pressed={r.mine}
          aria-label={`${r.emoji} ${r.count}${r.mine ? ', tuya' : ''}`}
          onClick={() => onReact(post.id, r.emoji)}
        >
          <span aria-hidden="true">{r.emoji}</span>
          {r.count}
        </button>
      ))}
      <button type="button" className="chip chip-more" aria-expanded={open} aria-label="Reaccionar" onClick={() => setOpen((o) => !o)}>
        {post.reactions.length === 0 ? '☺ Reaccionar' : '+'}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-2 w-[344px] max-w-[calc(100vw-44px)] rounded-[9px] border border-line bg-card p-3 shadow-[0_12px_32px_rgba(0,0,0,.18)]">
          <p className="mb-1.5 font-mono text-[10px] tracking-[.1em] uppercase text-soft">Recientes</p>
          <div className="flex gap-0.5">
            {QUICK_EMOJI.map((e) => (
              <button key={e} type="button" className="grid size-10 place-items-center rounded-[7px] text-[22px] hover:bg-wash" onClick={() => pick(e)}>{e}</button>
            ))}
          </div>
          <p className="mt-3 mb-1.5 font-mono text-[10px] tracking-[.1em] uppercase text-soft">Todas</p>
          <div className="grid max-h-[176px] grid-cols-8 gap-0.5 overflow-y-auto">
            {MORE_EMOJI.map((e) => (
              <button key={e} type="button" className="grid size-10 place-items-center rounded-[7px] text-[22px] hover:bg-wash" onClick={() => pick(e)}>{e}</button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-soft">Solo la encargada ve quién reaccionó.</p>
        </div>
      )}
    </div>
  )
}

/* ---------- thread ---------- */

function visibleComments(post: Post): Comment[] {
  if (post.commentsVisibility === 'off') return []
  if (post.commentsVisibility === 'group') return post.comments.filter((c) => !c.hidden || c.author === ME)
  return post.comments.filter((c) => c.author === ME)
}

export function VisibilityNote({ post }: { post: Post }) {
  if (post.commentsVisibility === 'off') return <Pill tone="neutral">Comentarios desactivados</Pill>
  return post.commentsVisibility === 'lead' ? (
    <Pill tone="brand">Solo lo lee la encargada</Pill>
  ) : (
    <Pill tone="neutral">Visible para tu grupo</Pill>
  )
}

/** The same fact as a line of text, for a thread header where a pill is one chip too many. */
export function visibilityLine(post: Post): string {
  if (post.commentsVisibility === 'off') return 'Renata desactivó los comentarios en esta publicación.'
  return post.commentsVisibility === 'lead' ? 'Lo que escribas aquí lo lee solo Renata.' : 'Lo que escribas aquí lo lee tu grupo.'
}

function Author({ c }: { c: Comment }) {
  return (
    <span className="group/author relative inline-flex items-center gap-1.5">
      <b className={`text-[13px] font-semibold ${c.inactive ? 'text-soft' : ''}`}>{c.author}</b>
      {c.lead && <Pill tone="brand">Encargada del PIP</Pill>}
      {c.inactive && (
        <>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-faint" />
          <span role="tooltip" className="pointer-events-none absolute top-full left-0 z-10 mt-1 hidden rounded-[7px] border border-line bg-card px-2 py-1 font-mono text-[10.5px] whitespace-nowrap text-soft shadow group-hover/author:block">
            Ya no forma parte del programa
          </span>
        </>
      )}
    </span>
  )
}

function Composer({ placeholder, onSend, primary = false, small = false }: { placeholder: string; onSend: (body: string) => void; primary?: boolean; small?: boolean }) {
  const [body, setBody] = useState('')
  return (
    <form
      className={small ? 'flex items-end gap-2' : 'grid gap-2'}
      onSubmit={(e) => { e.preventDefault(); if (!body.trim()) return; onSend(body.trim()); setBody('') }}
    >
      <textarea className={`fld-input resize-y ${small ? 'min-h-[42px] flex-1' : 'min-h-[72px]'}`} value={body} placeholder={placeholder} onChange={(e) => setBody(e.target.value)} />
      <div>
        <button type="submit" className={primary ? 'btn btn-sm' : 'btn btn-ghost btn-sm'}>Comentar</button>
      </div>
    </form>
  )
}

function CommentView({ c, post, onComment, depth = 0, replyingTo, setReplyingTo }: { c: Comment; post: Post; onComment: Actions['onComment']; depth?: number; replyingTo: string | null; setReplyingTo: (id: string | null) => void }) {
  // One reply box per thread: opening this one closes whichever was open.
  const replying = replyingTo === c.id
  const setReplying = (v: boolean) => setReplyingTo(v ? c.id : null)
  if (c.hidden) {
    return (
      <div className="rounded-[9px] border border-dashed border-line-2 px-3 py-2 text-[12.5px] text-soft">
        <Author c={c} /> · <span className="italic">Tu comentario fue ocultado por la encargada.</span>
      </div>
    )
  }
  return (
    <div className={depth ? 'ml-6 border-l border-line pl-4' : ''}>
      <div className="flex flex-wrap items-center gap-2">
        <Author c={c} />
        <span className="font-mono text-[10.5px] text-soft">{timeLabel(c.at)}</span>
        {c.visibility === 'lead' && post.commentsVisibility === 'group' && <span className="font-mono text-[10px] tracking-[.08em] uppercase text-soft">· escrito en privado</span>}
      </div>
      <Md body={c.body} className="mt-1" />
      {depth === 0 && (
        <div className="mt-1.5">
          <button type="button" className="font-mono text-[11px] tracking-[.06em] text-soft underline" onClick={() => setReplying(!replying)}>
            {replying ? 'Cancelar' : 'Responder'}
          </button>
        </div>
      )}
      {replying && (
        <div className="mt-2">
          <Composer small placeholder="Tu respuesta" onSend={(b) => { onComment(post.id, b, c.id); setReplying(false) }} />
        </div>
      )}
      {c.replies.length > 0 && (
        <div className="mt-3 grid gap-3">
          {c.replies.map((r) => <CommentView key={r.id} c={r} post={post} onComment={onComment} depth={depth + 1} replyingTo={replyingTo} setReplyingTo={setReplyingTo} />)}
        </div>
      )}
    </div>
  )
}

export function Thread({ post, onComment, composer = 'top', primary = false, limit }: { post: Post; onComment: Actions['onComment']; composer?: 'top' | 'bottom'; primary?: boolean; limit?: number }) {
  const [all, setAll] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  if (post.commentsVisibility === 'off') {
    return <p className="text-[12.5px] text-soft">{visibilityLine(post)}</p>
  }
  const list = visibleComments(post)
  const shown = limit && !all ? list.slice(-limit) : list
  const hiddenCount = list.length - shown.length
  const placeholder = post.commentsVisibility === 'lead' ? 'Escríbele a Renata. Nadie más lo lee.' : 'Comenta con tu grupo.'
  const box = <Composer placeholder={placeholder} onSend={(b) => onComment(post.id, b)} primary={primary} small={composer === 'bottom'} />
  return (
    <div className="grid gap-4">
      {composer === 'top' && box}
      {hiddenCount > 0 && (
        <button type="button" className="justify-self-start font-mono text-[11px] tracking-[.06em] text-soft underline" onClick={() => setAll(true)}>
          Ver {hiddenCount} comentarios anteriores
        </button>
      )}
      {shown.length === 0 && (
        <p className="text-[12.5px] text-soft">
          {post.commentsVisibility === 'lead' ? 'Todavía no le has escrito nada sobre esto.' : 'Nadie ha comentado todavía.'}
        </p>
      )}
      {shown.map((c) => <CommentView key={c.id} c={c} post={post} onComment={onComment} replyingTo={replyingTo} setReplyingTo={setReplyingTo} />)}
      {composer === 'bottom' && box}
    </div>
  )
}

export const commentsLabel = (n: number) => (n === 1 ? '1 comentario' : `${n} comentarios`)

export function countVisible(post: Post): number {
  return visibleComments(post).reduce((n, c) => n + 1 + c.replies.length, 0)
}
