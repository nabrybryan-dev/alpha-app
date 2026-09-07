import { describe, expect, it } from 'vitest'
import { PATRON_POR_ID } from '../../../domain/patrones/catalogo'
import { CAMPO_VISUAL, esqueletoEnFase } from '../../../domain/patrones/escena'
import { puntoDeHueso } from '../../../domain/patrones/esqueleto'
import { grados, type Vec3 } from '../../../domain/patrones/algebra'
import { ENCUADRE_SALA, elevacionDelSalon } from './sala'
import { encuadreDelSalon, fueraDelCuadro } from './encuadreDelSalon'

/**
 * EL GUARDIÁN DEL ENCUADRE.
 *
 * Bryan, viendo la demo del 2026-09-05: en el press de pecho en máquina «solo asoman las
 * manos arriba y los pies abajo». Se midió y no era ese ejercicio: **se salían del cuadro
 * los 31 patrones**, de 21 px el mejor a 750 el peor, porque la cámara del salón miraba
 * siempre al mismo punto —el que encuadra a alguien DE PIE—.
 */

const patrones = Object.values(PATRON_POR_ID)

function puntosDelCuerpo(id: string): Vec3[] {
  const patron = PATRON_POR_ID[id]
  const puntos: Vec3[] = []
  for (const fase of [0, 0.5, 1]) {
    const esq = esqueletoEnFase(patron, fase)
    for (const hueso of Object.keys(esq.mundo)) {
      for (const t of [0, 1]) puntos.push(puntoDeHueso(esq, hueso, t))
    }
  }
  return puntos
}

/** Lo que se salía con la cámara vieja: fija, mirando a [0, 1,2, 0] a 4,6 m. */
function comoEstaba(id: string): number {
  const patron = PATRON_POR_ID[id]
  return fueraDelCuadro(
    puntosDelCuerpo(id),
    patron.camara.azimut,
    elevacionDelSalon(patron.camara.elevacion),
    ENCUADRE_SALA.distancia,
    [...ENCUADRE_SALA.centro],
  )
}

/** Lo que se sale ahora, con el cuadro calculado. */
function comoEsta(id: string): number {
  const patron = PATRON_POR_ID[id]
  const e = encuadreDelSalon(patron)
  return fueraDelCuadro(
    puntosDelCuerpo(id),
    patron.camara.azimut,
    elevacionDelSalon(patron.camara.elevacion),
    e.distancia,
    [...e.centro],
    e.campo,
  )
}

/**
 * LO QUE SE QUEDA FUERA: cero. Con las tres palancas —mirar al cuerpo, retirarse y abrir el
 * objetivo— entran los 31. El tope está aquí en vez de en el módulo para que no pueda
 * EMPEORAR sin que alguien se entere.
 */
const TOPE_DE_LO_QUE_SE_SALE = 0

