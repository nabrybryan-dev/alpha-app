import { describe, expect, it } from 'vitest'
import { PATRONES, type Patron } from '../src/domain/patrones/catalogo'
import { esqueletoEnFase } from '../src/domain/patrones/escena'
import { puntoDeHueso } from '../src/domain/patrones/esqueleto'
import { V, type Vec3 } from '../src/domain/patrones/algebra'
import {
  direccionDeResistencia,
  oposicion,
  TOPE_DE_OPOSICION,
  unitario,
} from '../src/features/entrenar/escena/lineaDeResistencia'
import {
  implementosDeEscena,
  type ImplementoEnEscena,
} from '../src/features/entrenar/escena/implementos'

/**
 * ¿SE OPONE EL APARATO AL GESTO QUE ACOMPAÑA?
 *
 * Es la pregunta que hizo Bryan el 2026-09-06, y la hizo con la definición dentro: «si yo
 * voy a hacer fuerza hacia arriba, yo requiero que la fuerza de la máquina me impulse hacia
 * abajo». Un aparato perpendicular al gesto no resiste nada y uno a favor ayuda, así que en
 * los dos casos lo que se enseña en pantalla es un ejercicio que no es el prescrito.
 *
 * ## Lo que había cuando esto se escribió
 *
 * Medido con `scripts/medir-resistencia.mjs` sobre el catálogo entero, **13 de los 27
 * aparatos no se oponían**. La polea se plantaba siempre delante del sujeto y la máquina de
 * placas siempre detrás, con dos ternas de números escritos a mano, así que:
 *
 * | patrón | qué salía | cos |
 * | --- | --- | --- |
 * | tracción horizontal | la máquina remaba desde detrás del que rema | +0,94 |
 * | flexión de tronco | el cable del crunch tiraba hacia donde iba el tronco | +0,93 |
 * | antirrotación | el Pallof empujaba en la dirección del press, no de lado | +0,92 |
 * | extensión de rodilla | el brazo empujaba de canto | +0,06 |
 * | aducción de cadera | el almohadillado no empujaba a ninguna parte útil | +0,05 |
 * | flexión plantar | ídem | +0,03 |
 *
 * Y el brazo dibujado de la máquina de placas **se estiraba hasta 40 cm** entre el arranque
 * y el final: un brazo que cambia de largo no es un brazo, es una goma, y el aparato que se
 * veía era mecánicamente imposible.
 *
 * ## Los dos veredictos, y por qué son el mismo instrumento
 *
 * Este archivo no distingue «aparato mal puesto» de «ficha animada al revés», y es a
 * propósito: con peso libre la resistencia es la gravedad y no hay nada que colocar, así
 * que un coseno positivo solo puede significar que la carga BAJA en la fase que el repo
 * llama concéntrica —`faseDeTiempo` le da 1,2 s con punto de atasco al tramo 0→1 y 1,9 s
 * «bajando frenando» al 1→0—. La sentadilla caía rápido y se levantaba despacio.
 */

const FASES = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]

const primerEjemplo = (p: Patron): string => p.ejemplos.split('·')[0].trim()

/** El punto por donde entra la carga en cada fase: el medio de los agarres si hay dos. */
function caminoDeLaCarga(patron: Patron, pieza: ImplementoEnEscena): Vec3[] {
  return FASES.map((f) => {
    const esq = esqueletoEnFase(patron, f)
    let suma: Vec3 = [0, 0, 0]
    for (const a of pieza.agarres) suma = V.sumar(suma, puntoDeHueso(esq, a.hueso, a.t, a.desvio))
    return V.escalar(suma, 1 / pieza.agarres.length)
  })
}

interface Veredicto {
  patron: string
  pieza: string
  /** El coseno a media repetición, que es donde la resistencia manda. */
  cos: number
  /** Cuánto cambia de largo el brazo dibujado, en metros. Solo tiene sentido con placas. */
  estira: number
  recorrido: number
}

