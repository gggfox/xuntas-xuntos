import { useMemo, useState } from 'react'
import Pill from '../../Pill'
import { KIND_LABEL, LEAD, dayLabel, monthKey, monthTitle, timeLabel, type Post } from './data'
import { AttachmentBlock, KindMark, Lightbox, Md, MediaGrid, ReactionRow, Thread, VisibilityNote, ZoomCard, attachmentSummary, commentsLabel, countVisible, visibilityLine, zoomLink, type Actions } from './Shared'

/*
 * PROTOTYPE — throwaway. Three answers to "what does the member's PIP feed
 * look like?". They share the small parts in Shared.tsx and nothing else;
 * each is free to throw the layout out.
 */

type Props = Actions & { posts: Post[] }

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

function byMonth(posts: Post[]): [string, Post[]][] {
  const map = new Map<string, Post[]>()
  for (const p of posts) {
    const k = monthKey(p.publishedAt)
    map.set(k, [...(map.get(k) ?? []), p])
  }
  return [...map.entries()]
}

/* ============================ A · Boletín ============================ */

/** One reading column. A post is a letter; a month is a rule across the page. */
export function VariantA({ posts, onReact, onComment }: Props) {
  return (
    <main className="col col-720 pt-[38px] pb-[120px]">
      <p className="eyebrow">Programa Integral de Performance</p>
      <h1 className="h-display mt-1 text-[clamp(26px,4.6vw,36px)]">PIP</h1>
      <p className="mt-2 max-w-[62ch] font-light text-soft">
        Lo que Renata publica para ti: qué ver, qué probar, cuándo vernos. Lo que escribas debajo de un contenido lo lee solo ella, salvo que el reto diga lo contrario.
      </p>

      {byMonth(posts).map(([key, list]) => (
        <section key={key} className="mt-12">
          <h2 className="flex items-center gap-4 font-mono text-[11px] tracking-[.14em] uppercase text-soft">
            {monthTitle(key)}
            <span aria-hidden="true" className="h-px flex-1 bg-line" />
          </h2>
          {list.map((p) => <Letter key={p.id} post={p} onReact={onReact} onComment={onComment} />)}
        </section>
      ))}
    </main>
  )
}

