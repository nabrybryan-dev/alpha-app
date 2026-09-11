import { describe, expect, it } from 'vitest'

import {
  BANDA_DE_SESION,
  desvioDelCartel,
  desviosDeLosCarteles,
  HOLGURA_DEL_CARTEL,
  SUELO_DE_LOS_CARTELES,
} from './sitioDelCartel'

/**
 * EL GUARDIÁN DE QUE UN CARTEL NO SE DIBUJA ENCIMA DEL SUJETO.
 *
 * Nace en rojo por lo medido el 2026-09-10 con `testigo/carteles-y-sujeto.mjs`: las cuatro
 * estaciones tapaban entre el 9 % y el 37 % de la TINTA del cuerpo en las trece posiciones
 * de cámara probadas, con la mediana en el 25 %. Aquí no se miden píxeles —eso es del
 * testigo, y hace falta un navegador— sino la decisión: dado dónde cae el cartel y dónde
 * está el cuerpo, hacia dónde se aparta. Las dos medidas hacen falta y ninguna sustituye a
 * la otra: esta corre en milisegundos y no ve un píxel; el testigo ve píxeles y tarda tres
 * minutos.
 *
 * Los dos cuerpos de las pruebas son los dos que de verdad se dan y que piden salidas
 * OPUESTAS: **de pie** (estrecho y de la cabeza a los pies, sin aire arriba ni abajo) y
 * **tumbado en un banco** (una banda que cruza la pantalla, sin aire a los lados).
 */

const MARCO = { arriba: BANDA_DE_SESION, abajo: 844 - SUELO_DE_LOS_CARTELES, ancho: 390 }

/** Un cartel de 132×92 centrado en `x`, con su borde de abajo en `y`. */
function cartel(x: number, y: number) {
  return { x0: x - 66, x1: x + 66, y0: y - 92, y1: y }
}

/** Dónde queda un cartel después de apartarse. */
function tras(c: ReturnType<typeof cartel>, d: { dx: number; dy: number }) {
  return { x0: c.x0 + d.dx, x1: c.x1 + d.dx, y0: c.y0 + d.dy, y1: c.y1 + d.dy }
}

function pisa(c: { x0: number; x1: number; y0: number; y1: number }, cuerpo: typeof DE_PIE) {
  return c.x1 > cuerpo.x0 && c.x0 < cuerpo.x1 && c.y1 > cuerpo.y0 && c.y0 < cuerpo.y1
}

const DE_PIE = { x0: 150, y0: 120, x1: 260, y1: 658 }
const TUMBADO = { x0: 40, y0: 460, x1: 350, y1: 545 }

describe('desvioDelCartel', () => {
  it('no mueve nada si el visor todavía no ha medido el cuerpo', () => {
    expect(desvioDelCartel(cartel(195, 534), undefined, MARCO)).toEqual({ dx: 0, dy: 0 })
  })

  it('no mueve el cartel que está a un lado del cuerpo', () => {
    expect(desvioDelCartel(cartel(60, 534), DE_PIE, MARCO)).toEqual({ dx: 0, dy: 0 })
  })

  it('no mueve el cartel que cae por encima de la cabeza', () => {
    expect(desvioDelCartel(cartel(195, 100), DE_PIE, MARCO)).toEqual({ dx: 0, dy: 0 })
  })

  it('aparta DE LADO el cartel que cae sobre un cuerpo de pie', () => {
    // De pie no hay aire ni sobre la cabeza (36 px) ni bajo los pies (42): el cartel mide
    // 92. El sitio libre está a los lados, y ahí va.
    const d = desvioDelCartel(cartel(195, 534), DE_PIE, MARCO)
    expect(d.dy).toBe(0)
    expect(d.dx).not.toBe(0)
    const puesto = tras(cartel(195, 534), d)
    expect(pisa(puesto, DE_PIE)).toBe(false)
    expect(puesto.x0).toBeGreaterThanOrEqual(0)
    expect(puesto.x1).toBeLessThanOrEqual(MARCO.ancho)
  })

  it('aparta EN VERTICAL el cartel que cae sobre un cuerpo tumbado', () => {
    // Tumbado el cuerpo cruza la pantalla de lado a lado: apartarse en horizontal sacaría el
    // cartel del marco, así que sube —que está más cerca que bajar—.
    const d = desvioDelCartel(cartel(195, 510), TUMBADO, MARCO)
    expect(d.dx).toBe(0)
    expect(d.dy).toBeLessThan(0)
    const puesto = tras(cartel(195, 510), d)
    expect(pisa(puesto, TUMBADO)).toBe(false)
    expect(puesto.y1).toBe(TUMBADO.y0 - HOLGURA_DEL_CARTEL)
  })

  it('baja cuando bajar está más cerca que subir', () => {
    // El mismo cuerpo tumbado y un cartel que lo pisa por su borde de ABAJO: ahí bajar son
    // 27 px y subir 170. Se elige el corto, y por eso hay dos pruebas y no una.
    const d = desvioDelCartel(cartel(195, 620), TUMBADO, MARCO)
    expect(d.dy).toBeGreaterThan(0)
    expect(tras(cartel(195, 620), d).y0).toBe(TUMBADO.y1 + HOLGURA_DEL_CARTEL)
  })

  it('nunca deja el cartel bajo el panel, bajo la nav ni sobre la banda de la sesión', () => {
    const casos = [
      { c: cartel(195, 650), cuerpo: { x0: 40, y0: 600, x1: 350, y1: 690 } },
      { c: cartel(195, 300), cuerpo: { x0: 40, y0: 100, x1: 350, y1: 400 } },
      { c: cartel(195, 400), cuerpo: { x0: 0, y0: 90, x1: 390, y1: 700 } },
    ]
    for (const { c, cuerpo } of casos) {
      const puesto = tras(c, desvioDelCartel(c, cuerpo, MARCO))
      expect(puesto.y0).toBeGreaterThanOrEqual(MARCO.arriba)
      expect(puesto.y1).toBeLessThanOrEqual(MARCO.abajo)
    }
  })

  it('con el cuerpo llenando la pantalla se aparta lo que puede, sin salirse', () => {
    // No hay salida por ningún lado: el contrato es sacar el número del centro del cuerpo,
    // no quedarse quieto. Devolver 0 aquí sería dejarlo en mitad del pecho.
    const cuerpo = { x0: 0, y0: 90, x1: 390, y1: 700 }
    const d = desvioDelCartel(cartel(195, 400), cuerpo, MARCO)
    expect(d.dx === 0 && d.dy === 0).toBe(false)
  })
})

