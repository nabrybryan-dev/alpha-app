import { describe, expect, it } from 'vitest'
import { ALTURA_DEL_TOBILLO, ESQUELETO, puntoDeHueso, resolverConApoyo } from '../../../domain/patrones/esqueleto'
import { BAHIA } from '../../../domain/escenario/laboratorio'
import { proyectarCuadro } from '../salon/paredes/geometriaDeCuadro'
import { ENCUADRE_SALA, SALA } from './sala'
import {
  ALTURA_DE_LA_PELVIS,
  azimutDe,
  azimutDeCamaraDesdeSala,
  CARTA,
  puntoEnElSuelo,
  TALLA,
} from './carta'

/**
 * LA CARTA DEL ESPACIO, CONTRASTADA CON LOS OBJETOS DE VERDAD.
 *
 * La carta DICE dónde está cada cosa; esto comprueba que los objetos que de verdad se
 * dibujan están ahí. Nada de aquí lee la carta para probar la carta: cada afirmación se
 * mide sobre el esqueleto resuelto, la sala construida o el proyector real. Si la carta y
 * el espacio se separan, es el espacio el que manda y esto el que avisa.
 *
 * Cada prueba se vio fallar con un señuelo antes de darla por buena —cambiar un signo en
 * `azimutDe`, mover la derecha a +X— que es la regla de este repo para una prueba que
 * nace verde.
 */

/** El sujeto de pie, en posición anatómica, con los pies en el suelo. */
function dePie() {
  return resolverConApoyo({}, [0, 0, 0], [0, 0, 0], 'suelo', undefined, ['D', 'I'])
}

const pelvisDeReferencia = ESQUELETO.find((h) => h.nombre === 'pelvis')

describe('la carta del espacio · el sujeto', () => {
  it('el suelo es Y = 0: la PLANTA está en el suelo y el hueso del pie, a la altura del tobillo', () => {
    // El hueso del pie es la línea del tobillo, no la planta: la planta está
    // `ALTURA_DEL_TOBILLO` más abajo, hacia +Z local del pie. Esta prueba nació midiendo el
    // hueso y pidiéndole que estuviera en el suelo — que es exactamente el error de la
    // sonda que hundía al sujeto. Se mide lo que toca el suelo, que es la planta.
    const esq = dePie()
    for (const pie of ['pieD', 'pieI']) {
      for (const t of [0, 0.5, 1]) {
        const planta = puntoDeHueso(esq, pie, t, [0, 0, ALTURA_DEL_TOBILLO])
        expect(Math.abs(planta[1]), `${pie} en t=${t}`).toBeLessThan(0.005)
      }
    }
  })

  /**
   * EL SUJETO MIDE LO QUE DICE MEDIR — y no lo hacía.
   *
   * Estas dos pruebas nacieron en rojo el 2026-09-04: la pelvis salía a 0,844 y la coronilla
   * a 1,584, el cuerpo entero hundido 10,6 cm en la placa. La sonda de la suela de
   * `resolverConApoyo` apuntaba hacia ARRIBA por un signo —el −Z local del pie es el +Y del
   * mundo— y el solver pisaba contra el suelo un punto que estaba por encima del tobillo.
   * Arreglado con `ALTURA_DEL_TOBILLO` en `esqueleto.ts`, y estas dos son la guarda: el día
   * que alguien vuelva a tocar la sonda, aquí se ve.
   */
  it('la pelvis de pie está a la altura que dice la carta', () => {
    expect(pelvisDeReferencia?.desde[1]).toBe(ALTURA_DE_LA_PELVIS)
    const esq = dePie()
    expect(puntoDeHueso(esq, 'pelvis', 0)[1]).toBeCloseTo(ALTURA_DE_LA_PELVIS, 2)
  })

  it('mide lo que dice la talla: la coronilla ronda 1,70 m', () => {
    const esq = dePie()
    const coronilla = puntoDeHueso(esq, 'craneo', 1)[1]
    expect(coronilla).toBeGreaterThan(TALLA - 0.03)
    expect(coronilla).toBeLessThan(TALLA + 0.03)
  })

  it('el tobillo queda a su altura, no bajo el suelo', () => {
    // Antes del arreglo estaba a −0,030: tres centímetros por debajo de la placa.
    const esq = dePie()
    for (const pie of ['pieD', 'pieI']) {
      expect(puntoDeHueso(esq, pie, 0)[1], `${pie}`).toBeCloseTo(ALTURA_DEL_TOBILLO, 2)
    }
  })

  it('la DERECHA anatómica cae en −X: es el sujeto del espejo', () => {
    // Si alguien pusiera la derecha en +X, el sujeto saldría espejado y se vería «casi
    // bien»: es el fallo que más silencio hace y el que más daño hace a quien corrige su
    // técnica mirándolo.
    const esq = dePie()
    expect(puntoDeHueso(esq, 'brazoD', 0)[0]).toBeLessThan(0)
    expect(puntoDeHueso(esq, 'brazoI', 0)[0]).toBeGreaterThan(0)
    expect(puntoDeHueso(esq, 'musloD', 0)[0]).toBeLessThan(0)
    expect(puntoDeHueso(esq, 'musloI', 0)[0]).toBeGreaterThan(0)
    expect(CARTA.sujeto.derecha).toEqual([-1, 0, 0])
  })

  it('mira hacia +Z: la punta del pie está más adelante que el talón', () => {
    const esq = dePie()
    for (const pie of ['pieD', 'pieI']) {
      const talon = puntoDeHueso(esq, pie, 0)
      const punta = puntoDeHueso(esq, pie, 1)
      expect(punta[2], `${pie} apunta hacia atrás`).toBeGreaterThan(talon[2])
    }
    expect(CARTA.sujeto.mira).toEqual([0, 0, 1])
  })

  it('su plano sagital es X = 0: la columna está centrada', () => {
    const esq = dePie()
    for (const hueso of ['pelvis', 'lumbar', 'torax', 'cuello', 'craneo']) {
      expect(Math.abs(puntoDeHueso(esq, hueso, 0.5)[0]), hueso).toBeLessThan(0.01)
    }
  })
})

