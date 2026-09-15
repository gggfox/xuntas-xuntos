import { useEffect, useState, type ReactNode } from 'react'
import * as m from '../../paraglide/messages.js'
import { useModal } from '../../hooks/useModal'

/** Exactly what `api.pip.feed` returns per attachment. */
export type AttachmentView =
  | { type: 'image' | 'video'; url: string | null; name: string }
  | { type: 'youtube'; videoId: string; unavailable: boolean }

export function attachmentTitle(a: AttachmentView): string {
  return a.type === 'youtube' ? `YouTube · ${a.videoId}` : a.name
}

/** "2 videos (1 no disponible) · 1 imagen", for a collapsed row. */
export function attachmentSummary(list: AttachmentView[]): { glyph: string; text: string }[] {
  const videos = list.filter((a) => a.type !== 'image')
  const images = list.filter((a) => a.type === 'image')
  const broken = list.filter((a) => (a.type === 'youtube' && a.unavailable) || (a.type === 'video' && a.url === null)).length
  const out: { glyph: string; text: string }[] = []
  if (videos.length) {
    const n = videos.length === 1 ? m.pip_videos_one() : m.pip_videos_n({ n: videos.length })
    out.push({ glyph: '▶', text: broken ? `${n} ${m.pip_videos_unavailable({ n: broken })}` : n })
  }
  if (images.length) out.push({ glyph: '▣', text: images.length === 1 ? m.pip_images_one() : m.pip_images_n({ n: images.length }) })
  return out
}

const isBroken = (a: AttachmentView) => (a.type === 'youtube' ? a.unavailable : a.url === null)

/**
 * One attachment as a 16:9 tile with a caption under it. Every type is the
 * same box — an image is cropped to it, the error card fills it — so a row
 * of three lines up whatever they are. The tile is a button that opens the
 * lightbox.
 */
function Tile({ a, onOpen, strip = false }: { a: AttachmentView; onOpen: () => void; strip?: boolean }) {
  const box = strip ? 'w-[78%] flex-none snap-start sm:w-[340px]' : 'w-full'
  const tile =
    'relative block aspect-video w-full cursor-zoom-in overflow-hidden rounded-[9px] text-left focus-visible:shadow-[0_0_0_3px_var(--color-yel-ring)] focus-visible:outline-none'
  const title = attachmentTitle(a)
  let face: ReactNode
  let caption: ReactNode = title
  if (isBroken(a)) {
    face = (
      <span className="grid h-full content-center border border-bad-line bg-bad-wash px-4 py-3">
        <b className="block text-[13px] leading-tight font-semibold text-bad">{a.type === 'youtube' ? m.pip_video_unavailable() : m.pip_file_missing()}</b>
        {a.type === 'youtube' && <span className="mt-1 line-clamp-2 block text-[11.5px] leading-snug text-ink-3">{m.pip_video_unavailable_hint()}</span>}
      </span>
    )
    caption = <span className="text-soft line-through">{title}</span>
  } else if (a.type === 'image') {
    face = <img src={a.url ?? undefined} alt={a.name} className="h-full w-full object-cover" loading="lazy" />
  } else {
    face = (
      <span className="grid h-full place-items-center bg-ink text-paper">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-yel text-[22px] text-on-yel">▶</span>
        <span className="absolute top-2.5 left-3 rounded-full bg-white/15 px-2 py-0.5 font-mono text-[10px] tracking-[.08em] uppercase">
          {a.type === 'youtube' ? m.pip_youtube() : m.pip_video()}
        </span>
      </span>
    )
  }
  return (
    <figure className={`${box} m-0`}>
      <button type="button" className={`${tile} border border-line`} onClick={onOpen} aria-label={m.pip_open_attachment({ title })}>
        {face}
      </button>
      <figcaption className="mt-1.5 line-clamp-1 text-[13px] font-medium">{caption}</figcaption>
    </figure>
  )
}

