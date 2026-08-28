import { describe, expect, it } from 'vitest'
import { desvioDe } from '../../../domain/escenario/tripode'
import { juzgarColocacion, lecturasDeColocacion } from './juzgarColocacion'

/**
 * Lo que se prueba aquí NO es la puerta de encuadre —esa tiene sus casos en
 * `pruebas-encuadre.mjs`, dentro del núcleo— sino que **el ensayo dice lo mismo que
 * dirá la toma de verdad**.
 *
 * Es la propiedad que sostiene toda la idea: si el trípode virtual admite una
 * colocación que la grabación real descarta, la sala no está enseñando a encuadrar,
 * está enseñando mal. Y ese fallo saldría en el gimnasio, con la serie ya hecha.
 */

const BUENA = { anguloGrados: 180, distancia: 3.0, altura: 1.0 }

describe('el ensayo de colocación', () => {
  it('la posición que la sala propone es una que la puerta aprueba', () => {
    // Si esto se pone rojo, el sitio marcado en el suelo dejó de ser un sitio válido
    // — o sea, la sala estaría enseñando a plantar el móvil donde no se puede medir.
    expect(juzgarColocacion(BUENA, false).nivel).toBe('buena')
  })

  it('salirse del perfil la degrada, y sin disco antes', () => {
    // Con disco se puede deshacer el escorzo hasta 30°; sin él, `buena` solo hasta 12.
    const torcida = { ...BUENA, anguloGrados: 180 - 18 }
    expect(juzgarColocacion(torcida, true).nivel).toBe('buena')
    expect(juzgarColocacion(torcida, false).nivel).not.toBe('buena')
  })

  it('pasado el tope no hay disco que la salve', () => {
    // Por encima de 30° el reparto entre ejes deja de ser fiable y no hay corrección
    // posible: vale con disco y sin él.
    const muyTorcida = { ...BUENA, anguloGrados: 180 - 40 }
    expect(juzgarColocacion(muyTorcida, true).nivel).not.toBe('buena')
    expect(juzgarColocacion(muyTorcida, true).motivos).toContain('no_es_lateral')
  })

  it('demasiado cerca no cabe el atleta con la barra', () => {
    const pegada = { ...BUENA, distancia: 1.2 }
    expect(juzgarColocacion(pegada, true).motivos).toContain('no_cabe')
  })

  it('la lente por el suelo pierde la escala, pero solo de cerca', () => {
    // MEDIDO, no supuesto, y el resultado enseña algo que no es obvio: `camara_baja`
    // es un tope ANGULAR, así que la distancia lo diluye. A 3 m una lente a 15 cm queda
    // apenas 15° por debajo del eje de cadera y la puerta la admite; hay que acercarse
    // a 2 m para que los mismos 10 cm de altura se conviertan en 23° y salte.
    //
    // O sea que «el móvil está muy bajo» no es una propiedad del móvil: es una
    // propiedad del par altura-distancia. Por eso el ensayo tiene que dejar mover las
    // dos cosas y no solo una.
    expect(juzgarColocacion({ ...BUENA, altura: 0.15 }, true).nivel).toBe('buena')
    const cercaYBaja = { anguloGrados: 180, distancia: 2.0, altura: 0.1 }
    expect(juzgarColocacion(cercaYBaja, true).motivos).toContain('camara_baja')
  })

  it('las lecturas salen del mismo cálculo que el juicio', () => {
    // Si la pantalla enseñara un ancho de escena y la puerta usara otro, el asesorado
    // vería un número que no es el que le están juzgando.
    const l = lecturasDeColocacion(BUENA)
    expect(l.desvio).toBe(desvioDe(BUENA.anguloGrados))
    expect(l.anchoEscenaM).toBeGreaterThan(2.4)
    expect(l.discoPx).toBeGreaterThan(80)
  })
})

describe('el desvío', () => {
  it('mide contra el perfil, que son los dos lados del eje X', () => {
    // El sujeto mira a +Z, así que 0° y 180° son las dos posiciones perpendiculares al
    // plano sagital. Las dos valen: da igual grabar por la derecha o por la izquierda.
    expect(desvioDe(180)).toBe(0)
    expect(desvioDe(0)).toBe(0)
    expect(desvioDe(360)).toBe(0)
    expect(desvioDe(90)).toBe(90) // de frente: el peor sitio posible
    expect(desvioDe(200)).toBe(20)
    expect(desvioDe(160)).toBe(20)
  })
})
