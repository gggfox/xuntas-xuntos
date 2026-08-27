import { describe, expect, it } from 'vitest'
import { correoValido, escaparHtml, textoParaCorreo } from '../convex/lib/html'

describe('escaparHtml', () => {
  it('neutraliza el marcado', () => {
    expect(escaparHtml('<b>hola</b>')).toBe('&lt;b&gt;hola&lt;/b&gt;')
  })

  it('escapa comillas y ampersand', () => {
    expect(escaparHtml(`" & '`)).toBe('&quot; &amp; &#39;')
  })

  it('escapa el ampersand primero, sin doble escape', () => {
    expect(escaparHtml('&lt;')).toBe('&amp;lt;')
  })

  /**
   * La regresión concreta: el nombre del atleta se interpolaba crudo en el
   * correo al tutor. Quien se registraba controlaba el marcado de un mensaje
   * enviado desde el dominio verificado de XUNTAS.
   */
  it('desactiva un intento de inyectar un enlace', () => {
    const nombre = '<a href="https://phishing.example">Da clic aquí</a>'
    const salida = escaparHtml(nombre)
    // Lo que importa no es que desaparezca el texto "href", sino que no quede
    // ningún carácter con el que se pueda abrir o cerrar una etiqueta.
    expect(salida).not.toContain('<')
    expect(salida).not.toContain('>')
    expect(salida).toContain('&lt;a href=')
  })
})

describe('textoParaCorreo', () => {
  it('recorta, colapsa espacios y escapa', () => {
    expect(textoParaCorreo('  Ana   <b>M</b>  ')).toBe('Ana &lt;b&gt;M&lt;/b&gt;')
  })

  it('respeta el límite de longitud', () => {
    expect(textoParaCorreo('a'.repeat(500), 10)).toBe('a'.repeat(10))
  })

  it('corta ANTES de escapar, para no partir una entidad a la mitad', () => {
    // Si cortara después, un '&amp;' podría quedar como '&am'.
    expect(textoParaCorreo('&&&&&', 2)).toBe('&amp;&amp;')
  })
})

describe('correoValido', () => {
  it('acepta correos normales', () => {
    expect(correoValido('ana@example.com')).toBe(true)
    expect(correoValido('ana.perez+golf@club.com.mx')).toBe(true)
  })

  it('rechaza lo que no tiene forma de correo', () => {
    expect(correoValido('ana')).toBe(false)
    expect(correoValido('ana@ejemplo')).toBe(false)
    expect(correoValido('ana @example.com')).toBe(false)
    expect(correoValido('')).toBe(false)
  })

  it('rechaza direcciones absurdamente largas', () => {
    expect(correoValido(`${'a'.repeat(250)}@example.com`)).toBe(false)
  })
})
