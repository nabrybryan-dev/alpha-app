import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CuentaDeRendimiento,
  memoriaObservableMb,
  montarMedidor,
  percentil,
  pideMedir,
  resumenDeFotogramas,
  UMBRAL_LENTO,
} from './rendimiento'

/**
 * EL MEDIDOR, PROBADO CON NÚMEROS INVENTADOS.
 *
 * Lo que decide una cifra —el percentil, la cuenta de lentos, las vueltas de segundo
 * plano— no necesita navegador, así que se prueba con una lista de milisegundos escrita a
 * mano. Lo único que se comprueba montando algo es lo más importante de todo: que **sin la
 * bandera no se monta nada**. Un instrumento que se cuela en la app de un asesorado le
 * cobra un `requestAnimationFrame` por segundo a cambio de nada.
 */

describe('el percentil', () => {
  it('no interpola: el número que da es un fotograma que ocurrió', () => {
    const muestras = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    expect(percentil(muestras, 50)).toBe(50)
    expect(percentil(muestras, 95)).toBe(100)
    expect(percentil(muestras, 10)).toBe(10)
  })

  it('desordenado da lo mismo, y vacío no revienta', () => {
    expect(percentil([70, 10, 30, 90, 50], 50)).toBe(50)
    expect(percentil([], 95)).toBe(0)
  })
})

describe('el resumen de una tanda de fotogramas', () => {
  /**
   * Una tanda con tirón: 96 fotogramas de 16 ms (60 fps limpios) y 4 de 120 ms. La media
   * saldría en 20 ms —«50 fps, todo bien»— y así es como se pierde un tirón: el p95 y la
   * cuenta de lentos son los que lo enseñan.
   */
  const conTiron = [...Array(96).fill(16), ...Array(4).fill(120)]

  it('da p50, p95 y la cuenta de lentos', () => {
    const r = resumenDeFotogramas(conTiron)
    expect(r.p50).toBe(16)
    expect(r.p95).toBe(16)
    expect(percentil(conTiron, 97)).toBe(120)
    expect(r.lentos).toBe(4)
    expect(r.fps).toBe(63)
  })

  it('el umbral de lento son 33 ms, y es estricto', () => {
    expect(resumenDeFotogramas([UMBRAL_LENTO]).lentos).toBe(0)
    expect(resumenDeFotogramas([UMBRAL_LENTO + 0.1]).lentos).toBe(1)
  })

  it('sin fotogramas no inventa fps', () => {
    expect(resumenDeFotogramas([])).toEqual({ fps: 0, p50: 0, p95: 0, lentos: 0 })
  })
})

describe('la cuenta', () => {
  it('junta fotogramas, ejercicios, capas y vueltas de segundo plano', () => {
    const cuenta = new CuentaDeRendimiento(1000)
    for (const ms of [16, 16, 17, 40, 16, 16, 90, 16]) cuenta.fotograma(ms)
    cuenta.cambioDeEjercicio()
    cuenta.cambioDeEjercicio()
    cuenta.capaVisitada(0)
    cuenta.capaVisitada(2)
    cuenta.capaVisitada(0)
    cuenta.vueltaDeSegundoPlano()

    const informe = cuenta.informe(11_000)
    expect(informe.lentos).toBe(2)
    expect(informe.fotograma.p50).toBe(16)
    expect(informe.fotograma.p95).toBe(90)
    expect(informe.cambiosDeEjercicio).toBe(2)
    // Las capas, en orden de PRIMERA visita y sin repetir: volver a la piel no es una capa
    // nueva, y lo que hace falta saber es por dónde se pasó.
    expect(informe.capasVisitadas).toEqual([0, 2])
    expect(informe.vueltasDeSegundoPlano).toBe(1)
    expect(informe.muestras).toBe(8)
    expect(informe.segundos).toBe(10)
  })

  it('descarta el fotograma monstruoso de volver de segundo plano', () => {
    const cuenta = new CuentaDeRendimiento(0)
    cuenta.fotograma(16)
    // 42 segundos con la app detrás: eso no midió a nadie dibujando nada, y colado en la
    // lista se lleva el p95 de calle.
    cuenta.fotograma(42_000)
    cuenta.fotograma(16)
    expect(cuenta.informe(0).muestras).toBe(2)
    expect(cuenta.informe(0).fotograma.p95).toBe(16)
  })

  it('la memoria es un dato que puede no existir, y entonces es null y no cero', () => {
    const p = performance as Performance & { memory?: { usedJSHeapSize?: number } }
    expect(memoriaObservableMb()).toBe(p.memory ? expect.any(Number) : null)
  })
})

describe('la bandera de la URL', () => {
  it('solo `medir=1` cuenta', () => {
    expect(pideMedir('?medir=1')).toBe(true)
    expect(pideMedir('?otra=x&medir=1')).toBe(true)
    expect(pideMedir('?medir=0')).toBe(false)
    expect(pideMedir('?medir')).toBe(false)
    expect(pideMedir('')).toBe(false)
  })
})