function Letter({ post, onReact, onComment }: Actions & { post: Post }) {
  const [open, setOpen] = useState(false)
  const zoom = zoomLink(post)
  const n = countVisible(post)
  return (
    <article className="mt-9 first:mt-7">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <KindMark kind={post.kind} />
        <span className="font-mono text-[10.5px] tracking-[.06em] text-soft">{dayLabel(post.publishedAt)}</span>
        {post.editedAt && <span className="font-mono text-[10.5px] tracking-[.06em] text-soft">· editado</span>}
      </div>
      <h3 className="mt-2 font-disp text-[clamp(20px,3vw,26px)] leading-tight font-bold tracking-[-.015em]">{post.title}</h3>
      <Md body={post.body} className="mt-4 max-w-[62ch]" />
      {zoom && <div className="mt-4"><ZoomCard href={zoom} /></div>}
      {post.attachments.length > 0 && (
        <div className="mt-5 grid gap-5">
          {post.attachments.map((a, i) => <AttachmentBlock key={i} a={a} />)}
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <ReactionRow post={post} onReact={onReact} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {post.commentsVisibility === 'lead' ? (n ? `Tu conversación con Renata · ${n}` : 'Escríbele a Renata') : `${n} comentarios`}
        </button>
        <VisibilityNote post={post} />
      </div>
      {open && <div className="mt-4"><Thread post={post} onComment={onComment} /></div>}
    </article>
  )
}

/* ============================ B · Programa ============================ */

type KindFilter = 'all' | Post['kind']

/** A month rail and kind filters on the left; the newest post is the hero. */
export function VariantB({ posts, onReact, onComment }: Props) {
  const months = byMonth(posts)
  const [month, setMonth] = useState<string>('all')
  const [kind, setKind] = useState<KindFilter>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const filtered = useMemo(
    () => posts.filter((p) => (month === 'all' || monthKey(p.publishedAt) === month) && (kind === 'all' || p.kind === kind)),
    [posts, month, kind],
  )
  const [hero, ...rest] = filtered

  return (
    <main className="col max-w-[1240px] pt-[38px] pb-[120px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Programa Integral de Performance</p>
          <h1 className="h-display mt-1 text-[clamp(26px,4.6vw,36px)]">PIP</h1>
        </div>
        <span className="font-mono text-[11px] tracking-[.08em] uppercase text-soft">{filtered.length} publicaciones</span>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="grid content-start gap-6 lg:sticky lg:top-6 lg:self-start">
          <nav aria-label="Meses">
            <p className="mb-2 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">Meses</p>
            <ul className="m-0 grid list-none gap-1 p-0">
              <li>
                <button type="button" className={`w-full rounded-[7px] px-3 py-2 text-left text-[13.5px] ${month === 'all' ? 'bg-ink text-paper' : 'hover:bg-wash'}`} onClick={() => setMonth('all')}>
                  Todo
                </button>
              </li>
              {months.map(([k, list]) => (
                <li key={k}>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between rounded-[7px] px-3 py-2 text-left text-[13.5px] capitalize ${month === k ? 'bg-ink text-paper' : 'hover:bg-wash'}`}
                    onClick={() => setMonth(k)}
                  >
                    {monthTitle(k)}
                    <span className="font-mono text-[11px] tabular-nums opacity-70">{list.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="mb-2 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">Tipo</p>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'content', 'session', 'challenge'] as const).map((k) => (
                <button key={k} type="button" className="chip chip-toggle" aria-pressed={kind === k} onClick={() => setKind(k)}>
                  {k === 'all' ? 'Todo' : KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[12px] leading-relaxed text-soft">
            Lo que escribas bajo un contenido lo lee solo Renata. Un reto marcado <em>visible para tu grupo</em> lo leen todas.
          </p>
        </aside>

        <div className="grid content-start gap-4">
          {hero && <Hero post={hero} onReact={onReact} onComment={onComment} />}
          {rest.map((p) => (
            <Row key={p.id} post={p} open={openId === p.id} onToggle={() => setOpenId((id) => (id === p.id ? null : p.id))} onReact={onReact} onComment={onComment} />
          ))}
          {filtered.length === 0 && <p className="text-soft">Nada con ese filtro.</p>}
        </div>
      </div>
    </main>
  )
}

function Hero({ post, onReact, onComment }: Actions & { post: Post }) {
  const zoom = zoomLink(post)
  const media = post.attachments
  return (
    <article className="rounded-[12px] border border-ochre/35 bg-yel-s p-6 lg:p-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Pill tone="brand">Lo más reciente</Pill>
        <KindMark kind={post.kind} />
        <span className="font-mono text-[10.5px] tracking-[.06em] text-soft">{dayLabel(post.publishedAt)}</span>
      </div>
      <h2 className="mt-3 font-disp text-[clamp(22px,3.4vw,30px)] leading-tight font-bold tracking-[-.02em]">{post.title}</h2>
      <div className={`mt-4 grid gap-6 ${media.length ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
        <div>
          <Md body={post.body} className="max-w-[60ch]" />
          {zoom && <div className="mt-4"><ZoomCard href={zoom} /></div>}
        </div>
        {media.length > 0 && (
          <div className="grid content-start gap-4">
            {media.map((a, i) => <AttachmentBlock key={i} a={a} />)}
          </div>
        )}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ochre/25 pt-4">
        <ReactionRow post={post} onReact={onReact} />
        <VisibilityNote post={post} />
      </div>
      <div className="mt-5"><Thread post={post} onComment={onComment} primary /></div>
    </article>
  )
}

function Row({ post, open, onToggle, onReact, onComment }: Actions & { post: Post; open: boolean; onToggle: () => void }) {
  const zoom = zoomLink(post)
  const excerpt = post.body.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.replace(/[*>]/g, '') ?? ''
  const n = countVisible(post)
  return (
    <article className={`card px-[21px] py-[17px] ${open ? 'border-ink' : ''}`}>
      <button type="button" className="grid w-full gap-1 text-left" aria-expanded={open} onClick={onToggle}>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <KindMark kind={post.kind} />
          <span className="font-mono text-[10.5px] tracking-[.06em] text-soft">{dayLabel(post.publishedAt)}</span>
          {post.attachments.length > 0 && <span className="font-mono text-[10.5px] text-soft">· {post.attachments.length} adjuntos</span>}
        </span>
        <span className="font-disp text-[17px] font-bold">{post.title}</span>
        {!open && <span className="line-clamp-1 text-[13.5px] font-light text-soft">{excerpt}</span>}
        <span className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[11px] text-soft">
          <span>{post.reactions.reduce((s, r) => s + r.count, 0)} reacciones</span>
          <span>{n} comentarios</span>
        </span>
      </button>
      {open && (
        <div className="mt-4 border-t border-line pt-4">
          <Md body={post.body} className="max-w-[62ch]" />
          {zoom && <div className="mt-4"><ZoomCard href={zoom} compact /></div>}
          {post.attachments.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {post.attachments.map((a, i) => <AttachmentBlock key={i} a={a} />)}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <ReactionRow post={post} onReact={onReact} />
            <VisibilityNote post={post} />
          </div>
          <div className="mt-4"><Thread post={post} onComment={onComment} /></div>
        </div>
      )}
    </article>
  )
}

/* ========================== C · Conversación ========================== */

/** A timeline with the lead's face. Media as a strip, reactions always in view, the thread inline. */
export function VariantC({ posts, onReact, onComment }: Props) {
  const session = posts.find((p) => p.kind === 'session')
  const zoom = session ? zoomLink(session) : null
  return (
    <main className="col col-720 pt-[30px] pb-[120px]">
      <div className="flex items-center gap-4">
        <Face big />
        <div>
          <p className="eyebrow">Programa Integral de Performance</p>
          <h1 className="h-display mt-0.5 text-[clamp(22px,4vw,30px)]">{LEAD}</h1>
          <p className="mt-0.5 text-[13px] font-light text-soft">Encargada del PIP · te escribe una o dos veces por semana</p>
        </div>
      </div>

      {session && (
        <div className="sticky top-[62px] z-30 mt-6 -mx-[22px] border-y border-line bg-paper/95 px-[22px] py-2.5 backdrop-blur">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-mono text-[10.5px] tracking-[.12em] uppercase text-ochre">Próxima sesión</span>
            <span className="text-[13px]">{session.title} · jueves 17 · tu grupo 17:00 h</span>
            {zoom && <a href={zoom} target="_blank" rel="noreferrer" className="btn btn-sm ml-auto no-underline">Entrar a Zoom</a>}
          </div>
        </div>
      )}

      <ol className="relative m-0 mt-8 grid list-none gap-8 p-0 before:absolute before:top-2 before:bottom-2 before:left-[19px] before:w-px before:bg-line">
        {posts.map((p, i) => {
          const prev = posts[i - 1]
          const newMonth = !prev || monthKey(prev.publishedAt) !== monthKey(p.publishedAt)
          return (
            <li key={p.id} className="grid gap-3">
              {newMonth && (
                <span className="relative z-10 ml-[6px] w-fit rounded-full border border-line bg-paper px-2.5 py-0.5 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">
                  {monthTitle(monthKey(p.publishedAt))}
                </span>
              )}
              <Message post={p} onReact={onReact} onComment={onComment} />
            </li>
          )
        })}
      </ol>
    </main>
  )
}

function Face({ big = false }: { big?: boolean }) {
  return (
    <span aria-hidden="true" className={`relative z-10 grid flex-none place-items-center rounded-full bg-ink font-disp font-bold text-paper ${big ? 'size-14 text-[18px]' : 'size-10 text-[13px]'}`}>
      RF
    </span>
  )
}

function Message({ post, onReact, onComment }: Actions & { post: Post }) {
  const zoom = zoomLink(post)
  return (
    <article className="grid grid-cols-[40px_minmax(0,1fr)] gap-3">
      <Face />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <b className="text-[13.5px] font-semibold">Renata</b>
          <span className="font-mono text-[10.5px] text-soft">{timeLabel(post.publishedAt)}</span>
          <KindMark kind={post.kind} className="ml-auto" />
        </div>
        <div className="card mt-1.5 px-[18px] py-[15px]">
          <h2 className="font-disp text-[17px] font-bold">{post.title}</h2>
          <Md body={post.body} className="mt-2" />
          {post.editedAt && <p className="mt-2 font-mono text-[10.5px] text-soft">editado</p>}
          {zoom && <div className="mt-3"><ZoomCard href={zoom} compact /></div>}
        </div>
        {post.attachments.length > 0 && (
          <div className="-mr-[22px] mt-3 flex gap-3 overflow-x-auto pr-[22px] pb-1">
            {post.attachments.map((a, i) => <AttachmentBlock key={i} a={a} size="strip" />)}
          </div>
        )}
        <div className="mt-3"><ReactionRow post={post} onReact={onReact} /></div>
        <div className="mt-3 rounded-[9px] bg-wash px-4 py-3">
          <div className="mb-3"><VisibilityNote post={post} /></div>
          <Thread post={post} onComment={onComment} composer="bottom" limit={2} />
        </div>
      </div>
    </article>
  )
}

/* ============================ D · Tarjeta ============================ */

/**
 * Round two. One card holds everything a post is — body, media, reactions,
 * thread — so nothing floats. On a laptop the cards hang off C's timeline
 * with Renata's face; on a phone they stack. Media is a uniform 16:9 grid.
 * The visibility of the thread is a line inside it, not a pill beside the
 * reactions. No sticky strip: the next session is a chip in the header.
 */
export function VariantD({ posts, onReact, onComment }: Props) {
  const session = posts.find((p) => p.kind === 'session')
  return (
    <main className="col col-720 pt-[38px] pb-[120px] lg:max-w-[880px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Programa Integral de Performance</p>
          <h1 className="h-display mt-1 text-[clamp(26px,4.6vw,36px)]">PIP</h1>
          <p className="mt-2 max-w-[62ch] font-light text-soft">Lo que Renata publica para ti: qué ver, qué probar, cuándo vernos.</p>
        </div>
        {session && (
          <a href={`#post-${session.id}`} className="chip chip-y no-underline">
            Próxima sesión · jueves 17 · 17:00 h
          </a>
        )}
      </div>

      <ol className="relative m-0 mt-8 grid list-none gap-7 p-0 lg:before:absolute lg:before:top-2 lg:before:bottom-2 lg:before:left-[19px] lg:before:w-px lg:before:bg-line">
        {posts.map((p, i) => {
          const prev = posts[i - 1]
          const newMonth = !prev || monthKey(prev.publishedAt) !== monthKey(p.publishedAt)
          return (
            <li key={p.id} className="grid gap-4">
              {newMonth && (
                <h2 className="relative z-10 flex items-center gap-4 font-mono text-[11px] tracking-[.14em] uppercase text-soft lg:ml-[52px]">
                  <span className="lg:rounded-full lg:border lg:border-line lg:bg-paper lg:px-2.5 lg:py-0.5 lg:-ml-[54px]">{monthTitle(monthKey(p.publishedAt))}</span>
                  <span aria-hidden="true" className="h-px flex-1 bg-line lg:hidden" />
                </h2>
              )}
              <CardPost post={p} onReact={onReact} onComment={onComment} />
            </li>
          )
        })}
      </ol>
    </main>
  )
}

function CardPost({ post, onReact, onComment }: Actions & { post: Post }) {
  const zoom = zoomLink(post)
  const n = countVisible(post)
  const off = post.commentsVisibility === 'off'
  return (
    <article id={`post-${post.id}`} className="grid gap-3 lg:grid-cols-[40px_minmax(0,1fr)]">
      <span aria-hidden="true" className="relative z-10 hidden size-10 place-items-center rounded-full bg-ink font-disp text-[13px] font-bold text-paper lg:grid">RF</span>
      <div className="card px-[18px] py-[16px] sm:px-[22px] sm:py-[19px]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <KindMark kind={post.kind} />
          <span className="font-mono text-[10.5px] tracking-[.06em] text-soft">{dayLabel(post.publishedAt)}</span>
          {post.editedAt && <span className="font-mono text-[10.5px] tracking-[.06em] text-soft">· editado</span>}
        </div>
        <h3 className="mt-2 font-disp text-[clamp(18px,2.6vw,22px)] leading-tight font-bold tracking-[-.015em]">{post.title}</h3>
        <Md body={post.body} className="mt-3 max-w-[62ch]" />
        {zoom && <div className="mt-4"><ZoomCard href={zoom} /></div>}
        {post.attachments.length > 0 && <div className="mt-4"><MediaGrid attachments={post.attachments} /></div>}

        <div className="mt-4 border-t border-line pt-3">
          <ReactionRow post={post} onReact={onReact} />
        </div>

        <details className="group/thread mt-3 border-t border-line pt-3" open={post.kind === 'challenge' && post.commentsVisibility === 'group'}>
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden">
            <span className="font-mono text-[11px] tracking-[.06em] text-ink">
              {off ? 'Comentarios desactivados' : post.commentsVisibility === 'lead' ? (n ? `Tu conversación con Renata · ${n}` : 'Escríbele a Renata') : `${n} comentarios`}
            </span>
            <span className="text-[12px] font-light text-soft">{visibilityLine(post)}</span>
            {!off && <span aria-hidden="true" className="ml-auto text-soft transition-transform group-open/thread:rotate-180">⌄</span>}
          </summary>
          {!off && <div className="mt-4"><Thread post={post} onComment={onComment} composer="bottom" /></div>}
        </details>
      </div>
    </article>
  )
}

/* =========================== E · Programa 2 =========================== */

/**
 * Round two. B without the rail: a slim toolbar with a month select and
 * the kind chips, so twenty months cost no more room than two. Collapsed
 * rows keep their reactions. Media is the same uniform grid as D.
 *
 * Round three, after E won: the toolbar no longer floats — it sits under
 * the title and scrolls away, since a translucent bar over the cards read
 * as a glitch on both sizes. A collapsed row shows three lines of text and
 * says what it carries ("2 videos · 1 imagen"). An attachment opens in a
 * lightbox with arrows between the post's attachments. One reply box per
 * thread.
 */
export function VariantE({ posts, onReact, onComment }: Props) {
  const months = byMonth(posts)
  const [month, setMonth] = useState<string>('all')
  const [kind, setKind] = useState<KindFilter>('all')
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set([posts[0]?.id]))

  const filtered = useMemo(
    () => posts.filter((p) => (month === 'all' || monthKey(p.publishedAt) === month) && (kind === 'all' || p.kind === kind)),
    [posts, month, kind],
  )
  const toggle = (id: string) =>
    setOpenIds((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next })

  return (
    <main className="col col-720 pt-[38px] pb-[120px] lg:max-w-[880px]">
      <p className="eyebrow">Programa Integral de Performance</p>
      <h1 className="h-display mt-1 text-[clamp(26px,4.6vw,36px)]">PIP</h1>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-y border-line py-2.5">
        <label className="sr-only" htmlFor="pip-month">Mes</label>
        <select id="pip-month" className="fld-input h-[34px] w-auto py-0 pr-8 text-[13px]" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">Todos los meses</option>
          {months.map(([k, list]) => (
            <option key={k} value={k}>{cap(monthTitle(k))} · {list.length}</option>
          ))}
        </select>
        <div className="flex gap-1.5 overflow-x-auto">
          {(['all', 'content', 'session', 'challenge'] as const).map((k) => (
            <button key={k} type="button" className="chip chip-toggle flex-none" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k === 'all' ? 'Todo' : KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-[10.5px] tracking-[.08em] uppercase text-soft">{filtered.length}</span>
      </div>

      <div className="mt-6 grid gap-3">
        {filtered.map((p, i) => {
          const prev = filtered[i - 1]
          const newMonth = month === 'all' && (!prev || monthKey(prev.publishedAt) !== monthKey(p.publishedAt))
          return (
            <div key={p.id} className="grid gap-3">
              {newMonth && (
                <h2 className="mt-3 flex items-center gap-4 font-mono text-[11px] tracking-[.14em] uppercase text-soft first:mt-0">
                  {monthTitle(monthKey(p.publishedAt))}
                  <span aria-hidden="true" className="h-px flex-1 bg-line" />
                </h2>
              )}
              <FoldRow post={p} open={openIds.has(p.id)} onToggle={() => toggle(p.id)} onReact={onReact} onComment={onComment} />
            </div>
          )
        })}
        {filtered.length === 0 && <p className="text-soft">Nada con ese filtro.</p>}
      </div>
    </main>
  )
}

function FoldRow({ post, open, onToggle, onReact, onComment }: Actions & { post: Post; open: boolean; onToggle: () => void }) {
  const zoom = zoomLink(post)
  // The body's prose, headings dropped, markdown marks stripped — three lines of it.
  const excerpt = post.body.split('\n').filter((l) => l.trim() && !l.startsWith('#')).join(' ').replace(/[*>]|https?:\/\/\S+/g, '')
  const n = countVisible(post)
  const off = post.commentsVisibility === 'off'
  const [lightbox, setLightbox] = useState<number | null>(null)
  const summary = attachmentSummary(post.attachments)
  return (
    <article className={`card px-[18px] py-[15px] sm:px-[22px] sm:py-[17px] ${open ? 'border-ink' : ''}`}>
      <button type="button" className="grid w-full gap-1 text-left" aria-expanded={open} onClick={onToggle}>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <KindMark kind={post.kind} />
          <span className="font-mono text-[10.5px] tracking-[.06em] text-soft">{dayLabel(post.publishedAt)}</span>
          {post.editedAt && <span className="font-mono text-[10.5px] tracking-[.06em] text-soft">· editado</span>}
          <span aria-hidden="true" className={`ml-auto text-soft transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
        </span>
        <span className="font-disp text-[17px] font-bold">{post.title}</span>
        {!open && <span className="line-clamp-3 text-[13.5px] leading-relaxed font-light text-soft">{excerpt}</span>}
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
          <Md body={post.body} className="max-w-[62ch]" />
          {zoom && <div className="mt-4"><ZoomCard href={zoom} compact /></div>}
          {post.attachments.length > 0 && <div className="mt-4"><MediaGrid attachments={post.attachments} onOpen={setLightbox} /></div>}
        </div>
      )}
      {lightbox !== null && (
        <Lightbox attachments={post.attachments} index={lightbox} onClose={() => setLightbox(null)} onMove={setLightbox} />
      )}

      {/* Reactions stay in view collapsed or not: the row is the post's pulse. */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ReactionRow post={post} onReact={onReact} />
        {!open && (
          <button type="button" className="ml-auto font-mono text-[11px] tracking-[.06em] text-soft underline" onClick={onToggle}>
            {off ? 'Sin comentarios' : post.commentsVisibility === 'lead' ? (n ? `Con Renata · ${n}` : 'Escríbele a Renata') : commentsLabel(n)}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-3 text-[12px] font-light text-soft">{visibilityLine(post)}</p>
          <Thread post={post} onComment={onComment} />
        </div>
      )}
    </article>
  )
}
