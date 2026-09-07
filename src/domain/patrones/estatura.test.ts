import { describe, expect, it } from 'vitest'
import { JUEGOS } from './juegoDeHuesos'
import { esqueletoConJuego } from './juegoDeHuesos'
import { puntoDeHueso, resolver } from './esqueleto'
import {
  ESTATURA_MAXIMA_CM,
  ESTATURA_MINIMA_CM,
  estaturaVigente,
  juegoParaEstatura,
} from './estatura'

/**
 * EL MUÑECO CON LA ESTATURA DEL ASESORADO, comprobado por los dos lados.
 *
 * Lo que se afirma aquí es de dos clases, y la segunda es la que importa: que la persona
 * sale con SU altura —eso es fácil— y que **sale con su altura y no con otra cosa**, o sea
 * que el cuerpo se escala entero y conserva su forma. Estirar solo la coronilla daría un
 * tronco largo sobre piernas de otro, y eso no falla: se ve mal.
 */

describe('el juego a la estatura de una persona', () => {
  it('un asesorado de 1,60 y otro de 1,90 dejan de tener el mismo cuerpo', () => {
    // Es el error grande y el que motivó el encargo. Hasta el 2026-09-06 los dos veían el
    // varón del atlas: 1,714 m, midieran lo que midieran.
    const bajo = juegoParaEstatura(JUEGOS.hombre, 160)
    const alto = juegoParaEstatura(JUEGOS.hombre, 190)
    expect(bajo.coronilla).toBeCloseTo(1.6, 3)
    expect(alto.coronilla).toBeCloseTo(1.9, 3)
    expect(alto.femur - bajo.femur).toBeGreaterThan(0.07)
  })

  it('se escala el cuerpo ENTERO, así que las proporciones no cambian', () => {
    // Lo que impide el tronco largo sobre piernas de otro. Cada razón del juego original
    // tiene que sobrevivir al escalado: si alguien añade un campo de longitud y se olvida
    // de escalarlo, esta prueba lo dice.
    const original = JUEGOS.hombre
    const escalado = juegoParaEstatura(original, 190)
    const k = escalado.coronilla / original.coronilla
    for (const campo of [
      'cadera',
      'femur',
      'tibia',
      'humero',
      'antebrazo',
      'medioHombro',
      'planta',
    ] as const) {
      expect(escalado[campo] / original[campo], `«${campo}» no se escaló`).toBeCloseTo(k, 9)
    }
  })

  it('el esqueleto que sale mide de verdad lo que dice la ficha', () => {
    // La comprobación de punta a punta: no basta con que el JUEGO diga 1,60 — el cuerpo que
    // `esqueletoConJuego` construye con él tiene que MEDIR 1,60. Entre el juego y el hueso
    // hay un repartidor, y es donde se pierden las cosas.
    //
    // Se mide del punto más bajo al más alto de los 21 huesos, que con el sujeto de pie es
    // del tobillo a la coronilla; la planta —lo que hay del tobillo al suelo— se suma
    // aparte, porque el juego la declara para eso.
    for (const cm of [155, 175, 195]) {
      const juego = juegoParaEstatura(JUEGOS.hombre, cm)
      const esq = resolver({}, [0, 0, 0], [0, 0, 0], esqueletoConJuego(juego))
      let alto = -Infinity
      let bajo = Infinity
      for (const hueso of Object.keys(esq.mundo)) {
        for (const t of [0, 1]) {
          const y = puntoDeHueso(esq, hueso, t)[1]
          alto = Math.max(alto, y)
          bajo = Math.min(bajo, y)
        }
      }
      expect(alto - bajo + juego.planta, `${cm} cm`).toBeCloseTo(cm / 100, 2)
    }
  })
})

describe('cuándo NO se escala, que es la mitad honesta', () => {
  it('sin estatura medida el muñeco es el del atlas, no una estimación', () => {
    // No medido no es cero, y tampoco es «lo que suele medir la gente». Sin dato, el
    // sujeto es el de siempre y nadie ha fingido nada.
    expect(juegoParaEstatura(JUEGOS.hombre, undefined)).toBe(JUEGOS.hombre)
  })

  it('una estatura absurda es un dato mal metido, no una persona', () => {
    // Un cero, un metro escrito en metros en vez de centímetros, un dedo de más al teclear.
    // Se ignora en vez de dibujar un muñeco de tres metros o de treinta centímetros.
    for (const mala of [0, 1.75, ESTATURA_MINIMA_CM - 1, ESTATURA_MAXIMA_CM + 1, NaN, Infinity]) {
      expect(juegoParaEstatura(JUEGOS.hombre, mala), `${mala}`).toBe(JUEGOS.hombre)
    }
  })

  it('la estatura del propio juego devuelve el MISMO objeto, no una copia', () => {
    // Para que una caché de esqueletos por identidad no se llene de juegos equivalentes.
    // Va con la estatura EXACTA del juego y no redondeada a centímetros: la mujer del
    // atlas mide 1,6673, así que «167 cm» es un cuerpo 3 mm distinto y merece su juego.
    // Ese redondeo es real —`alturaCm` viene en centímetros enteros— y lo que se afirma
    // aquí es el atajo por identidad, no que se ignoren los milímetros.
    const j = JUEGOS.mujer
    expect(juegoParaEstatura(j, j.coronilla * 100)).toBe(j)
  })
})

describe('qué estatura vale de una ficha', () => {
  it('la de la medida MÁS RECIENTE, no la primera ni la media', () => {
    // Una persona crece, o un día se la mide con zapatos. Lo que hay que dibujar es lo
    // último que se sabe de ella.
    expect(
      estaturaVigente([
        { fecha: '2026-01-10', alturaCm: 170 },
        { fecha: '2026-09-01', alturaCm: 173 },
        { fecha: '2026-05-04', alturaCm: 171 },
      ]),
    ).toBe(173)
  })

  it('se salta las medidas que no traen altura, en vez de rendirse en la primera', () => {
    expect(
      estaturaVigente([
        { fecha: '2026-09-01' },
        { fecha: '2026-05-04', alturaCm: 171 },
      ]),
    ).toBe(171)
  })

  it('sin medidas, o sin ninguna con altura, no hay estatura', () => {
    expect(estaturaVigente(undefined)).toBeUndefined()
    expect(estaturaVigente([])).toBeUndefined()
    expect(estaturaVigente([{ fecha: '2026-09-01' }])).toBeUndefined()
  })
})