describe('la carta del espacio · la sala', () => {
  it('los radios van de dentro afuera: placa < bahía < suelo < pared', () => {
    const { placa, bahia, suelo, pared } = CARTA.radios
    expect(placa).toBeLessThan(bahia)
    expect(bahia).toBeLessThan(suelo)
    expect(suelo).toBeLessThan(pared)
    // Y son los de verdad, no una copia: la carta es un índice.
    expect(placa).toBe(BAHIA.radioPlaca)
    expect(pared).toBe(SALA.radio)
  })

  it('la pared está más lejos que la cámara: nunca se interpone', () => {
    // Y más lejos que el tope de la órbita, que son 6,5 m en `motor.ts`. Con la pared
    // dentro del radio de órbita, media vuelta la pondría delante del sujeto.
    expect(SALA.radio).toBeGreaterThan(ENCUADRE_SALA.distancia)
    expect(SALA.radio).toBeGreaterThan(6.5)
  })

  it('la estación de grabación está fuera de la bahía y dentro de la pared', () => {
    expect(SALA.estacion.distancia).toBeGreaterThan(BAHIA.radioPlaca)
    expect(SALA.estacion.distancia).toBeLessThan(SALA.radio)
  })
})

describe('la carta del espacio · las dos convenciones de ángulo', () => {
  it('azimutDe y puntoEnElSuelo son inversas, con 0 en +Z', () => {
    expect(azimutDe(0, 1)).toBeCloseTo(0, 6)
    expect(azimutDe(1, 0)).toBeCloseTo(90, 6)
    expect(azimutDe(0, -1)).toBeCloseTo(180, 6)
    expect(azimutDe(-1, 0)).toBeCloseTo(270, 6)
    for (const a of [0, 33, 90, 180, 247, 359]) {
      const [x, , z] = puntoEnElSuelo(2, a)
      expect(azimutDe(x, z), `ida y vuelta en ${a}`).toBeCloseTo(a, 6)
    }
  })

  it('la convención de la cámara es la del PROYECTOR de los cuadros', () => {
    // La cámara a azimut 0 está en +Z mirando al centro. Lo que tiene ENFRENTE es el
    // muro de azimut 180, y ese muro tiene que caer centrado en la pantalla. Si el
    // proyector midiera el azimut de otra forma, el muro de enfrente saldría a un lado.
    const enfrente = proyectarCuadro({ azimut: 180, altura: 2, ancho: 1, alto: 0.5 }, { azimut: 0, elevacion: 6, distancia: 4.6 }, 390, 844)
    expect(enfrente.visible).toBe(true)
    expect(Math.abs(enfrente.x - 195)).toBeLessThan(1)
    // Y el muro de azimut 0 está DETRÁS de la cámara: no se ve.
    const detras = proyectarCuadro({ azimut: 0, altura: 2, ancho: 1, alto: 0.5 }, { azimut: 0, elevacion: 6, distancia: 4.6 }, 390, 844)
    expect(detras.visible).toBe(false)
  })

  it('la SALA mide con 0 en +X, y la conversión a cámara es 90 − a', () => {
    // Lo que hace `sala.ts` para plantar la estación: `x = cos(a)`, `z = sin(a)`.
    const a = SALA.estacion.anguloGrados
    const rad = (a * Math.PI) / 180
    const x = Math.cos(rad) * SALA.estacion.distancia
    const z = Math.sin(rad) * SALA.estacion.distancia
    // Ese mismo punto, leído con la convención de la cámara:
    expect(azimutDe(x, z)).toBeCloseTo(azimutDeCamaraDesdeSala(a), 6)
  })

  it('«la estación está a 180°» y «está en el perfil derecho» son la misma frase', () => {
    // 180° de sala = −X = la derecha anatómica del sujeto = 270° de cámara. Es la frase
    // que ha confundido dos veces: no hay contradicción, hay dos convenciones.
    expect(SALA.estacion.anguloGrados).toBe(180)
    expect(azimutDeCamaraDesdeSala(180)).toBeCloseTo(270, 6)
    const [x, , z] = puntoEnElSuelo(SALA.estacion.distancia, 270)
    expect(x).toBeLessThan(0)
    expect(Math.abs(z)).toBeLessThan(1e-9)
  })

  it('la estación se ve de frente cuando la cámara mira desde su lado opuesto', () => {
    // Con la cámara en el azimut de la estación + 180 —o sea enfrente de ella— el
    // trípode cae en el centro de la pantalla. Es lo que `salon-la-estacion-se-representa`
    // midió como «solo entra en cuadro entre 76° y 104° de entrada»: 90° es el centro.
    const azimutEstacion = azimutDeCamaraDesdeSala(SALA.estacion.anguloGrados)
    const c = proyectarCuadro(
      { azimut: azimutEstacion, altura: 1, ancho: 0.5, alto: 0.5 },
      { azimut: azimutEstacion - 180, elevacion: 6, distancia: 4.6 },
      390,
      844,
      SALA.estacion.distancia,
    )
    expect(c.visible).toBe(true)
    expect(Math.abs(c.x - 195)).toBeLessThan(1)
    expect(azimutEstacion - 180).toBeCloseTo(90, 6)
  })
})
