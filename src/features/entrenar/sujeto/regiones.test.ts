import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { leerPieza } from '../escena/piezas3d'
import {
  MUSCULOS_SIN_REGION,
  REGIONES,
  claveDeMusculo,
  regionDeMusculo,
  type IdDeRegion,
} from './regiones'

/**
 * LA TABLA «MÚSCULO DEL SUJETO DE BLENDER → UNA DE LAS 15 REGIONES DE LA MAQUETA».
 *
 * Se mide sobre las piezas de verdad (`public/piezas/`), no sobre una lista copiada: si
 * Blender manda una pieza nueva con un músculo que la tabla no conoce, esta prueba lo
 * dice. Ninguno se pierde en silencio: o tiene región, o está anotado como «sin región»
 * con su motivo.
 */

function nombresDe(ruta: string): string[] {
  const b = readFileSync(ruta)
  const mallas = leerPieza(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
  return mallas.map((m) => m.textura ?? '')
}

const ARCHIVOS = [
  'public/piezas/atlas-musculos-alpha.pieza',
  'public/piezas/atlas-musculos-alpha-movil-200k.pieza',
]

describe('las 15 regiones de la maqueta', () => {
  it('son quince, con los mismos ids que la maqueta 7', () => {
    expect(REGIONES.map((r) => r.id).sort()).toEqual(
      ['abd', 'adu', 'ante', 'bic', 'cua', 'delt', 'dors', 'gem', 'glu', 'isq', 'lumb', 'obl', 'pecho', 'trap', 'tri'].sort(),
    )
  })
})

describe.each(ARCHIVOS)('cada músculo de %s', (ruta) => {
  const nombres = nombresDe(ruta)

  it('la pieza trae sus 522 partes con nombre', () => {
    expect(nombres.length).toBe(522)
    expect(nombres.every((n) => n.length > 0)).toBe(true)
  })

  it('o tiene región, o está anotado como sin región: ninguno se pierde en silencio', () => {
    const sueltos = nombres.filter((n) => regionDeMusculo(n) === undefined)
    expect(sueltos, `sin región ni anotación: ${sueltos.join(' | ')}`).toEqual([])
  })

  it('los dos lados (.l y .r) caen en la misma región', () => {
    const porClave = new Map<string, Set<string>>()
    for (const n of nombres) {
      const r = regionDeMusculo(n)
      const k = claveDeMusculo(n)
      porClave.set(k, (porClave.get(k) ?? new Set()).add(String(r)))
    }
    for (const [k, regiones] of porClave) expect(regiones.size, k).toBe(1)
  })
})

describe('los anotados como sin región', () => {
  const todos = new Set(ARCHIVOS.flatMap(nombresDe).map(claveDeMusculo))

  it('existen de verdad en las piezas: no hay anotaciones viejas', () => {
    const fantasmas = Object.values(MUSCULOS_SIN_REGION)
      .flat()
      .filter((n) => !todos.has(n))
    expect(fantasmas).toEqual([])
  })

  it('traen su motivo y ninguno está también en una región', () => {
    for (const [motivo, lista] of Object.entries(MUSCULOS_SIN_REGION)) {
      expect(motivo.length).toBeGreaterThan(2)
      for (const n of lista) expect(regionDeMusculo(n), `${n} está en las dos tablas`).toBe('sin-region')
    }
  })

  it('no se quitan los profundos: el psoas y el iliaco siguen en el sujeto aunque no tengan región', () => {
    expect(MUSCULOS_SIN_REGION['cadera profunda']).toEqual(['Iliacus muscle', 'Psoas major'])
    expect(todos.has('Psoas major')).toBe(true)
  })

  it('un músculo que no existe no se inventa una región', () => {
    expect(regionDeMusculo('Musculus inventado.l')).toBeUndefined()
  })
})

describe('cada región tiene al menos un músculo del sujeto', () => {
  it('ninguna región queda vacía', () => {
    const cuenta = new Map<IdDeRegion, number>()
    for (const n of nombresDe(ARCHIVOS[0])) {
      const r = regionDeMusculo(n)
      if (r && r !== 'sin-region') cuenta.set(r, (cuenta.get(r) ?? 0) + 1)
    }
    for (const r of REGIONES) expect(cuenta.get(r.id) ?? 0, r.id).toBeGreaterThan(0)
  })
})
