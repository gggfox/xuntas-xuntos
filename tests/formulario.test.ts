import { describe, expect, it } from 'vitest'
import { paraEnviar, registroVacio } from '../src/lib/formulario'

describe('paraEnviar', () => {
  it('normaliza el correo', () => {
    const d = registroVacio({ email: '  Ana@Example.COM ' })
    expect(paraEnviar(d).persona.email).toBe('ana@example.com')
  })

  it('descarta las filas a medio llenar', () => {
    const d = registroVacio()
    d.resultados = [
      { torneo: 'CNIJ', resultado: '2º' },
      { torneo: 'Solo torneo', resultado: '' },
      { torneo: '', resultado: '' },
    ]
    expect(paraEnviar(d).resultados).toEqual([{ torneo: 'CNIJ', resultado: '2º' }])
  })

  it('descarta los rankings sin posición', () => {
    // `registroVacio` siembra los cuatro rankings fijos con posición vacía.
    expect(paraEnviar(registroVacio()).rankings).toEqual([])
  })

  it('no toca los datos originales', () => {
    const d = registroVacio({ email: 'ANA@EXAMPLE.COM' })
    paraEnviar(d)
    expect(d.persona.email).toBe('ANA@EXAMPLE.COM')
  })
})