/**
 * EL GUARDIÁN DE QUE UNA CIFRA NO SE ESCRIBE ENCIMA DE OTRA.
 *
 * Nace del mismo sitio que el de arriba y por su culpa: apartar cada cartel del cuerpo,
 * cada uno por su cuenta, los manda a los cuatro al mismo costado libre. Medido en el
 * salón real el 2026-09-11 con `testigo/cifras-que-se-pisan.mjs`: en seis muestras a lo largo de
 * cuatro segundos y medio, SIEMPRE al menos una pareja pisándose, y en cuatro de las seis
 * una cifra entera dentro de otra. La primera prueba de este bloque es esa foto escrita en
 * números: si algún día `desvioDelCartel` dejara de amontonar, esta se pondría roja y
 * habría que borrar el reparto, no arreglarla.
 */
describe('desviosDeLosCarteles', () => {
  /** Los cuatro postes de un cuerpo de pie: dos a cada lado, como los coloca el azimut. */
  const CUATRO = [
    { clave: 'series', natural: cartel(250, 500) },
    { clave: 'reps', natural: cartel(230, 440) },
    { clave: 'descanso', natural: cartel(160, 440) },
    { clave: 'rir', natural: cartel(140, 500) },
  ]

  const parejasQueSePisan = (sitios: { x0: number; x1: number; y0: number; y1: number }[]) => {
    let cuenta = 0
    for (let i = 0; i < sitios.length; i++) {
      for (let j = i + 1; j < sitios.length; j++) {
        const a = sitios[i]
        const b = sitios[j]
        if (a.x1 > b.x0 && a.x0 < b.x1 && a.y1 > b.y0 && a.y0 < b.y1) cuenta++
      }
    }
    return cuenta
  }

  it('DOCUMENTA EL FALLO: apartándose cada uno por su cuenta, se amontonan', () => {
    const sitios = CUATRO.map((c) => tras(c.natural, desvioDelCartel(c.natural, DE_PIE, MARCO)))
    expect(parejasQueSePisan(sitios)).toBeGreaterThan(0)
  })

  it('repartiendo el hueco entre los cuatro, ninguna cifra se escribe sobre otra', () => {
    const reparto = desviosDeLosCarteles(CUATRO, [DE_PIE], MARCO)
    const sitios = CUATRO.map((c) => tras(c.natural, reparto.get(c.clave)!))
    expect(parejasQueSePisan(sitios)).toBe(0)
  })

  it('y ninguno de los cuatro vuelve a pisar al sujeto', () => {
    const reparto = desviosDeLosCarteles(CUATRO, [DE_PIE], MARCO)
    for (const c of CUATRO) {
      expect(pisa(tras(c.natural, reparto.get(c.clave)!), DE_PIE)).toBe(false)
    }
  })

  it('tampoco se amontonan sobre un cuerpo tumbado, que pide salidas opuestas', () => {
    const enBanco = [
      { clave: 'series', natural: cartel(250, 540) },
      { clave: 'reps', natural: cartel(230, 520) },
      { clave: 'descanso', natural: cartel(160, 520) },
      { clave: 'rir', natural: cartel(140, 540) },
    ]
    const reparto = desviosDeLosCarteles(enBanco, [TUMBADO], MARCO)
    const sitios = enBanco.map((c) => tras(c.natural, reparto.get(c.clave)!))
    expect(parejasQueSePisan(sitios)).toBe(0)
    for (const c of enBanco) {
      expect(pisa(tras(c.natural, reparto.get(c.clave)!), TUMBADO)).toBe(false)
    }
  })

  it('al que ya estaba en sitio limpio no lo empuja el que llega', () => {
    // El de la izquierda no toca al cuerpo: su desvío tiene que seguir siendo cero aunque
    // otro venga huyendo hacia él. Es la razón del orden: primero los que no se mueven.
    const reparto = desviosDeLosCarteles(
      [
        { clave: 'quieto', natural: cartel(60, 534) },
        { clave: 'huyendo', natural: cartel(205, 534) },
      ],
      [DE_PIE],
      MARCO,
    )
    expect(reparto.get('quieto')).toEqual({ dx: 0, dy: 0 })
  })

  it('tampoco se suben al tablón del muro, que es texto y también estorba', () => {
    // Medido en el salón el 2026-09-11: el tablón va de x=91 a x=379 y de y=73 a y=201,
    // y un cartel que escapaba hacia arriba aterrizaba encima de sus cuatro cifras. Es el
    // mismo criterio 3 —no pisar otro texto— por el otro lado.
    const TABLON = { x0: 91, y0: 73, x1: 379, y1: 201 }
    // Un cartel plantado justo donde está el tablón: sin decírselo se queda ahí encima.
    const ARRIBA = [{ clave: 'series', natural: cartel(195, 190) }]
    expect(pisa(tras(ARRIBA[0].natural, { dx: 0, dy: 0 }), TABLON)).toBe(true)

    const reparto = desviosDeLosCarteles(ARRIBA, [DE_PIE, TABLON], MARCO)
    expect(pisa(tras(ARRIBA[0].natural, reparto.get('series')!), TABLON)).toBe(false)
    expect(pisa(tras(ARRIBA[0].natural, reparto.get('series')!), DE_PIE)).toBe(false)

    // Y los cuatro de siempre tampoco acaban ahí al repartirse el hueco.
    const cuatro = desviosDeLosCarteles(CUATRO, [DE_PIE, TABLON], MARCO)
    for (const c of CUATRO) {
      expect(pisa(tras(c.natural, cuatro.get(c.clave)!), TABLON)).toBe(false)
      expect(pisa(tras(c.natural, cuatro.get(c.clave)!), DE_PIE)).toBe(false)
    }
  })

  it('el reparto no depende del orden en que lleguen los carteles', () => {
    const alDerecho = desviosDeLosCarteles(CUATRO, [DE_PIE], MARCO)
    const alReves = desviosDeLosCarteles([...CUATRO].reverse(), [DE_PIE], MARCO)
    for (const c of CUATRO) {
      expect(alReves.get(c.clave)).toEqual(alDerecho.get(c.clave))
    }
  })

  it('sin cuerpo medido no esquiva al sujeto, pero las cifras SIGUEN sin pisarse', () => {
    // «No se esquiva lo que no se ha medido» es una regla sobre el SUJETO: en el primer
    // fotograma el visor todavía no ha dicho dónde está el cuerpo. Que una cifra no se
    // escriba encima de otra no necesita medir a nadie —son dos recuadros del mismo
    // fotograma—, así que eso sí se respeta desde el primer fotograma.
    const reparto = desviosDeLosCarteles(CUATRO, [], MARCO)
    const sitios = CUATRO.map((c) => tras(c.natural, reparto.get(c.clave)!))
    expect(parejasQueSePisan(sitios)).toBe(0)
    // Y un cartel que no tiene a nadie al lado no se mueve: sin cuerpo medido no hay de
    // quién esquivarse, que es justo la regla del esquivador de uno solo.
    const solo = desviosDeLosCarteles([{ clave: 'series', natural: cartel(195, 534) }], [], MARCO)
    expect(solo.get('series')).toEqual({ dx: 0, dy: 0 })
  })
})