/** Todas las piezas que ejercen fuerza sobre el sujeto, con su veredicto. */
function veredictos(nombreForzado?: string): Veredicto[] {
  const salida: Veredicto[] = []
  for (const patron of PATRONES) {
    const escena = implementosDeEscena(patron.categoria, nombreForzado ?? primerEjemplo(patron))
    for (const pieza of escena.piezas) {
      // El banco sostiene y la asistida CARGA CON el sujeto: ninguno de los dos resiste.
      if (pieza.agarres.length === 0 || pieza.forma === 'asistida') continue
      // La barra fija de una dominada no se mueve: el que sube es el cuerpo, y su
      // resistencia —el propio peso— la mide `gravedad.ts`, no esto.
      if (pieza.pieza === 'barra-fija') continue
      const camino = caminoDeLaCarga(patron, pieza)
      const gesto = unitario(V.restar(camino[camino.length - 1], camino[0]))
      // Un isométrico no tiene dirección contra la que oponerse. La antiextensión y la
      // suspensión están ahí para eso: se sostienen, no se recorren.
      if (!gesto) continue
      const medio = Math.floor(camino.length / 2)
      const r = direccionDeResistencia(pieza, camino[medio])
      if (!r) continue
      const anclaje = pieza.enElSuelo?.anclaje
      const largos =
        anclaje && r.origen === 'brazo'
          ? camino.map((p) => V.largo(V.restar(anclaje, p)))
          : [0, 0]
      salida.push({
        patron: patron.id,
        pieza: `${pieza.pieza}${pieza.forma ? '/' + pieza.forma : ''}`,
        cos: oposicion(r, gesto),
        estira: Math.max(...largos) - Math.min(...largos),
        recorrido: V.largo(V.restar(camino[camino.length - 1], camino[0])),
      })
    }
  }
  return salida
}

describe('el instrumento sabe distinguir, que es lo primero', () => {
  // Un guardián que no se ha visto fallar no vale nada: si `oposicion` devolviera siempre
  // −1, todo lo de abajo pasaría y no habría avisado de los trece.
  const arriba: Vec3 = [0, 1, 0]

  it('llama oposición a lo que se opone y ayuda a lo que ayuda', () => {
    expect(oposicion({ direccion: [0, -1, 0], origen: 'gravedad' }, arriba)).toBeCloseTo(-1, 6)
    expect(oposicion({ direccion: [0, 1, 0], origen: 'gravedad' }, arriba)).toBeCloseTo(1, 6)
    expect(oposicion({ direccion: [1, 0, 0], origen: 'gravedad' }, arriba)).toBeCloseTo(0, 6)
  })

  it('con un brazo de máquina lo que juzga es la PERPENDICULARIDAD', () => {
    // La fuerza de un brazo que gira sale perpendicular al brazo, así que un brazo
    // perpendicular al gesto es el que se opone —y uno alineado con el gesto es el que se
    // estira, que es lo imposible.
    expect(oposicion({ direccion: [1, 0, 0], origen: 'brazo' }, arriba)).toBeCloseTo(-1, 6)
    expect(oposicion({ direccion: [0, 1, 0], origen: 'brazo' }, arriba)).toBeCloseTo(0, 6)
  })
})

describe('la resistencia va contra el gesto, en todo el catálogo', () => {
  const medidos = veredictos()

  it('hay aparatos que medir: si esto se queda en cero, el resto no prueba nada', () => {
    expect(medidos.length).toBeGreaterThan(20)
  })

  it.each(medidos.map((v) => [v.patron, v] as const))('%s', (_id, v) => {
    expect(
      v.cos,
      `${v.patron} · ${v.pieza} · recorrido ${(v.recorrido * 100).toFixed(1)} cm: ` +
        `coseno ${v.cos.toFixed(2)} (−1 se opone, 0 no resiste, +1 ayuda)`,
    ).toBeLessThanOrEqual(TOPE_DE_OPOSICION)
  })
})

describe('el brazo de una máquina es rígido', () => {
  // Un brazo que cambia de largo entre el arranque y el final es una goma, y el aparato
  // dibujado sería imposible. Se tolera lo que el ajuste de la circunferencia deja de
  // residuo —el gesto humano no es un arco perfecto—, no un cambio de forma.
  const TOPE = 0.07

  it.each(veredictos().filter((v) => v.estira > 0).map((v) => [v.patron, v] as const))(
    '%s',
    (_id, v) => {
      expect(v.estira, `${v.patron}: el brazo cambia ${(v.estira * 100).toFixed(1)} cm`).toBeLessThan(
        TOPE,
      )
    },
  )
})

describe('con peso libre, el coseno delata una ficha animada al revés', () => {
  // Aquí no hay nada que colocar: la gravedad tira hacia abajo y punto. Así que un coseno
  // positivo solo puede querer decir que la carga BAJA de la fase 0 a la 1, o sea que la
  // repetición se anima cayendo rápido y levantándose despacio.
  it('la sentadilla con barra sube en la concéntrica', () => {
    const conBarra = veredictos('Sentadilla con barra').filter((v) => v.patron === 'sentadilla')
    expect(conBarra).toHaveLength(1)
    expect(conBarra[0].cos).toBeLessThanOrEqual(TOPE_DE_OPOSICION)
  })
})
