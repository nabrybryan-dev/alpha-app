import { describe, expect, it } from 'vitest'
import { PATRON_POR_ID } from '../../../domain/patrones/catalogo'
import { AVISO_SIN_IMPLEMENTO, implementosDeEscena } from './implementos'

/**
 * LA ESCENA NO CONTRADICE A LA PRESCRIPCIÓN.
 *
 * Dos fallos que Bryan vio navegando por el salón el 2026-09-05, y que aquí quedan
 * clavados porque los dos hacían que la pantalla dijera algo distinto de lo que el
 * asesorado tiene escrito:
 *
 *  1. La barra de la sentadilla colgaba de las manos, a la altura de las caderas. Va
 *     sobre el trapecio: es lo que hace que sea una sentadilla y no un peso muerto.
 *  2. Un ejercicio cuyo nombre no declara implemento salía con una barra olímpica. Eran
 *     6 de los 27 del seed —el 22 %—, entre ellos un curl femoral sentado y una plancha.
 *
 * Se entra por donde entra la app: la categoría del patrón y el NOMBRE del ejercicio.
 */

const escena = (idPatron: keyof typeof PATRON_POR_ID, nombre: string) =>
  implementosDeEscena(PATRON_POR_ID[idPatron].categoria, nombre)

/** El hueso del que cuelga el primer agarre: donde la escena pone la carga. */
const huesoDelAgarre = (idPatron: keyof typeof PATRON_POR_ID, nombre: string) =>
  escena(idPatron, nombre).piezas[0]?.agarres.map((a) => a.hueso)

describe('dónde pone la escena la carga', () => {
  it('la sentadilla con barra la apoya en el tórax, no en las manos', () => {
    expect(huesoDelAgarre('sentadilla', 'Sentadilla con barra')).toEqual(['torax'])
  })

  it('el press con barra sigue llevándola en las dos manos', () => {
    expect(huesoDelAgarre('empuje_horizontal', 'Press de pecho con barra')).toEqual(['manoD', 'manoI'])
  })

  it('la búlgara con mancuernas va en las manos, y a un solo lado si lo dice el nombre', () => {
    expect(huesoDelAgarre('sentadilla_unilateral', 'Sentadilla búlgara con mancuernas')).toEqual([
      'manoD',
      'manoI',
    ])
    expect(huesoDelAgarre('sentadilla_unilateral', 'Búlgara con una mancuerna')).toEqual(['manoD'])
  })

  it('lo dice en su porqué, para que se pueda auditar sin abrir el código', () => {
    const p = escena('sentadilla', 'Sentadilla con barra').piezas[0]
    expect(p.porQue).toContain('hombros')
    expect(p.porQue).toContain('se apoya en el cuerpo')
  })
})

describe('sin implemento declarado no se dibuja ninguno', () => {
  it('un curl femoral sentado no lleva barra', () => {
    const e = escena('flexion_rodilla', 'Curl femoral sentado')
    expect(e.piezas).toEqual([])
    expect(e.supuesto).toBe(true)
    expect(e.avisos).toContain(AVISO_SIN_IMPLEMENTO)
  })

  it('una plancha con carga tampoco', () => {
    expect(escena('antiextension', 'Plancha con carga').piezas).toEqual([])
  })

  it('y cuando el nombre sí lo dice, se dibuja y no se declara supuesto', () => {
    const e = escena('empuje_horizontal', 'Press de pecho con barra')
    expect(e.piezas.length).toBeGreaterThan(0)
    expect(e.supuesto).toBe(false)
    expect(e.avisos).not.toContain(AVISO_SIN_IMPLEMENTO)
  })
})
