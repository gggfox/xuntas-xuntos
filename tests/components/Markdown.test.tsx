import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Markdown from '../../src/components/Pip/Markdown'

describe('Markdown', () => {
  it('renders the allowed subset: headings, emphasis, lists, quotes, links, tables', () => {
    render(
      <Markdown
        body={'## Este mes\n\nQué **hacemos** con el *error*.\n\n- uno\n- dos\n\n> Una cita\n\n[Bases](https://example.com)\n\n| a | b |\n| - | - |\n| 1 | 2 |'}
      />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Este mes' })).toBeInTheDocument()
    expect(screen.getByText('hacemos').tagName).toBe('STRONG')
    expect(screen.getByText('error').tagName).toBe('EM')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Una cita').closest('blockquote')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Bases' })).toHaveAttribute('href', 'https://example.com')
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('renders raw HTML as text, never as markup', () => {
    render(<Markdown body={'Hola <script>alert(1)</script> <b>no</b>'} />)
    expect(document.querySelector('script')).toBeNull()
    expect(document.querySelector('b')).toBeNull()
    expect(screen.getByText(/alert\(1\)/)).toBeInTheDocument()
  })

  it('opens links in a new tab with no opener', () => {
    render(<Markdown body={'[x](https://example.com)'} />)
    const a = screen.getByRole('link', { name: 'x' })
    expect(a).toHaveAttribute('target', '_blank')
    expect(a).toHaveAttribute('rel', 'noreferrer')
  })

  it('drops headings and tables in inline-only mode, keeping emphasis and links', () => {
    render(<Markdown body={'## Título\n\n**fuerte** y [liga](https://example.com)\n\n| a |\n| - |\n| 1 |'} inlineOnly />)
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('Título')).toBeInTheDocument()
    expect(screen.getByText('fuerte').tagName).toBe('STRONG')
  })
})
