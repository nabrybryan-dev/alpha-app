import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { M4 } from '../../../domain/patrones/algebra'
import { Malla } from '../../../domain/patrones/malla'
import { CAMPO_VISUAL } from '../../../domain/patrones/escena'
import { colocar, leerPieza } from '../escena/piezas3d'
import { ojoDe } from '../escena/encuadreDelSalon'
import { mallasDelCuerpo } from './cuerpoEnEscena'
import { ENCUADRE_DEL_CUERPO, encuadreDelCuerpo } from './encuadreDelCuerpo'
import type { Paleta } from './pintura'
import { tinteDelCuerpo } from './tinte'

/**
 * EL CUERPO SE VE DE PIE, ENTERO Y CENTRADO (ronda 2 del PR #380).
 *
 * En la primera version salia TUMBADO en el suelo: el atlas colgaba de la raiz del
 * esqueleto del patron, y el press plano tumba esa raiz. El cuerpo de Blender es quieto y va
 * con el hueso 0 (identidad); y la camara no es la del patron, es la de `encuadreDelCuerpo`.
 */

const PALETA: Paleta = { base: [0.2, 0.2, 0.2], luz: [1, 1, 1], rojo: [1, 0, 0], tendon: [0.9, 0.9, 0.9] }

function cargar(ruta: string): Malla[] {
  const b = readFileSync(ruta)
  return colocar(leerPieza(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), { x: 0, z: 0, giroY: 0 })
}

function caja(mallas: Malla[]) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const m of mallas) {
    const p = m.posicion
    for (let i = 0; i < p.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], p[i + k])
        max[k] = Math.max(max[k], p[i + k])
      }
    }
  }
  return { ancho: max[0] - min[0], alto: max[1] - min[1], fondo: max[2] - min[2], min, max }
}

const almacen = new Map<string, Malla[]>([
  ['musculos', cargar('public/piezas/atlas-musculos-alpha-movil-200k.pieza')],
  ['esqueleto', cargar('public/piezas/atlas-esqueleto-alpha-movil.pieza')],
  ['piel', cargar('public/piezas/atlas-piel-alta.pieza')],
])
const atlas = { get: (c: string) => almacen.get(c) }

describe.each(['piel', 'musculo', 'hueso'] as const)('el cuerpo en la capa %s', (capa) => {
  const { mallas } = mallasDelCuerpo(atlas, capa, tinteDelCuerpo({}, []), PALETA)

  it('es mas alto que ancho y que hondo: esta de pie, no tumbado', () => {
    const c = caja(mallas)
    expect(c.alto).toBeGreaterThan(1.5)
    expect(c.alto).toBeGreaterThan(c.ancho * 2)
    expect(c.alto).toBeGreaterThan(c.fondo * 3)
    expect(c.min[1]).toBeCloseTo(0, 1)
  })

  it('va con el hueso 0 (identidad), no colgado de la raiz que el patron tumba', () => {
    for (const m of mallas) expect([...m.hueso].every((h) => h === 0)).toBe(true)
  })
})

describe('la camara del cuerpo', () => {
  const e = encuadreDelCuerpo()
  const vista = M4.mirarDesde(ojoDe(e.azimut, e.elevacion, e.distancia, e.centro), e.centro, [0, 1, 0])
  const proy = M4.perspectiva(e.campo, 390 / 844, 0.05, 40)
  const caja2 = caja([...(almacen.get('musculos') ?? [])])

  function aPantalla(p: [number, number, number]) {
    const v = M4.transformarPunto(vista, p)
    const w = -v[2]
    return { x: ((proy[0] * v[0]) / w) * 0.5 * 390 + 195, y: 422 - ((proy[5] * v[1]) / w) * 0.5 * 844 }
  }

  it('el campo es el del salon y la constante esta a la vista', () => {
    expect(e.campo).toBe(CAMPO_VISUAL)
    expect(ENCUADRE_DEL_CUERPO.azimut).toBe(0)
  })

  it('el cuerpo entero cabe en el cuadro, centrado a lo ancho y por encima de la hoja (no baja del 72 % del alto)', () => {
    const pies = aPantalla([0, caja2.min[1], 0])
    const cabeza = aPantalla([0, caja2.max[1], 0])
    const izq = aPantalla([caja2.min[0], 1, 0])
    const der = aPantalla([caja2.max[0], 1, 0])
    expect(cabeza.y).toBeGreaterThan(40)
    expect(pies.y).toBeLessThan(844 * 0.72)
    expect(pies.y - cabeza.y).toBeGreaterThan(844 * 0.4)
    expect(izq.x).toBeGreaterThan(0)
    expect(der.x).toBeLessThan(390)
    expect(Math.abs((izq.x + der.x) / 2 - 195)).toBeLessThan(25)
  })
})
