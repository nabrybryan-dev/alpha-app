import { describe, expect, it } from 'vitest'
import type { Capacidad } from '../data/consola/capacidadesStaff'
import type { Rol } from '../domain/types'
import { PATRONES_DESTINO, decidirDestino, destinosPara } from './destinosPraxis'
import { RUTAS, buscarRuta, resolverAcceso, type PerfilAcceso } from './rutas'

/**
 * Los destinos de Praxis salen de `RUTAS` y respetan `resolverAcceso`. Si alguien añade un destino que la
 * app no conoce, o una persona recibe uno al que su rol no entra, esta prueba se pone en rojo.
 * Los perfiles son los de `rutas.acceso.test.tsx` (capacidades de ejemplo, sin datos de nadie).
 */
const DE_BRYAN: Capacidad[] = ['leer_entrenamiento', 'ver_administracion', 'revisar_creadores', 'responder_mercadeo', 'organizar_plan', 'decisiones_compartidas']
const PERFILES: { nombre: string; rol: Rol; capacidades: Capacidad[] }[] = [
  { nombre: 'asesorado', rol: 'asesorado', capacidades: [] },
  { nombre: 'nutricionista sin capacidades', rol: 'nutricionista', capacidades: [] },
  { nombre: 'coach', rol: 'coach', capacidades: DE_BRYAN },
  { nombre: 'coach sin capacidades', rol: 'coach', capacidades: [] },
  { nombre: 'cuenta personal (puesto_de_coach)', rol: 'asesorado', capacidades: ['puesto_de_coach', ...DE_BRYAN] },
  { nombre: 'cuenta Alpha (solo_tablero)', rol: 'coach', capacidades: ['solo_tablero', 'leer_entrenamiento', 'ver_administracion'] },
]
const acceso = (p: (typeof PERFILES)[number]): PerfilAcceso => ({ rol: p.rol, capacidades: new Set(p.capacidades) })

describe('destinos de Praxis', () => {
  it('cada destino es una ruta de la tabla, sin parámetros, que no redirige y no es de Praxis', () => {
    expect(PATRONES_DESTINO.length).toBeGreaterThan(10)
    for (const patron of PATRONES_DESTINO) {
      const fila = buscarRuta(patron)
      expect(fila?.patron, patron).toBe(patron)
      expect(patron.includes(':'), patron).toBe(false)
      expect(fila!.guarda.redirigeA, patron).toBeUndefined()
      expect(['comodin', 'publica', 'praxis']).not.toContain(fila!.guarda.marco)
    }
  })

  it.each(PERFILES.map((p) => [p.nombre, p] as const))('%s: recibe exactamente las rutas a las que su rol entra', (_n, p) => {
    const a = acceso(p)
    const recibidos = destinosPara(a).map((d) => d.patron)
    const esperados = PATRONES_DESTINO.filter((patron) => resolverAcceso(buscarRuta(patron)!, a).tipo === 'entra')
    expect(recibidos).toEqual(esperados)
    for (const patron of PATRONES_DESTINO) {
      const d = decidirDestino(patron, a)
      expect(d.tipo, `${p.nombre} → ${patron}`).toBe(esperados.includes(patron) ? 'puede_ir' : 'sin_acceso')
    }
  })

  it('el asesorado llega a sus pestañas y no a las del equipo', () => {
    const a = acceso(PERFILES[0])
    const suyos = destinosPara(a).map((d) => d.patron)
    for (const p of ['/', '/entrenar', '/nutricion', '/semana', '/progreso', '/bienestar', '/cuestionarios', '/logros']) expect(suyos).toContain(p)
    for (const p of ['/equipo', '/bandeja', '/empresa', '/coach/consola', '/entrenar/encoder', '/tablero']) {
      expect(suyos).not.toContain(p)
      expect(decidirDestino(p, a).tipo, p).toBe('sin_acceso')
    }
  })

  it('el título es el de esa persona: «Hoy» para el asesorado, «Mi día» para el equipo', () => {
    const tit = (i: number) => destinosPara(acceso(PERFILES[i])).find((d) => d.patron === '/')?.titulo
    expect(tit(0)).toBe('Hoy')
    expect(tit(2)).toBe('Mi día')
  })

  it('lo que no es destino se dice como tal, no como «sin acceso»', () => {
    const a = acceso(PERFILES[2])
    for (const p of ['/no-existe', '/equipo/:usuarioId', '/equipo/u-valentina', '/coach', '/coach/asesorados', '/praxis', '/interesados', '/*']) {
      expect(decidirDestino(p, a).tipo, p).toBe('no_es_destino')
    }
  })

  it('no se dejó fuera una pestaña: toda ruta raíz sin parámetros del asesorado es destino', () => {
    const raices = RUTAS.filter((r) => r.guarda.marco === 'asesorado' && r.padre === null && !r.patron.includes(':')).map((r) => r.patron)
    for (const r of raices) expect(PATRONES_DESTINO, r).toContain(r)
  })
})