describe('montar el medidor', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('SIN la bandera no monta nada: ni nodo, ni bucle, ni oyentes', () => {
    const rAF = vi.fn()
    vi.stubGlobal('requestAnimationFrame', rAF)
    const oyente = vi.spyOn(document, 'addEventListener')

    expect(montarMedidor({ busqueda: '' })).toBeNull()
    expect(montarMedidor({ busqueda: '?medir=0' })).toBeNull()
    expect(document.querySelector('[data-medidor]')).toBeNull()
    expect(rAF).not.toHaveBeenCalled()
    // Del `document` no se cuelga nada: el arnés de pruebas engancha lo suyo, así que se
    // mira POR TIPO y no por «ninguna llamada».
    expect(oyente.mock.calls.map(([tipo]) => tipo)).not.toContain('visibilitychange')
    oyente.mockRestore()
  })

  it('con la bandera se monta, cuenta la vuelta de segundo plano y se desmonta entero', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const medidor = montarMedidor({ busqueda: '?medir=1' })
    expect(medidor).not.toBeNull()
    expect(document.querySelector('[data-medidor="rendimiento"]')).not.toBeNull()
    expect(medidor?.nodo.querySelector('button')?.textContent).toBe('Copiar informe')

    document.dispatchEvent(new Event('visibilitychange'))
    expect(medidor?.informe().vueltasDeSegundoPlano).toBe(1)

    medidor?.desmontar()
    expect(document.querySelector('[data-medidor]')).toBeNull()
    document.dispatchEvent(new Event('visibilitychange'))
    expect(medidor?.informe().vueltasDeSegundoPlano).toBe(1)
  })
})

/**
 * LO QUE VE EL OBSERVADOR DEL DOM, Y LO QUE SE LE ESCAPA SI MIRA EL ESTADO FINAL.
 *
 * Un `MutationObserver` NO se despierta una vez por cambio: se despierta una vez por LOTE,
 * ya con el DOM en su estado final. Un salón que encadena tres ejercicios sin ceder el hilo
 * —lo normal cuando la app repinta una serie entera de golpe— llega a la callback como un
 * único aviso en el que solo se ve el último rótulo. Mirar el DOM en ese momento cuenta UNA
 * transición donde hubo tres, y por eso lo que hay que recorrer son los `MutationRecord`
 * con su `oldValue`: ahí sí está cada escalón por el que se pasó.
 */
describe('el observador cuenta transiciones, no el estado final del lote', () => {
  /** El salón tal y como lo publica la app: la capa en el contenedor, el ejercicio en el lienzo. */
  function montarSalon(w: string, rotulo: string) {
    const salon = document.createElement('div')
    salon.setAttribute('data-salon', 'entrenar')
    salon.setAttribute('data-w', w)
    const lienzo = document.createElement('canvas')
    lienzo.setAttribute('aria-label', rotulo)
    salon.appendChild(lienzo)
    document.body.appendChild(salon)
    return { salon, lienzo }
  }

  /**
   * Deja pasar el lote. Los avisos del observador se entregan en una microtarea, así que
   * hasta que no se cede el hilo la cuenta todavía no se ha enterado de nada.
   */
  const lote = () => new Promise((listo) => setTimeout(listo, 0))

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('tres ejercicios encadenados dentro de un mismo lote son tres cambios', async () => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const { lienzo } = montarSalon('0', 'sentadilla')
    const medidor = montarMedidor({ busqueda: '?medir=1' })

    // Los tres saltos ocurren sin ceder el hilo: cuando la callback mire el DOM ya solo
    // queda «peso muerto», y las dos paradas de en medio no dejaron rastro en él.
    lienzo.setAttribute('aria-label', 'zancada')
    lienzo.setAttribute('aria-label', 'remo')
    lienzo.setAttribute('aria-label', 'peso muerto')
    await lote()

    expect(medidor?.informe().cambiosDeEjercicio).toBe(3)
    medidor?.desmontar()
  })

  it('las capas atravesadas dentro de un mismo lote quedan todas, y en orden', async () => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const { salon } = montarSalon('0', 'sentadilla')
    const medidor = montarMedidor({ busqueda: '?medir=1' })

    // Atravesar la piel, el músculo y el hueso de un tirón es haber PASADO por los tres:
    // un informe que solo anota el destino no distingue eso de haber saltado directo.
    salon.setAttribute('data-w', '1')
    salon.setAttribute('data-w', '2')
    salon.setAttribute('data-w', '3')
    await lote()

    expect(medidor?.informe().capasVisitadas).toEqual([0, 1, 2, 3])
    medidor?.desmontar()
  })
})
