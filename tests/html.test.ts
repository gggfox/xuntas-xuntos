import { describe, expect, it } from 'vitest'
import { escapeHtml, isValidEmail, textForEmail } from '../convex/lib/html'

describe('escapeHtml', () => {
  it('neutralizes markup', () => {
    expect(escapeHtml('<b>hola</b>')).toBe('&lt;b&gt;hola&lt;/b&gt;')
  })

  it('escapes quotes and ampersand', () => {
    expect(escapeHtml(`" & '`)).toBe('&quot; &amp; &#39;')
  })

  it('escapes the ampersand first, with no double escaping', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })

  /**
   * The concrete regression: the athlete's name was interpolated raw into the
   * email to the guardian. Whoever registered controlled the markup of a
   * message sent from XUNTAS's verified domain.
   */
  it('defuses an attempt to inject a link', () => {
    const name = '<a href="https://phishing.example">Da clic aquí</a>'
    const output = escapeHtml(name)
    // What matters is not that the text "href" disappears, but that no
    // character is left with which a tag could be opened or closed.
    expect(output).not.toContain('<')
    expect(output).not.toContain('>')
    expect(output).toContain('&lt;a href=')
  })
})

describe('textForEmail', () => {
  it('trims, collapses whitespace, and escapes', () => {
    expect(textForEmail('  Ana   <b>M</b>  ')).toBe('Ana &lt;b&gt;M&lt;/b&gt;')
  })

  it('respects the length limit', () => {
    expect(textForEmail('a'.repeat(500), 10)).toBe('a'.repeat(10))
  })

  it('cuts BEFORE escaping, so it never splits an entity in half', () => {
    // If it cut afterwards, an '&amp;' could end up as '&am'.
    expect(textForEmail('&&&&&', 2)).toBe('&amp;&amp;')
  })
})

describe('isValidEmail', () => {
  it('accepts normal emails', () => {
    expect(isValidEmail('ana@example.com')).toBe(true)
    expect(isValidEmail('ana.perez+golf@club.com.mx')).toBe(true)
  })

  it('rejects what is not shaped like an email', () => {
    expect(isValidEmail('ana')).toBe(false)
    expect(isValidEmail('ana@ejemplo')).toBe(false)
    expect(isValidEmail('ana @example.com')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })

  it('rejects absurdly long addresses', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@example.com`)).toBe(false)
  })
})
