import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Capacidad } from '../data/consola/capacidadesStaff'
import type { Rol } from '../domain/types'
import { normalizarNombre } from '../domain/praxis/ordenes/normalizarNombre'
import { PATRONES_DESTINO } from './destinosPraxis'
import { PIEZAS_DE_HOY, SINONIMOS_DE_PANTALLA, buscarPiezas, piezasDePantallas, piezasPara } from './catalogoDePiezas'
import type { PerfilAcceso } from './rutas'

/**
 * El catálogo de piezas (fase O1) tiene que seguir a la app sin que nadie lo recuerde. Las pantallas salen de
 * `RUTAS`; las tarjetas de Hoy se registran a mano y esta prueba LEE `HoyPage.tsx` para comprobar que cada
 * tarjeta que la pantalla compone tiene su nombre hablado, y que ninguna registrada ya no existe.
 * Perfiles de ejemplo, sin datos de nadie.
 */
const perfil = (rol: Rol, capacidades: Capacidad[] = []): PerfilAcceso => ({ rol, capacidades: new Set(capacidades) })
const ASESORADO = perfil('asesorado')
const COACH = perfil('coach', ['leer_entrenamiento', 'ver_administracion', 'revisar_creadores', 'responder_mercadeo', 'organizar_plan', 'decisiones_compartidas'])
const NUTRICIONISTA = perfil('nutricionista')

describe('catálogo de piezas: pantallas', () => {
  it('hay una pieza por cada destino de Praxis (no se queda corto ni inventa pantallas)', () => {
    const del = piezasDePantallas(COACH).map((p) => p.pantalla)
    expect(del.length).toBeGreaterThan(10)
    for (const patron of del) expect(PATRONES_DESTINO).toContain(patron)
    expect(piezasDePantallas(COACH).every((p) => p.nombreHablado.trim().length > 0)).toBe(true)
  })

  it('cada sinónimo de pantalla cuelga de un destino que existe', () => {
    for (const patron of Object.keys(SINONIMOS_DE_PANTALLA)) expect(PATRONES_DESTINO, patron).toContain(patron)
  })
})

describe('catálogo de piezas: ids y nombres', () => {
  it('los ids no se repiten y no hay dos piezas con el mismo nombre en la misma pantalla', () => {
    const todas = piezasPara(ASESORADO)
    const ids = todas.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    const claves = todas.map((p) => `${p.pantalla}|${normalizarNombre(p.nombreHablado)}`)
    expect(new Set(claves).size).toBe(claves.length)
  })

  it('un sinónimo no es el nombre hablado de OTRA pieza de la misma pantalla', () => {
    const todas = piezasPara(ASESORADO)
    for (const p of todas)
      for (const s of p.sinonimos)
        for (const o of todas)
          if (o !== p && o.pantalla === p.pantalla) expect(normalizarNombre(s), `${p.id} / ${o.id}`).not.toBe(normalizarNombre(o.nombreHablado))
  })
})

describe('inventario de las tarjetas de Hoy contra HoyPage.tsx', () => {
  const texto = readFileSync(join(process.cwd(), 'src/features/hoy/HoyPage.tsx'), 'utf8')
  const marca = '// El asesorado, en tres bandas'
  const cola = texto.slice(texto.indexOf(marca))
  const claves = new Set<string>()
  for (const m of cola.matchAll(/^\s*\{(\w+)\}\s*$/gm)) claves.add(m[1])
  for (const m of cola.matchAll(/<([A-Z]\w+)/g)) if (!['Suspense', 'ElResto'].includes(m[1])) claves.add(m[1])

  it('el lector de HoyPage ve la banda del asesorado (no se quedó corto)', () => {
    expect(texto.includes(marca)).toBe(true)
    expect(claves.size).toBeGreaterThanOrEqual(10)
    expect(claves.has('tarjetaSesion')).toBe(true)
  })

  it('toda tarjeta que Hoy compone tiene su pieza con nombre hablado', () => {
    const registradas = new Set(PIEZAS_DE_HOY.map((p) => p.enCodigo))
    const sinNombre = [...claves].filter((c) => !registradas.has(c))
    expect(sinNombre, 'tarjetas de Hoy sin pieza en catalogoDePiezas.ts').toEqual([])
  })

  it('ninguna pieza registrada apunta a una tarjeta que ya no existe', () => {
    const huerfanas = PIEZAS_DE_HOY.filter((p) => !claves.has(p.enCodigo ?? '')).map((p) => p.id)
    expect(huerfanas).toEqual([])
  })
})

describe('niveles y quién recibe qué', () => {
  it('lo clínico y lo que cuida a la persona es fijo (puede moverse, no ocultarse)', () => {
    const fijas = new Set(piezasPara(ASESORADO).filter((p) => p.nivel === 'fija').map((p) => p.id))
    for (const id of ['hoy.checkin', 'hoy.cuestionario-de-salud', 'hoy.escribir-al-coach', 'pantalla:/yo', 'pantalla:/yo/derechos', 'pantalla:/chat']) expect(fijas, id).toContain(id)
  })

  it('lo que el coach asigna no es libre', () => {
    const por = (id: string) => PIEZAS_DE_HOY.find((p) => p.id === id)?.nivel
    expect(por('hoy.sesion')).toBe('asignada')
    expect(por('hoy.nutricion')).toBe('asignada')
  })

  it('un asesorado no recibe ninguna pieza del equipo, ni las busca por nombre', () => {
    expect(piezasPara(ASESORADO).some((p) => p.nivel === 'equipo')).toBe(false)
    expect(buscarPiezas('muéstrame la bandeja', ASESORADO)).toEqual([])
    expect(buscarPiezas('muéstrame la bandeja', COACH).map((p) => p.pantalla)).toContain('/bandeja')
  })

  it('el equipo recibe pantallas del equipo y no las tarjetas de Hoy del asesorado', () => {
    expect(piezasPara(NUTRICIONISTA).some((p) => p.tipo === 'tarjeta')).toBe(false)
    expect(piezasPara(ASESORADO).some((p) => p.tipo === 'tarjeta')).toBe(true)
  })
})

describe('buscar piezas por nombre hablado', () => {
  const ids = (frase: string, p = ASESORADO) => buscarPiezas(frase, p).map((x) => x.id)

  it('encuentra una tarjeta por su nombre y por un sinónimo, con o sin tildes y mayúsculas', () => {
    expect(ids('Muéstrame el CHECK-IN del día')).toEqual(['hoy.checkin'])
    expect(ids('quiero ver como amanecí')).toEqual(['hoy.checkin'])
  })

  it('el nombre más largo gana al corto que contiene («la nutrición de hoy» no es la pantalla Nutrición)', () => {
    expect(ids('ponme la nutrición de hoy arriba')).toEqual(['hoy.nutricion'])
    expect(ids('ábreme Nutrición')).toEqual(['pantalla:/nutricion'])
  })

  it('un nombre que no existe no se adivina', () => {
    expect(ids('muéstrame el unicornio')).toEqual([])
  })

  it('una frase que nombra dos piezas distintas las devuelve las dos para preguntar cuál', () => {
    expect(ids('quiero el álbum y el radar').sort()).toEqual(['hoy.album', 'hoy.radar'])
  })
})
