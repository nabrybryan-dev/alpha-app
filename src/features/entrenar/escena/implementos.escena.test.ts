import { describe, expect, it } from 'vitest'
import { Malla } from '../../../domain/patrones/malla'
import { resolver } from '../../../domain/patrones/esqueleto'
import { PATRON_POR_ID } from '../../../domain/patrones/catalogo'
import { AVISO_SIN_IMPLEMENTO, AVISO_SIN_MODELO, implementosDeEscena } from './implementos'
import { construirPieza } from './dibujarImplementos'

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
    const e = escena('flexion_rodilla', 'Abducción de cadera tumbada')
    // Lo que se afirma es que no se dibuja ningún IMPLEMENTO. Desde el 2026-09-06 la escena
    // puede traer además el MUEBLE que sostiene al sujeto —aquí la camilla que su anclaje
    // declara—, y eso no es un implemento: nadie levanta una camilla. Sin este filtro la
    // prueba diría que dibujar el banco es dibujar una barra.
    expect(e.piezas.filter((x) => x.pieza !== 'banco')).toEqual([])
    expect(e.supuesto).toBe(true)
    expect(e.avisos).toContain(AVISO_SIN_IMPLEMENTO)
  })

  it('una plancha con carga tampoco', () => {
    expect(escena('antiextension', 'Dead bug').piezas).toEqual([])
  })

  it('y cuando el nombre sí lo dice, se dibuja y no se declara supuesto', () => {
    const e = escena('empuje_horizontal', 'Press de pecho con barra')
    expect(e.piezas.length).toBeGreaterThan(0)
    expect(e.supuesto).toBe(false)
    expect(e.avisos).not.toContain(AVISO_SIN_IMPLEMENTO)
  })
})

/**
 * LA TAXONOMÍA ANTIGUA TAMBIÉN ENTRENA CON ALGO EN LAS MANOS.
 *
 * `categoriaCanonica` deja en blanco «DOMINANTE DE CADERA», «AISLAMIENTO» y «CORE» a
 * propósito —no hay patrón que medir— y hasta hoy eso vaciaba la escena entera: 16 de los
 * 25 ejercicios del seed, hip thrust y peso muerto incluidos, sin implemento y sin aviso.
 * El implemento no sale del patrón, sale del nombre; lo que no hay es medida, y eso se dice.
 */
describe('sin modelo de palancas, el implemento sigue saliendo del nombre', () => {
  it('el hip thrust con barra de la taxonomía antigua dibuja la barra sobre la pelvis', () => {
    const e = implementosDeEscena('DOMINANTE DE CADERA', 'Hip thrust con barra')
    expect(e.piezas.map((p) => p.pieza)).toEqual(['barra'])
    expect(e.piezas[0].agarres[0].hueso).toBe('pelvis')
    expect(e.avisos).toContain(AVISO_SIN_MODELO)
    expect(e.supuesto).toBe(false)
  })

  it('la prensa y el curl en máquina dibujan su máquina', () => {
    expect(implementosDeEscena('DOMINANTE DE RODILLA', 'Prensa 45° pies altos').piezas[0].forma).toBe('rail-inclinado')
    expect(implementosDeEscena('AISLAMIENTO', 'Curl femoral sentado en máquina').piezas[0].forma).toBe('placas')
  })

  it('y sin implemento en el nombre sigue sin dibujar nada, ahora con los dos avisos', () => {
    const e = implementosDeEscena('AISLAMIENTO', 'Abducción de cadera tumbada')
    expect(e.piezas).toEqual([])
    expect(e.avisos).toEqual([AVISO_SIN_MODELO, AVISO_SIN_IMPLEMENTO])
    expect(e.supuesto).toBe(true)
  })
})

describe('la barra fija es una estructura', () => {
  it('llega hasta el suelo: una dominada no cuelga de una barra que flota', () => {
    // Bryan lo vio el 2026-09-06: la barra de las dominadas era una barra olímpica, con sus
    // mangas, suspendida en el aire. Lo que la hace fija es lo que la sujeta.
    // Desde el 2026-09-06 la ASISTIDA tiene su máquina (`maquinaAsistida.test.ts`); la barra
    // fija es de la dominada a secas.
    const e = implementosDeEscena('TRACCIÓN VERTICAL', 'Dominadas')
    expect(e.piezas[0].pieza).toBe('barra-fija')
    const m = new Malla(4096)
    construirPieza(m, e.piezas[0], resolver({}, [0, 0, 0], [0, 0, 0]))
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 1; i < m.posicion.length; i += 3) {
      minY = Math.min(minY, m.posicion[i])
      maxY = Math.max(maxY, m.posicion[i])
    }
    expect(minY, 'no llega al suelo').toBeLessThan(0.02)
    expect(maxY, 'no está a la altura de las manos').toBeGreaterThan(0.6)
  })
})
