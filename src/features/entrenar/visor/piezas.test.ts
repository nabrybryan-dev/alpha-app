import { describe, expect, it } from 'vitest'
import { escribirPieza } from '../escena/piezas3d'
import { cargarPiezas, PIEZAS_DEL_SALON, sitioDe } from './piezas'
import { TEXTURAS_DEL_SALON } from './texturas'

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

  it('una pieza suelta queda a su radio, tangente a la pared', () => {
    const pieza = { ruta: '/x', anguloGrados: 150, radio: 6.2 }
    const s = sitioDe(pieza)
    expect(Math.hypot(s.x, s.z)).toBeCloseTo(6.2, 6)
    // A 150° la tangente lleva el eje local Z a (−sen 150°, cos 150°): giro −150°.
    expect(s.giroY).toBeCloseTo((-150 * Math.PI) / 180, 9)
  })

  it('todas las imágenes que la sala usa están declaradas, con su color medio', () => {
    // Si el exportador empieza a usar una textura nueva y nadie la declara aquí, la parte
    // se dibuja con la luz desnuda: blanca. Esta lista es la que lo impide.
    expect(Object.keys(TEXTURAS_DEL_SALON).sort()).toEqual([
      'gym-atlas', 'hormigon', 'rack-acero', 'rack-barra', 'suelo-goma',
    ])
  })

  it('la sala entera va centrada: radio cero, sin giro', () => {
    const sala = PIEZAS_DEL_SALON['sala-gimnasio']
    expect(sitioDe(sala)).toEqual({ x: 0, z: 0, giroY: -0 })
  })
})
