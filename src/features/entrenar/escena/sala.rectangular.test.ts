import { describe, expect, it } from 'vitest'
import { Malla } from '../../../domain/patrones/malla'
import { cifrasDeLaSerie, construirSala, radioDelMuroRectangular } from './sala'

/**
 * LOS MARCADORES EN LA SALA DE BLENDER.
 *
 * La sala de Blender es un rectángulo de 16 × 11 y la de cajas era un cilindro de 7 m.
 * Los marcadores se colgaban del cilindro; con la sala de Blender, el que caía a 90°
 * quedaba en z = 6,98, o sea A LA ESPALDA del muro corto (5,5). Aquí se prueba que la
 * distancia al muro se calcula bien en cada dirección, y que con la sala de Blender no se
 * construyen ni la pared ni el hierro de cajas —vienen dentro de la pieza—.
 */

describe('radioDelMuroRectangular', () => {
  it('en los ejes da el medio ancho o el medio fondo', () => {
    expect(radioDelMuroRectangular(8, 5.5, 0)).toBeCloseTo(8, 9)
    expect(radioDelMuroRectangular(8, 5.5, 180)).toBeCloseTo(8, 9)
    expect(radioDelMuroRectangular(8, 5.5, 90)).toBeCloseTo(5.5, 9)
    expect(radioDelMuroRectangular(8, 5.5, 270)).toBeCloseTo(5.5, 9)
  })

  it('en diagonal choca antes con el muro corto', () => {
    // A 45° el rayo llega a z = 5,5 cuando x = 5,5, antes de llegar a x = 8.
    expect(radioDelMuroRectangular(8, 5.5, 45)).toBeCloseTo(5.5 * Math.SQRT2, 6)
  })

  it('nunca se sale del rectángulo', () => {
    for (let a = 0; a < 360; a += 7) {
      const r = radioDelMuroRectangular(8, 5.5, a)
      const x = Math.cos((a * Math.PI) / 180) * r
      const z = Math.sin((a * Math.PI) / 180) * r
      expect(Math.abs(x)).toBeLessThanOrEqual(8 + 1e-9)
      expect(Math.abs(z)).toBeLessThanOrEqual(5.5 + 1e-9)
    }
  })
})

describe('construirSala con la sala de Blender', () => {
  const datos = cifrasDeLaSerie({ series: 3, reps: 8, rir: 2 as const })

  it('no levanta la pared ni las estaciones: sigue siendo una fracción de la sala de cajas', () => {
    // Con la pieza de Blender no se dibuja ni el muro ni las diez estaciones del anillo.
    // Desde el 2026-09-06 sí se dibuja UNA cosa: los estantes de muro de los once ángulos en
    // que la pieza deja al sujeto contra hormigón pelado (`ANGULOS_SIN_FONDO`). Son mil y
    // pico vértices, así que el ahorro sigue siendo el de antes con otro margen: lo que se
    // afirma es que no ha vuelto el mobiliario entero por la puerta de atrás.
    const cajas = new Malla()
    construirSala(cajas, datos, 72)
    const blender = new Malla()
    construirSala(blender, datos, 72, { salaDeBlender: { medioAncho: 8, medioFondo: 5.5 } })
    expect(blender.vertices).toBeLessThan(cajas.vertices * 0.75)
    expect(blender.vertices).toBeGreaterThan(0)
  })

  it('cuelga los marcadores dentro del rectángulo, no en el cilindro de 7 m', () => {
    const m = new Malla()
    construirSala(m, datos, 72, { salaDeBlender: { medioAncho: 8, medioFondo: 5.5 } })
    // Los marcadores son lo único a la altura de la mirada: ningún vértice de esa
    // banda puede quedar fuera de las paredes.
    for (let i = 0; i < m.posicion.length; i += 3) {
      const [x, y, z] = [m.posicion[i], m.posicion[i + 1], m.posicion[i + 2]]
      if (y < 1.4) continue
      expect(Math.abs(x)).toBeLessThanOrEqual(8)
      expect(Math.abs(z)).toBeLessThanOrEqual(5.5)
    }
  })
})

/**
 * LA SALA NO CUELGA DE LOS NÚMEROS DE LA SERIE.
 *
 * Nace en rojo el 2026-09-10. Hasta ese día `construirSala` exigía los datos de la serie y
 * la habitación entera colgaba de ellos, así que un día de cardio —que no tiene series ni
 * repeticiones— abría el salón **sin gimnasio**: el sujeto sobre negro y con el encuadre de
 * estudiar un patrón. Una sala es una sala haya o no serie; lo que depende de los números es
 * el marcador, y solo él.
 */
describe('la sala se construye haya o no algo que marcar', () => {
  const cifras = cifrasDeLaSerie({ series: 3, reps: 8, rir: 2 as const })

  it('sin cifras sigue habiendo habitación', () => {
    const m = new Malla()
    construirSala(m, undefined, 72)
    expect(m.vertices).toBeGreaterThan(0)
  })

  it('y lo que falta es exactamente el marcador, no la sala', () => {
    const con = new Malla()
    construirSala(con, cifras, 72)
    const sin = new Malla()
    construirSala(sin, undefined, 72)
    expect(sin.vertices).toBeLessThan(con.vertices)
    // Los cuatro marcadores son una parte del mobiliario, no la mitad de la sala: si esto
    // se cae, es que se ha llevado por delante algo más que los paneles.
    expect(sin.vertices).toBeGreaterThan(con.vertices * 0.5)
  })

  it('la casilla del esfuerzo se APAGA cuando no está escrito, y no se pone a cero', () => {
    const apagada = new Malla()
    construirSala(apagada, { veces: 3, cuanto: 30, esfuerzo: undefined }, 72)
    const encendida = new Malla()
    construirSala(encendida, { veces: 3, cuanto: 30, esfuerzo: 8 }, 72)
    // Un cero ahí diría «RIR 0», que es otra cosa. Sin casilla, el muro dice lo único
    // cierto: que eso no está escrito.
    expect(apagada.vertices).toBeLessThan(encendida.vertices)
    const cero = new Malla()
    construirSala(cero, { veces: 3, cuanto: 30, esfuerzo: 0 }, 72)
    expect(apagada.vertices).not.toBe(cero.vertices)
  })
})
