import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import MediaGrid, { attachmentSummary, type AttachmentView } from '../../src/components/Pip/MediaGrid'

const three: AttachmentView[] = [
  { type: 'youtube', videoId: 'dQw4w9WgXcQ', unavailable: false },
  { type: 'youtube', videoId: 'xxxxxxxxxxx', unavailable: true },
  { type: 'image', url: 'https://files.example/hoja.png', name: 'Hoja de trabajo' },
]

describe('attachmentSummary', () => {
  it('counts videos and images, and says how many videos are gone', () => {
    expect(attachmentSummary(three)).toEqual([
      { glyph: '▶', text: `${m.pip_videos_n({ n: 2 })} ${m.pip_videos_unavailable({ n: 1 })}` },
      { glyph: '▣', text: m.pip_images_one() },
    ])
    expect(attachmentSummary([])).toEqual([])
  })
})

describe('MediaGrid', () => {
  it('draws one tile per attachment, the unavailable one as an error', () => {
    render(<MediaGrid attachments={three} />)
    // Three attachments render both the phone strip and the laptop grid in
    // the DOM at once (one hidden by CSS, not by absence), so each tile
    // appears twice: 3 attachments × 2 layouts = 6 buttons.
    expect(screen.getAllByRole('button', { name: /Abrir:|Open:/ })).toHaveLength(6)
    expect(screen.getAllByText(m.pip_video_unavailable())).toHaveLength(2)
    expect(screen.getAllByAltText('Hoja de trabajo')[0]).toHaveAttribute('src', 'https://files.example/hoja.png')
  })

  it('opens the lightbox on the tile pressed and moves with the arrows', () => {
    render(<MediaGrid attachments={three} />)
    fireEvent.click(screen.getAllByRole('button', { name: m.pip_open_attachment({ title: 'Hoja de trabajo' }) })[0])
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('open')
    expect(screen.getByText(m.pip_lightbox_of({ i: 3, n: 3 }))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: m.pip_lightbox_prev() }))
    expect(screen.getByText(m.pip_lightbox_of({ i: 2, n: 3 }))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: m.pip_lightbox_next() })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: m.pip_lightbox_close() }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('embeds a YouTube video in the lightbox and a stored video with a player', () => {
    render(<MediaGrid attachments={[three[0], { type: 'video', url: 'https://files.example/v.mp4', name: 'Renata se presenta' }]} />)
    fireEvent.click(screen.getAllByRole('button', { name: m.pip_open_attachment({ title: 'Renata se presenta' }) })[0])
    expect(document.querySelector('video')?.getAttribute('src')).toBe('https://files.example/v.mp4')
    fireEvent.click(screen.getByRole('button', { name: m.pip_lightbox_prev() }))
    expect(document.querySelector('iframe')?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('says a stored file is missing when its url is null', () => {
    render(<MediaGrid attachments={[{ type: 'image', url: null, name: 'Calendario' }]} />)
    expect(screen.getByText(m.pip_file_missing())).toBeInTheDocument()
  })
})