describe('el cuadro del salón se calcula contra el cuerpo', () => {
  it('ningún patrón se sale más de lo medido, y antes se salían los 31', () => {
    const peorAntes = Math.max(...patrones.map((p) => comoEstaba(p.id)))
    const peorAhora = Math.max(...patrones.map((p) => comoEsta(p.id)))
    // La cámara vieja dejaba fuera hasta 750 px: esto documenta de dónde se viene.
    expect(peorAntes).toBeGreaterThan(700)
    expect(peorAhora).toBeLessThanOrEqual(TOPE_DE_LO_QUE_SE_SALE)
  })

  it('ninguno empeora respecto a la cámara fija: el cuadro calculado nunca es peor', () => {
    for (const p of patrones) {
      expect(comoEsta(p.id), `${p.id} se encuadra PEOR que antes`).toBeLessThanOrEqual(comoEstaba(p.id))
    }
  })

  /**
   * El que Bryan señaló, con su nombre y su número. Se salía 316 px con la cámara fija, y el
   * cuadro calculado lo metió entero.
   *
   * EL 316 YA NO SE PUEDE REPRODUCIR, y por una buena razón: el 2026-09-07 el press se
   * recolocó —codos recogidos a 55° del tronco en vez de abiertos a 87°, antebrazo al techo—
   * y con los brazos dentro, hasta la cámara fija pierde solo 172 px. Así que lo que se
   * afirma es la relación, no el número: con la cámara fija se salía, y con el cuadro
   * calculado no se sale nada.
   */
  it('el press de pecho en máquina deja de salirse', () => {
    expect(comoEstaba('empuje_horizontal')).toBeGreaterThan(100)
    expect(comoEsta('empuje_horizontal')).toBe(0)
  })

  /** Y el peor de todos, que era una pierna entera fuera de la pantalla. */
  it('la flexión de rodilla tumbado pasa de 750 px fuera a cero', () => {
    expect(comoEstaba('flexion_rodilla')).toBeGreaterThan(700)
    expect(comoEsta('flexion_rodilla')).toBe(0)
  })

  it('la cámara no se sale de la sala', () => {
    // La sala tiene 7 m de radio; 6,3 deja setenta centímetros hasta la pared.
    for (const p of patrones) {
      const e = encuadreDelSalon(p)
      expect(e.distancia, `${p.id} pone la cámara fuera de la habitación`).toBeLessThanOrEqual(6.3)
      expect(e.distancia).toBeGreaterThanOrEqual(ENCUADRE_SALA.distancia)
    }
  })

  /**
   * GIRAR ESTÁ DESCARTADO Y NO PUEDE VOLVER POR LA PUERTA DE ATRÁS. Los números decían que
   * funcionaba —el press de 316 px a 17— y la foto enseñó la máquina plantada delante de la
   * persona. El azimut del salón es el que declara el patrón, y punto.
   */
  it('el encuadre NUNCA gira la cámara: el ángulo lo declara el patrón', () => {
    for (const p of patrones) {
      expect(Object.keys(encuadreDelSalon(p))).not.toContain('azimut')
    }
  })

  /** Abrir el objetivo es el último recurso, y solo donde hace falta. */
  it('quien cabe con el objetivo de siempre no lo abre', () => {
    expect(encuadreDelSalon(PATRON_POR_ID.sentadilla).campo).toBe(CAMPO_VISUAL)
    expect(encuadreDelSalon(PATRON_POR_ID.bisagra_cadera).campo).toBe(CAMPO_VISUAL)
    // Y EL PRESS DE BANCA SE PASÓ A ESTE LADO EL 2026-09-07: con los codos recogidos ya cabe
    // con el objetivo de siempre. Era el ejemplo del que sí lo abría; ahora ese papel lo hace
    // la apertura de pecho, que de brazo a brazo mide dos metros y no cabe de otra forma.
    expect(encuadreDelSalon(PATRON_POR_ID.empuje_horizontal).campo).toBe(CAMPO_VISUAL)
    expect(encuadreDelSalon(PATRON_POR_ID.apertura_pecho).campo).toBeGreaterThan(CAMPO_VISUAL)
  })

  it('el objetivo no se abre más allá del gran angular medido', () => {
    for (const p of patrones) {
      expect(encuadreDelSalon(p).campo, `${p.id} abre el objetivo más allá del gran angular medido`).toBeLessThanOrEqual(grados(45))
    }
  })

  it('mirar al cuerpo es lo primero, y a veces es lo único: la sentadilla no se retira ni gira', () => {
    const e = encuadreDelSalon(PATRON_POR_ID.sentadilla)
    expect(e.distancia).toBe(ENCUADRE_SALA.distancia)
    // Y el centro NO es el de la sala: es el del cuerpo.
    expect(e.centro[1]).not.toBe(ENCUADRE_SALA.centro[1])
  })

  it('el cuadro de un patrón no cambia entre llamadas: se calcula una vez', () => {
    const a = encuadreDelSalon(PATRON_POR_ID.empuje_horizontal)
    const b = encuadreDelSalon(PATRON_POR_ID.empuje_horizontal)
    expect(a).toBe(b)
  })
})
