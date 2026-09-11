import { describe, expect, it } from 'vitest'
import { escribirPieza } from '../escena/piezas3d'
import { Malla } from '../../../domain/patrones/malla'
import { INDICE_RAIZ } from '../../../domain/patrones/esqueleto'
import { atlasCargado, atlasPorCapa, cargarPiezas } from './cargaDelAtlas'
import { PIEZAS_DEL_ATLAS, type PiezaDelSalon } from './piezas'

/**
 * LA CARGA, EL ERROR Y EL REINTENTO, PIEZA A PIEZA.
 *
 * Estas cuatro pruebas nacen en rojo contra el código del 2026-09-07, y cada una nombra
 * el mismo fallo por un lado distinto: el atlas se pedía en bloque y el visor se protegía
 * de las repeticiones con un `if (atlasCargado.size > 0) return`, así que **la primera
 * pieza que llegaba cortaba el efecto** y la que hubiera fallado no se pedía nunca más. En
 * pantalla eso es un cuerpo abierto sin músculos, sin un solo error en la consola.
 *
 * Las tres primeras usan listas propias con nombres propios: la memoria de lo que ya
 * llegó es de módulo —tiene que serlo, o volver a abrir la anatomía se bajaría el
 * megabyte otra vez— y dos pruebas sobre la misma pieza se contaminarían.
 */

function piezaDeUnTriangulo(): ArrayBuffer {
  return escribirPieza([
    {
      textura: 'rack-acero',
      posicion: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
      normal: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
      color: new Float32Array(9).fill(1),
      uv: new Float32Array(6),
      indice: new Uint32Array([0, 1, 2]),
    },
  ])
}

/** Una lista de tres piezas con nombres que no usa nadie más. */
const listaDe = (marca: string): Record<string, PiezaDelSalon> => ({
  [`${marca}-uno`]: { ruta: `/piezas/${marca}-uno.pieza`, anguloGrados: 0, radio: 0 },
  [`${marca}-dos`]: { ruta: `/piezas/${marca}-dos.pieza`, anguloGrados: 0, radio: 0 },
  [`${marca}-tres`]: { ruta: `/piezas/${marca}-tres.pieza`, anguloGrados: 0, radio: 0 },
})

/** Deja correr las promesas pendientes. */
const espera = () => new Promise((r) => setTimeout(r, 0))

describe('cargarPiezas, pieza a pieza', () => {
  it('una pieza que falla se vuelve a pedir; las que ya llegaron, no', async () => {
    const lista = listaDe('falla')
    const pedidas: string[] = []
    let redCaida = true
    const traer = async (ruta: string) => {
      pedidas.push(ruta)
      // Solo la segunda se cae, y solo mientras la red esté mal.
      if (ruta.endsWith('falla-dos.pieza') && redCaida) throw new Error('502')
      return piezaDeUnTriangulo()
    }

    const llegadas: string[] = []
    const cancelar = cargarPiezas((nombre) => llegadas.push(nombre), traer, lista)
    await espera()
    expect(llegadas.sort()).toEqual(['falla-tres', 'falla-uno'])
    expect(pedidas).toHaveLength(3)
    cancelar()

    // La red vuelve y el visor pide otra vez: lo único que se pide es lo que falta.
    redCaida = false
    pedidas.length = 0
    const cancelar2 = cargarPiezas((nombre) => llegadas.push(nombre), traer, lista)
    await espera()
    expect(pedidas).toEqual(['/piezas/falla-dos.pieza'])
    expect(llegadas.sort()).toEqual(['falla-dos', 'falla-tres', 'falla-uno'])
    cancelar2()
  })

  it('sin red al arrancar, la reconexión las trae sin que nadie vuelva a llamar', async () => {
    const lista = listaDe('sinred')
    const pedidas: string[] = []
    let redCaida = true
    const traer = async (ruta: string) => {
      pedidas.push(ruta)
      if (redCaida) throw new Error('sin red')
      return piezaDeUnTriangulo()
    }

    const llegadas: string[] = []
    const cancelar = cargarPiezas((nombre) => llegadas.push(nombre), traer, lista)
    await espera()
    expect(llegadas).toEqual([])
    expect(pedidas).toHaveLength(3)

    // Vuelve la red. Nadie vuelve a montar nada: lo dice el navegador y basta.
    redCaida = false
    window.dispatchEvent(new Event('online'))
    await espera()
    expect(llegadas.sort()).toEqual(['sinred-dos', 'sinred-tres', 'sinred-uno'])

    // Y al cancelar se deja de escuchar: una reconexión posterior no pide nada.
    cancelar()
    pedidas.length = 0
    window.dispatchEvent(new Event('online'))
    await espera()
    expect(pedidas).toEqual([])
  })

  it('una pieza que ya llegó no se pide dos veces', async () => {
    const lista = listaDe('unavez')
    const pedidas: string[] = []
    const traer = async (ruta: string) => {
      pedidas.push(ruta)
      return piezaDeUnTriangulo()
    }

    const cancelar = cargarPiezas(() => {}, traer, lista)
    await espera()
    expect(pedidas).toHaveLength(3)
    cancelar()

    // Volver a abrir la anatomía no puede volver a bajar el megabyte.
    pedidas.length = 0
    const cancelar2 = cargarPiezas(() => {}, traer, lista)
    await espera()
    expect(pedidas).toEqual([])
    cancelar2()
  })
})

describe('el almacén del atlas', () => {
  const mallaDePrueba = () => {
    const m = new Malla()
    for (const [x, y] of [[0, 0], [1, 0], [0, 1]]) {
      m.verticeSuelto(x, y, 0, 0, 0, 1, [1, 1, 1], 7)
    }
    m.triangulo(0, 1, 2)
    return m
  }

  it('una descarga a medias NO cuenta como atlas cargado', () => {
    const capas = Object.keys(PIEZAS_DEL_ATLAS).map((n) => n.replace('atlas-', ''))
    expect(capas.length).toBeGreaterThan(1)

    // Llegan todas menos la última: al atlas le falta una pieza, así que el visor tiene
    // que poder volver a pedirla. Con `atlasCargado` lleno, el efecto se cortaba.
    for (const capa of capas.slice(0, -1)) atlasPorCapa.set(capa, [mallaDePrueba()])
    expect(atlasCargado.size).toBe(0)

    // Y con la última, ya está entero.
    atlasPorCapa.set(capas[capas.length - 1], [mallaDePrueba()])
    expect([...atlasCargado].sort()).toEqual([...capas].sort())
  })

  it('lo que llega cuelga de la raíz del sujeto, o se quedaría plantado en el mundo', () => {
    const malla = mallaDePrueba()
    atlasPorCapa.set('esqueleto', [malla])
    expect([...malla.hueso].every((h) => h === INDICE_RAIZ)).toBe(true)
  })
})