/** The attachment, large, with the real player or embed. */
function Large({ a }: { a: AttachmentView }) {
  if (isBroken(a)) {
    return (
      <div className="grid h-full content-center justify-items-center gap-2 px-6 text-center">
        <b className="text-[17px] font-semibold text-bad">{a.type === 'youtube' ? m.pip_video_unavailable() : m.pip_file_missing()}</b>
        {a.type === 'youtube' && <span className="max-w-[48ch] text-[13.5px] text-paper/70">{m.pip_video_unavailable_hint()}</span>}
      </div>
    )
  }
  if (a.type === 'image') return <img src={a.url ?? undefined} alt={a.name} className="h-full w-full object-contain" />
  if (a.type === 'video') return <video src={a.url ?? undefined} controls className="h-full w-full" />
  // `a.type` is a union ('image' | 'video') on the first member and a lone
  // literal on the second, so TS can't narrow away that first member from
  // just the two checks above — an explicit positive check is needed here.
  if (a.type === 'youtube') {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${a.videoId}`}
        title={attachmentTitle(a)}
        className="h-full w-full"
        allow="accelerometer; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    )
  }
  return null
}

/**
 * A native dialog — the element the journal's entry dialog uses, so Escape
 * and the backdrop behave as the app's dialogs do. Arrows move between the
 * post's attachments; the strip under the stage jumps.
 */
function Lightbox({ attachments, index, onClose, onMove }: { attachments: AttachmentView[]; index: number; onClose: () => void; onMove: (i: number) => void }) {
  const { ref, close, dialogProps } = useModal(onClose)
  const a = attachments[index]
  useEffect(() => {
    const d = ref.current
    if (!d) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowLeft' && index > 0) onMove(index - 1)
      if (ev.key === 'ArrowRight' && index < attachments.length - 1) onMove(index + 1)
    }
    d.addEventListener('keydown', onKey)
    return () => d.removeEventListener('keydown', onKey)
  }, [ref, index, attachments.length, onMove])
  if (!a) return null
  return (
    <dialog
      {...dialogProps}
      className="m-auto w-[min(96vw,1100px)] rounded-[12px] border border-line bg-card p-0 text-ink shadow-[0_24px_64px_rgba(0,0,0,.5)] backdrop:bg-black/80"
    >
      <div className="grid gap-3 p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">{m.pip_lightbox_of({ i: index + 1, n: attachments.length })}</span>
          <b className="min-w-0 flex-1 truncate text-[14px] font-semibold">{attachmentTitle(a)}</b>
          <button type="button" className="btn btn-ghost btn-sm" onClick={close} aria-label={m.pip_lightbox_close()}>✕</button>
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-[9px] bg-ink">
          <Large a={a} />
          {index > 0 && (
            <button type="button" className="absolute top-1/2 left-2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-paper hover:bg-black/70" onClick={() => onMove(index - 1)} aria-label={m.pip_lightbox_prev()}>←</button>
          )}
          {index < attachments.length - 1 && (
            <button type="button" className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-paper hover:bg-black/70" onClick={() => onMove(index + 1)} aria-label={m.pip_lightbox_next()}>→</button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {attachments.map((x, i) => (
            <button
              key={i}
              type="button"
              className={`aspect-video w-[88px] flex-none overflow-hidden rounded-[6px] border-2 ${i === index ? 'border-yel' : 'border-transparent opacity-60 hover:opacity-100'}`}
              onClick={() => onMove(i)}
              aria-label={attachmentTitle(x)}
              aria-current={i === index}
            >
              {x.type === 'image' && x.url ? (
                <img src={x.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className={`grid h-full w-full place-items-center text-[12px] ${isBroken(x) ? 'bg-bad-wash text-bad' : 'bg-ink text-paper'}`}>{isBroken(x) ? '!' : '▶'}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </dialog>
  )
}

/**
 * The attachments of one post. One is full width; two sit side by side;
 * three or more make a grid on a laptop and a swipeable strip on a phone,
 * where a grid of thirds would shrink a video to a thumbnail. Owns the
 * lightbox.
 */
export default function MediaGrid({ attachments }: { attachments: AttachmentView[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const n = attachments.length
  if (n === 0) return null
  const tiles = (strip: boolean) => attachments.map((a, i) => <Tile key={i} a={a} strip={strip} onOpen={() => setOpen(i)} />)
  return (
    <>
      {n === 1 && tiles(false)}
      {n === 2 && <div className="grid gap-4 sm:grid-cols-2">{tiles(false)}</div>}
      {n >= 3 && (
        <>
          <div className="-mx-[18px] flex snap-x snap-mandatory gap-3 overflow-x-auto px-[18px] pb-1 md:hidden">{tiles(true)}</div>
          <div className="hidden gap-4 md:grid md:grid-cols-3">{tiles(false)}</div>
        </>
      )}
      {open !== null && <Lightbox attachments={attachments} index={open} onClose={() => setOpen(null)} onMove={setOpen} />}
    </>
  )
}
