import { describe, expect, it } from 'vitest'
import {
  asentarEnLaBanda,
  MARGEN_ARRIBA,
  proyectarCuadro,
  SUELO_DE_CUADRO,
  type CamaraDelSalon,
  type SitioDePared,
} from './geometriaDeCuadro'
import { SITIOS, sitioEn } from './sitiosDeLaPared'
import { ENCUADRE_SALA } from '../../escena/sala'

/**
 * QUE LOS CUADROS ESTÉN EN LA PANTALLA. No que estén en el DOM: en la pantalla.
 *
 * El 2026-09-03 el salón se abría con los tres cuadros montados, con su texto y su marco,
 * y **entre 629 y 861 píxeles por encima del borde de arriba** de un 390 × 844. Ninguna
 * prueba se puso en rojo, porque ninguna miraba dónde caían: jsdom no proyecta nada y el
 * DOM decía que los tres existían.
 *
 * La causa no era un error de cuentas. Las alturas de `sitiosDeLaPared.ts` se midieron con
 * la cámara del salón a **6°**, que es la elevación de los patrones de pie; pero la
 * elevación la pone cada patrón y en el catálogo va **de 2° a 56°**, porque un ejercicio
 * tumbado se estudia desde arriba. Cuanto más mira la cámara al suelo, más sube el muro en
 * la pantalla.
 *
 * Estas pruebas fijan las dos mitades: que la proyección sigue siendo la misma que dibuja
 * la escena, y que el asentado deja el cuadro dentro del cuadro para toda la horquilla de
 * elevaciones en la que el muro se ve.
 */

const CAMARA = (elevacion: number): CamaraDelSalon => ({
  azimut: 34,
  elevacion,
  distancia: ENCUADRE_SALA.distancia,
})

const ANCHO = 390
const ALTO = 844

/** El cuadro grande del ejercicio, resuelto contra un ángulo de entrada cualquiera. */
const CUADRO_DEL_EJERCICIO: SitioDePared = sitioEn(SITIOS.ejercicio, 34)

/**
 * El borde de arriba del cuadro, en píxeles de la pantalla, MIRÁNDOLO DE FRENTE.
 *
 * De frente y no desde un azimut cualquiera, porque eso es lo que el asentado promete: que
 * **cuando estás mirando el cuadro, está entero**. Girado 80° hacia otro lado el cuadro se
 * va por el borde igual que se iría un cuadro de verdad al volver la cabeza, y eso no es un
 * fallo: es la mitad de lo que dice que está en la pared y no pegado al cristal.
 */
function bordeDeArriba(sitio: SitioDePared, camara: CamaraDelSalon): number {
  const c = proyectarCuadro(sitio, { ...camara, azimut: sitio.azimut - 180 }, ANCHO, ALTO)
  return c.y - (sitio.alto / 2) * c.escala
}

