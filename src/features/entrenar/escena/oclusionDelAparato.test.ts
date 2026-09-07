import { describe, expect, it } from 'vitest'
import { PATRON_POR_ID } from '../../../domain/patrones/catalogo'
import { implementosDeEscena } from './implementos'
import {
  ALFA_DEL_APARATO_QUE_TAPA,
  aparatoTapaAlCuerpo,
  parteDelCuerpoTapada,
  partirImplementos,
  UMBRAL_DE_OCLUSION,
} from './oclusionDelAparato'

/**
 * EL GUARDIÁN DE LA OCLUSIÓN.
 *
 * Con el press de pecho en máquina por fin dentro del cuadro (2026-09-05), lo que se veía
 * era una plancha gris con dos manos asomando: la máquina tapaba el 36 % de la persona. Se
 * midió sobre los 24 ejemplos con aparato, en la peor de tres fases, y salieron dos grupos
 * —36, 24, 19, 14 y 10 por un lado; 5, 2 y ceros por el otro—. El tope va en el hueco.
 */

const aparatoDe = (id: string, nombre: string) =>
  partirImplementos(implementosDeEscena(PATRON_POR_ID[id].categoria, nombre)).aparato

describe('el aparato que tapa a la persona', () => {
  /** El caso que lo empezó todo, con el nombre que lleva en la demo. */
  it('en el press de pecho en máquina la máquina tapa más de un cuarto del cuerpo', () => {
    const tapado = parteDelCuerpoTapada(PATRON_POR_ID.empuje_horizontal, aparatoDe('empuje_horizontal', 'Press de pecho en máquina'))
    expect(tapado).toBeGreaterThan(0.25)
    expect(aparatoTapaAlCuerpo(PATRON_POR_ID.empuje_horizontal, aparatoDe('empuje_horizontal', 'Press de pecho en máquina'))).toBe(true)
  })

  it('en la elevación lateral en polea la columna se planta delante del hombro', () => {
    expect(aparatoTapaAlCuerpo(PATRON_POR_ID.abduccion_hombro, aparatoDe('abduccion_hombro', 'Elevación lateral en polea'))).toBe(true)
  })

  /**
   * LA REGLA NO ES POR TIPO DE MÁQUINA. El remo en máquina lleva la misma máquina de
   * placas que el press y no tapa nada: desde su ángulo la pila queda detrás. Si alguien
   * la volviera «placas → translúcida siempre», esto se pone rojo.
   */
  it('la misma máquina de placas NO tapa en el remo ni en la elevación de talones: no se vuelve translúcida', () => {
    // EL REMO PASÓ DE 0 A 7,1 % el 2026-09-06, y no es un empeoramiento: es que la máquina
    // se movió al sitio que le toca. Hasta ese día la de placas se plantaba SIEMPRE detrás
    // del sujeto con un número escrito a mano, y por eso desde el ángulo del remo no tapaba
    // nada: estaba a la espalda del que rema, tirando en la misma dirección en la que él
    // tiraba. Ahora se coloca contra el gesto —delante de quien rema, que es donde está la
    // pila de un remo de verdad— y desde ahí se le cruza por delante un 7,1 % del cuerpo.
    //
    // Sigue por debajo del 8 % del umbral, así que la regla que este test protege se
    // mantiene entera: **no es «placas → translúcida siempre»**. Pero va justo: si alguien
    // toca la colocación y esto se pone rojo, lo que hay que mirar es si el aparato empezó a
    // taparle la cara al sujeto, no si el umbral se quedó corto.
    expect(
      parteDelCuerpoTapada(PATRON_POR_ID.traccion_horizontal, aparatoDe('traccion_horizontal', 'Remo en máquina')),
    ).toBeLessThan(UMBRAL_DE_OCLUSION)
    expect(aparatoTapaAlCuerpo(PATRON_POR_ID.traccion_horizontal, aparatoDe('traccion_horizontal', 'Remo en máquina'))).toBe(false)
    expect(aparatoTapaAlCuerpo(PATRON_POR_ID.flexion_plantar, aparatoDe('flexion_plantar', 'Elevación de talones en máquina'))).toBe(false)
  })

  /**
   * SE MIRA LA PEOR FASE, NO UNA. El press de hombro en máquina tapa 0 % a media
   * repetición y 24 % arriba: medirlo en una sola fase lo dejaba opaco y tapando.
   */
  it('el press de hombro en máquina tapa en el final del gesto, y con eso basta', () => {
    expect(parteDelCuerpoTapada(PATRON_POR_ID.empuje_vertical, aparatoDe('empuje_vertical', 'Press de hombro en máquina'))).toBeGreaterThan(0.15)
    expect(aparatoTapaAlCuerpo(PATRON_POR_ID.empuje_vertical, aparatoDe('empuje_vertical', 'Press de hombro en máquina'))).toBe(true)
  })

  /** Y la caja de pantalla engaña: el Smith flanquea al cuerpo, lo «solapa» entero y no lo tapa. */
  it('el Smith flanquea al cuerpo y no lo tapa', () => {
    expect(parteDelCuerpoTapada(PATRON_POR_ID.sentadilla, aparatoDe('sentadilla', 'Sentadilla en Smith'))).toBe(0)
  })

  it('el tope está en el hueco medido: entre el 5 % que roza y el 10 % que tapa', () => {
    expect(UMBRAL_DE_OCLUSION).toBeGreaterThan(0.05)
    expect(UMBRAL_DE_OCLUSION).toBeLessThan(0.1)
  })

  it('lo que va en las manos nunca es aparato: la barra y las mancuernas quedan opacas', () => {
    const { hierro, aparato } = partirImplementos(implementosDeEscena(PATRON_POR_ID.empuje_horizontal.categoria, 'Press de pecho con barra'))
    expect(hierro.piezas.map((p) => p.pieza)).toContain('barra')
    // Y el aparato NO lleva nada de lo que va en las manos. Desde el 2026-09-06 sí lleva el
    // banco —un press de banca tiene banco, y ese banco visto de lado tapa medio tronco, que
    // es justo el caso para el que existe la translucidez—, así que lo que se afirma es
    // quién NO está, no que esté vacío.
    expect(aparato.piezas.map((p) => p.pieza)).not.toContain('barra')
    expect(aparato.piezas.map((p) => p.pieza)).not.toContain('mancuerna')
    expect(aparato.piezas.map((p) => p.pieza)).toEqual(['banco'])
  })

  it('translúcido no es invisible: el aparato sigue diciendo dónde está', () => {
    expect(ALFA_DEL_APARATO_QUE_TAPA).toBeGreaterThan(0.15)
    expect(ALFA_DEL_APARATO_QUE_TAPA).toBeLessThan(0.5)
  })

  it('sin aparato no hay nada que tape', () => {
    expect(parteDelCuerpoTapada(PATRON_POR_ID.bisagra_cadera, { piezas: [] } as never)).toBe(0)
  })
})
