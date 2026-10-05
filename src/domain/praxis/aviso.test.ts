import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ETIQUETA_NIVEL, ETIQUETA_ORIGEN, NIVELES_AVISO, ORIGENES_AVISO, esNivelAviso, esOrigenAviso, horaDelAviso, nivelDeMarca,
} from './aviso'
import { filtroDeRiesgo, type MarcaDeRiesgo } from './riesgo'

const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0108_praxis_avisos_coach.sql'), 'utf8')

/** Los valores entre comillas de `check (<columna> in ('a', 'b', …))` en la migración. */
function valoresDelCheck(columna: string): string[] {
  const m = new RegExp(`${columna}\\s+text not null check \\(${columna} in \\(([^)]*)\\)\\)`).exec(SQL)
  if (!m) throw new Error(`no se encontró el check de ${columna} en la 0108`)
  return [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1])
}

describe('de la marca de riesgo al tipo de señal', () => {
  it.each<[MarcaDeRiesgo, string]>([
    [{ tipo: 'quieta', linea: 'vida' }, 'vida'],
    [{ tipo: 'quieta', linea: 'pareja' }, 'pareja'],
    [{ tipo: 'quieta', linea: 'nino' }, 'nino'],
    [{ tipo: 'cuidado' }, 'cuidado'],
    [{ tipo: 'salud', filtro: 'dolor' }, 'salud'],
  ])('%j → %s', (marca, nivel) => {
    expect(nivelDeMarca(marca)).toBe(nivel)
  })

  it('toda marca que el diccionario puede dar tiene un tipo conocido (las del lector con modelo, en funcion-aviso-coach.test.ts)', () => {
    const marcas = [
      filtroDeRiesgo('ya no quiero vivir'),
      filtroDeRiesgo('me dieron ganas de morirme cuando vi los burpees'),
      filtroDeRiesgo('mi esposo me pega'),
      filtroDeRiesgo('le pegan a mi hijo en el colegio'),
      filtroDeRiesgo('me duele la rodilla izquierda'),
    ].filter((m): m is MarcaDeRiesgo => m !== null)
    expect(marcas).toHaveLength(5)
    for (const m of marcas) expect(esNivelAviso(nivelDeMarca(m))).toBe(true)
  })
})

describe('los tipos y los orígenes son los de la migración 0108', () => {
  it('el check de nivel y la lista del dominio dicen lo mismo', () => {
    expect([...valoresDelCheck('nivel')].sort()).toEqual([...NIVELES_AVISO].sort())
  })
  it('el check de origen y la lista del dominio dicen lo mismo', () => {
    expect([...valoresDelCheck('origen')].sort()).toEqual([...ORIGENES_AVISO].sort())
  })
  it('cada tipo y cada origen tiene su rótulo en palabras claras', () => {
    for (const n of NIVELES_AVISO) expect(ETIQUETA_NIVEL[n].length).toBeGreaterThan(5)
    for (const o of ORIGENES_AVISO) expect(ETIQUETA_ORIGEN[o].length).toBeGreaterThan(5)
  })
  it('lo que no está en la lista no pasa', () => {
    expect(esNivelAviso('me quiero morir')).toBe(false)
    expect(esNivelAviso(undefined)).toBe(false)
    expect(esOrigenAviso('una frase')).toBe(false)
  })
})

describe('la migración no tiene dónde guardar una frase', () => {
  it('las únicas columnas de texto son origen y nivel, con lista cerrada', () => {
    const tabla = SQL.slice(SQL.indexOf('create table if not exists public.praxis_avisos_coach'), SQL.indexOf('comment on table'))
    const columnasTexto = [...tabla.matchAll(/^\s+([a-z_]+)\s+(text|varchar|jsonb|json)\b/gm)].map((m) => m[1])
    expect(columnasTexto.sort()).toEqual(['nivel', 'origen'])
  })
})

describe('la hora del aviso', () => {
  const AHORA = new Date(2026, 9, 3, 18, 0).getTime()
  it('hoy dice «Hoy» y la hora', () => {
    expect(horaDelAviso(new Date(2026, 9, 3, 14, 32).toISOString(), AHORA)).toMatch(/^Hoy .*32/)
  })
  it('otro día lleva el día y la hora', () => {
    const t = horaDelAviso(new Date(2026, 9, 1, 9, 5).toISOString(), AHORA)
    expect(t).not.toMatch(/^Hoy/)
    expect(t).toMatch(/1/)
    expect(t).toMatch(/05/)
  })
  it('una hora ilegible no rompe', () => {
    expect(horaDelAviso('mañana', AHORA)).toBe('hora desconocida')
  })
})