describe('asentarEnLaBanda', () => {
  /**
   * LA PRUEBA QUE HABRÍA CAZADO EL FALLO. Sin asentar, el cuadro se va por arriba en
   * cuanto la cámara pasa de unos 12°; con seis de las elevaciones del catálogo por
   * encima de eso, es una de cada cuatro sesiones.
   */
  it('sin asentar, un patrón tumbado deja el cuadro fuera de la pantalla por arriba', () => {
    const alto = bordeDeArriba(CUADRO_DEL_EJERCICIO, CAMARA(46))
    expect(alto, 'la premisa de este archivo ya no se cumple').toBeLessThan(-300)
  })

  it('asentado, el cuadro no se sale por arriba en ninguna elevación con muro a la vista', () => {
    // Hasta 10° inclusive. No es un número elegido: es hasta donde llega el muro con este
    // cuadro y este suelo, medido abajo. Cubre 22 de los 32 patrones del catálogo.
    for (const elevacion of [0, 2, 4, 6, 8, 10]) {
      const { sitio, cabe } = asentarEnLaBanda(CUADRO_DEL_EJERCICIO, CAMARA(elevacion), ANCHO, ALTO)
      expect(cabe, `a ${elevacion}° el cuadro no cupo`).toBe(true)
      expect(
        bordeDeArriba(sitio, CAMARA(elevacion)),
        `a ${elevacion}° el borde de arriba quedó en ${bordeDeArriba(sitio, CAMARA(elevacion))}`,
      ).toBeGreaterThanOrEqual(MARGEN_ARRIBA - 0.5)
    }
  })

  it('solo baja el cuadro: nunca lo sube ni lo mueve de azimut', () => {
    for (const elevacion of [0, 2, 6, 12, 26, 46]) {
      const { sitio } = asentarEnLaBanda(CUADRO_DEL_EJERCICIO, CAMARA(elevacion), ANCHO, ALTO)
      expect(sitio.altura).toBeLessThanOrEqual(CUADRO_DEL_EJERCICIO.altura + 1e-9)
      expect(sitio.azimut).toBe(CUADRO_DEL_EJERCICIO.azimut)
      expect(sitio.ancho).toBe(CUADRO_DEL_EJERCICIO.ancho)
    }
  })

  it('no baja del suelo donde el cuerpo del sujeto empieza a taparlo', () => {
    for (const elevacion of [26, 32, 40, 46, 56]) {
      const { sitio } = asentarEnLaBanda(CUADRO_DEL_EJERCICIO, CAMARA(elevacion), ANCHO, ALTO)
      expect(sitio.altura, `a ${elevacion}° bajó a ${sitio.altura} m`).toBeGreaterThanOrEqual(
        SUELO_DE_CUADRO - 1e-9,
      )
    }
  })

  /**
   * EL MANDO DE REGISTRAR YA CUELGA A 1,5 m, por debajo del suelo del asentado. Un suelo
   * global se lo habría SUBIDO medio metro sin que nadie lo pidiera, así que el suelo de
   * cada cuadro es el menor entre 1,9 m y su propia altura declarada.
   */
  it('un cuadro declarado más bajo que el suelo no se sube', () => {
    const mando = sitioEn(SITIOS.registro, 34)
    const { sitio } = asentarEnLaBanda(mando, CAMARA(6), ANCHO, ALTO)
    expect(sitio.altura).toBeLessThanOrEqual(mando.altura + 1e-9)
  })

  /**
   * LO QUE EL ASENTADO NO PUEDE ARREGLAR, dicho por el propio código. A partir de unos
   * 32° el cono de la cámara cae entero sobre el suelo: no hay ninguna altura del muro de
   * enfrente que se vea, ni siquiera su zócalo. `cabe: false` es la señal de que ahí la
   * decisión no es una altura.
   */
  it('avisa cuando no hay altura posible: el muro entero queda fuera del cuadro', () => {
    for (const elevacion of [32, 40, 46, 56]) {
      const { cabe } = asentarEnLaBanda(CUADRO_DEL_EJERCICIO, CAMARA(elevacion), ANCHO, ALTO)
      expect(cabe, `a ${elevacion}° dijo que cabía`).toBe(false)
    }
  })

  /**
   * EL TECHO DE ELEVACIÓN, CLAVADO EN UNA PRUEBA.
   *
   * El cuadro del ejercicio es el más alto de los nueve —lleva cinco campos— y por eso es
   * el que decide hasta dónde llega el salón: **10°**, que cubre 22 de los 32 patrones del
   * catálogo. Por encima ya no hay altura de muro que lo deje entero sin meterlo en el
   * cuerpo del sujeto.
   *
   * Está escrito como prueba y no como comentario porque es el número que hay que mirar
   * cuando se le añada un campo: si el techo baja, el que lo baje se entera aquí y no en
   * el teléfono de Bryan. Y si sube, también — subirlo es la forma de que el salón valga
   * para más patrones.
   */
  it('el techo del cuadro del ejercicio son 10° de elevación', () => {
    let techo = -1
    for (let e = 0; e <= 60; e++) {
      if (!asentarEnLaBanda(CUADRO_DEL_EJERCICIO, CAMARA(e), ANCHO, ALTO).cabe) break
      techo = e
    }
    expect(techo).toBe(10)
  })

  it('a las elevaciones bajas deja la altura declarada como está', () => {
    const { sitio, cabe } = asentarEnLaBanda(CUADRO_DEL_EJERCICIO, CAMARA(2), ANCHO, ALTO)
    expect(cabe).toBe(true)
    expect(sitio.altura).toBe(CUADRO_DEL_EJERCICIO.altura)
  })
})
