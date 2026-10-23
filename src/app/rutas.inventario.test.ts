import { describe, expect, it } from 'vitest'
import { citasDeAvisosYScripts, citasDePantallas, patronesDelRouter } from '../test/citasDeRutas'
import { esRutaPublica } from './rutasPublicas'
import { RUTAS, buscarRuta, padreDe, tituloDeRuta } from './rutas'

/**
 * INVENTARIO DE LO QUE NO SE PUEDE PERDER (paso 0, «relevo-sin-perdidas»).
 *
 * La tabla `rutas.ts` tiene que ser el router completo, y toda dirección que la app, un aviso push o un
 * script le prometen a una persona tiene que ser una ruta que existe. Quien mueva una pantalla sin dejar
 * la ruta vieja como redirección rompe esta prueba. Que cada una de esas direcciones llegue de verdad a
 * una pantalla (y no a un blanco) lo prueba `rutas.acceso.test.tsx`, con el router montado.
 */
describe('inventario de rutas', () => {
  it('el router y la tabla tienen exactamente las mismas rutas (menos las públicas, que no pasan por el router)', () => {
    const delRouter = patronesDelRouter().sort()
    const deLaTabla = RUTAS.filter((r) => r.guarda.marco !== 'publica').map((r) => r.patron).sort()
    expect(deLaTabla).toEqual(delRouter)
  })

  it('el lector del router ve las rutas anidadas (no se quedó corto)', () => {
    const r = patronesDelRouter()
    expect(r).toContain('/coach/asesorado/:usuarioId')
    expect(r).toContain('/nutricion/plan')
    expect(r).toContain('/')
    expect(r).toContain('/coach')
    expect(r.length).toBeGreaterThanOrEqual(30)
  })

  it('no hay dos filas con el mismo patrón, y cada ejemplo cae en SU patrón', () => {
    const patrones = RUTAS.map((r) => r.patron)
    expect(new Set(patrones).size).toBe(patrones.length)
    for (const r of RUTAS) expect(buscarRuta(r.ejemplo)?.patron, r.ejemplo).toBe(r.patron)
  })

  it('cada padre es otra fila de la tabla, sin parámetros, y las cadenas terminan en una raíz sin ciclos', () => {
    const porPatron = new Map(RUTAS.map((r) => [r.patron, r]))
    for (const r of RUTAS) {
      for (const padre of [r.padre, r.padreEquipo]) {
        if (padre === null || padre === undefined) continue
        expect(porPatron.has(padre), `${r.patron} → ${padre}`).toBe(true)
        expect(padre.includes(':'), `${r.patron} → ${padre}`).toBe(false)
      }
      for (const esEquipo of [false, true]) {
        const visto = new Set<string>()
        let actual: string | null = r.ejemplo
        while (actual !== null) {
          const fila = buscarRuta(actual)
          expect(fila, actual).toBeDefined()
          expect(visto.has(fila!.patron), `ciclo en ${r.patron}`).toBe(false)
          visto.add(fila!.patron)
          actual = padreDe(actual, esEquipo)?.patron ?? null
        }
      }
    }
  })

  it('todas tienen título, y el «‹» sabe a dónde vuelve y cómo se llama', () => {
    for (const r of RUTAS) expect(r.titulo.trim(), r.patron).not.toBe('')
    expect(padreDe('/entrenar/sesion/s-9')).toEqual({ patron: '/entrenar', titulo: 'Entrenar' })
    expect(padreDe('/chat')).toEqual({ patron: '/', titulo: 'Hoy' })
    expect(padreDe('/chat', true)).toEqual({ patron: '/', titulo: 'Mi día' })
    expect(padreDe('/')).toBeNull()
    expect(padreDe('/progreso')).toBeNull()
    expect(padreDe('/entrenar', true)).toEqual({ patron: '/mi-entreno', titulo: 'Mi entreno' })
    expect(padreDe('/no-existe')).toBeNull()
    // Las cinco pestañas del equipo son raíces: sin «‹».
    for (const r of ['/', '/mi-entreno', '/equipo', '/coach/estrategias', '/coach/administracion']) expect(padreDe(r, true), r).toBeNull()
    expect(tituloDeRuta('/')).toBe('Hoy')
  })

  it('la ruta pública se abre sin sesión', () => {
    for (const r of RUTAS.filter((x) => x.guarda.marco === 'publica')) expect(esRutaPublica(r.ejemplo)).toBe(true)
  })
})

describe('direcciones que la app promete abrir', () => {
  const avisos = citasDeAvisosYScripts()

  it('los avisos push, avisos-plan y firmar-revisiones citan las rutas que sus avisos ya mandaron', () => {
    const rutas = avisos.map((c) => c.ruta)
    // Si esta lista cambia, un aviso que ya salió puede estar apuntando a una pantalla que no existe.
    expect(new Set(rutas)).toEqual(new Set(['/mi-plan', '/coach/mi-plan', '/coach/revisiones']))
    expect(avisos.some((c) => c.origen === 'public/push-sw.js')).toBe(true)
    expect(avisos.some((c) => c.origen.endsWith('avisos-plan/decidir.ts'))).toBe(true)
    expect(avisos.some((c) => c.origen === 'scripts/firmar-revisiones.mjs')).toBe(true)
  })

  it('cada una es una ruta de la tabla', () => {
    for (const c of avisos) expect(buscarRuta(c.ruta), `${c.origen} → ${c.ruta}`).toBeDefined()
  })

  it('cada enlace interno de las pantallas es una ruta de la tabla (ningún «no existe»)', () => {
    const citas = citasDePantallas()
    expect(citas.length).toBeGreaterThan(40) // el lector ve enlaces: no pasa por vacío
    const malas = citas.filter((c) => !buscarRuta(c.ruta))
    expect(malas.map((c) => `${c.origen} → ${c.ruta}`)).toEqual([])
  })
})
