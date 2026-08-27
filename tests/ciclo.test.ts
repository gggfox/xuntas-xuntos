import { describe, expect, it } from 'vitest'
import {
  APERTURA_MS,
  CIERRE_MS,
  edadEn,
  esMenorDeEdad,
  fechaNacimientoValida,
  ventanaAbierta,
} from '../convex/lib/ciclo'

/** 10 de septiembre de 2026, mediodía en el centro de México. */
const DURANTE = Date.parse('2026-09-10T18:00:00.000Z')

describe('ventanaAbierta', () => {
  it('está cerrada antes de la apertura y abierta justo al abrir', () => {
    expect(ventanaAbierta(APERTURA_MS - 1)).toBe(false)
    expect(ventanaAbierta(APERTURA_MS)).toBe(true)
  })

  it('sigue abierta en el último milisegundo y cierra después', () => {
    expect(ventanaAbierta(CIERRE_MS)).toBe(true)
    expect(ventanaAbierta(CIERRE_MS + 1)).toBe(false)
  })

  it('abre el 4 y cierra el 18 de septiembre, hora del centro de México', () => {
    // 4 de septiembre 00:00 CST = 06:00 UTC.
    expect(APERTURA_MS).toBe(Date.parse('2026-09-04T06:00:00.000Z'))
    // 18 de septiembre 23:59:59.999 CST = 19 de septiembre 05:59:59.999 UTC.
    expect(CIERRE_MS).toBe(Date.parse('2026-09-19T05:59:59.999Z'))
  })
})

describe('edadEn', () => {
  it('cuenta los años cumplidos', () => {
    expect(edadEn('2000-01-01', DURANTE)).toBe(26)
  })

  it('no cumple años hasta el día', () => {
    expect(edadEn('2008-09-11', DURANTE)).toBe(17)
    expect(edadEn('2008-09-10', DURANTE)).toBe(18)
  })

  it('devuelve -1 si la fecha no se entiende', () => {
    expect(edadEn('', DURANTE)).toBe(-1)
    expect(edadEn('11/09/2008', DURANTE)).toBe(-1)
    expect(edadEn('2008-02-31', DURANTE)).toBe(-1)
  })

  /**
   * La regresión concreta: se calculaba en UTC. Quien cumplía 18 el día 10
   * pasaba a contar como mayor desde las 18:00 del día 9, hora local — seis
   * horas en las que el sistema decidía distinto que la ley.
   */
  it('resuelve el "hoy" en hora del centro de México, no en UTC', () => {
    // 9 de septiembre, 23:00 en México = 10 de septiembre 05:00 UTC.
    const nocheDelNueve = Date.parse('2026-09-10T05:00:00.000Z')
    expect(edadEn('2008-09-10', nocheDelNueve)).toBe(17)
    expect(esMenorDeEdad('2008-09-10', nocheDelNueve)).toBe(true)

    // Un minuto después de la medianoche del 10, ya en México.
    const madrugadaDelDiez = Date.parse('2026-09-10T06:01:00.000Z')
    expect(edadEn('2008-09-10', madrugadaDelDiez)).toBe(18)
    expect(esMenorDeEdad('2008-09-10', madrugadaDelDiez)).toBe(false)
  })
})

describe('esMenorDeEdad', () => {
  it('trata una fecha ilegible como menor de edad', () => {
    // El error caro es el otro: dar por mayor a quien no lo es y no pedirle
    // nunca la autorización de su tutor.
    expect(esMenorDeEdad('basura', DURANTE)).toBe(true)
    expect(esMenorDeEdad('', DURANTE)).toBe(true)
  })
})

describe('fechaNacimientoValida', () => {
  it('acepta una fecha razonable', () => {
    expect(fechaNacimientoValida('2008-09-10', DURANTE)).toBe(true)
  })

  it('rechaza el futuro, lo improbable y lo mal formado', () => {
    expect(fechaNacimientoValida('2027-01-01', DURANTE)).toBe(false)
    expect(fechaNacimientoValida('1899-01-01', DURANTE)).toBe(false)
    expect(fechaNacimientoValida('2008-13-01', DURANTE)).toBe(false)
    expect(fechaNacimientoValida('2008-02-30', DURANTE)).toBe(false)
    expect(fechaNacimientoValida('10-09-2008', DURANTE)).toBe(false)
  })
})
