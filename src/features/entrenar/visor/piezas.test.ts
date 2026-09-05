import { describe, expect, it } from 'vitest'
import { escribirPieza } from '../escena/piezas3d'
import { cargarPiezas, PIEZAS_DEL_SALON, sitioDe, TEXTURAS_DE_LAS_PIEZAS } from './piezas'

/**
 * LA CARGA DE LAS PIEZAS, sin red. Se inyecta un `traer` de mentira que resuelve con una
 * pieza de un triángulo, y se comprueba que llega colocada y con su nombre; y que,
 * cancelada, no llega.
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

const espera = () => new Promise((r) => setTimeout(r, 0))

describe('cargarPiezas', () => {
  it('pide cada pieza por su ruta y la entrega colocada, con su nombre', async () => {
    const pedidas: string[] = []
    const llegadas: Record<string, number> = {}
    cargarPiezas(
      (nombre, mallas) => {
        llegadas[nombre] = mallas[0].posicion[0]
      },
      async (ruta) => {
        pedidas.push(ruta)
        return piezaDeUnTriangulo()
      },
    )
    await espera()
    expect(pedidas).toEqual(Object.values(PIEZAS_DEL_SALON).map((p) => p.ruta))
    // El primer vértice estaba en el origen: colocado, cae en la x de su sitio.
    const rack = PIEZAS_DEL_SALON['rack-sentadillas']
    expect(llegadas['rack-sentadillas']).toBeCloseTo(sitioDe(rack).x, 5)
    expect(llegadas['sala-gimnasio']).toBeCloseTo(0, 5)
  })

  it('cancelada, una pieza que llega tarde no se entrega', async () => {
    let llegadas = 0
    const cancelar = cargarPiezas(() => llegadas++, async () => piezaDeUnTriangulo())
    cancelar()
    await espera()
    expect(llegadas).toBe(0)
  })

  it('una pieza que falla no rompe nada', async () => {
    let llegadas = 0
    cargarPiezas(() => llegadas++, async () => {
      throw new Error('404')
    })
    await espera()
    expect(llegadas).toBe(0)
  })

  it('el rack queda entre la órbita y el muro, tangente a la pared', () => {
    const rack = PIEZAS_DEL_SALON['rack-sentadillas']
    expect(rack.radio).toBeGreaterThan(4.6)
    expect(rack.radio).toBeLessThan(7)
    const s = sitioDe(rack)
    expect(Math.hypot(s.x, s.z)).toBeCloseTo(rack.radio, 6)
  })

  it('las imágenes del rack y de la sala están en la lista', () => {
    expect(Object.keys(TEXTURAS_DE_LAS_PIEZAS).sort()).toEqual([
      'gym-atlas', 'hormigon', 'metal-placa', 'rack-acero', 'rack-barra',
    ])
  })

  it('la sala entera va centrada: radio cero, sin giro', () => {
    const sala = PIEZAS_DEL_SALON['sala-gimnasio']
    expect(sitioDe(sala)).toEqual({ x: 0, z: 0, giroY: -0 })
  })
})
