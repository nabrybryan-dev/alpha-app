import { describe, expect, it } from 'vitest'
import { MINIMO_MOTIVO, porQueNoValeElMotivo } from './motivoDeVeto'

/**
 * Este archivo existe para que la pantalla no sea nunca más permisiva que la
 * base. El `check` de la 0040 es `length(trim(motivo)) >= 3`; si aquí se
 * aceptara algo que allí se rechaza, el veto pasaría la validación local, se
 * encolaría, reventaría contra el constraint y se perdería en silencio.
 */

const vale = (motivo: string) => porQueNoValeElMotivo(motivo) === null

describe('motivoDeVeto', () => {
  it('el mínimo es el mismo que el check de la 0040', () => {
    expect(MINIMO_MOTIVO).toBe(3)
  })

  describe('acepta', () => {
    it.each(['alergia declarada', 'no le gusta', 'SII', '  intolerancia  '])('«%s»', (m) => {
      expect(vale(m)).toBe(true)
    })
  })

  describe('rechaza, y dice qué falta', () => {
    it('el vacío', () => {
      expect(porQueNoValeElMotivo('')).toMatch(/Escribe por qué/)
    })

    /** Lo mismo que rechazaría Postgres con `length(trim(...)) >= 3`. */
    it('solo espacios, por muchos que sean', () => {
      expect(vale('        ')).toBe(false)
    })

    it('lo demasiado corto, diciendo cuánto falta', () => {
      expect(porQueNoValeElMotivo('ok')).toMatch(/Al menos 3 letras/)
    })

    /** `' a '` tiene 3 caracteres pero uno solo de contenido. */
    it('lo que solo llega al mínimo contando espacios', () => {
      expect(vale(' a ')).toBe(false)
    })
  })

  /**
   * La regla local y la de Postgres tienen que dar el MISMO veredicto. Se
   * comprueba con la expresión equivalente, no repitiendo la implementación.
   */
  it('coincide con `length(trim(motivo)) >= 3` en todos los casos', () => {
    const casos = ['', ' ', 'a', 'ab', 'abc', ' ab ', ' abc ', 'alergia', '   x   ', '\t\nok\n']
    for (const caso of casos) {
      expect(vale(caso), `discrepan en «${caso}»`).toBe(caso.trim().length >= 3)
    }
  })
})
