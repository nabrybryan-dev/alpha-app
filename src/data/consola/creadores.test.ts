import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CARRILES,
  COLUMNAS_CREADORES_CANDIDATOS,
  COLUMNAS_CREADORES_REVISIONES,
  aCandidato,
  aRevision,
  mediaDimension,
  porCarril,
  type RevisionReel,
} from './creadores'

const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0090_creadores_tablero_lectura.sql'), 'utf8')

function bloqueTabla(tabla: string): string {
  const inicio = SQL.indexOf(`create table if not exists public.${tabla} (`)
  expect(inicio, `la 0090 no crea ${tabla}`).toBeGreaterThan(0)
  return SQL.slice(inicio, SQL.indexOf(');\n', inicio))
}

function columnasDe(tabla: string): string[] {
  return bloqueTabla(tabla)
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => /^[a-z_]+\s/.test(l) && !/^(unique|constraint|check)\b/.test(l))
    .map((l) => l.split(/\s+/)[0])
}

describe('las columnas salen de la migración 0090', () => {
  it('creadores_candidatos', () => {
    expect([...columnasDe('creadores_candidatos')].sort()).toEqual([...COLUMNAS_CREADORES_CANDIDATOS].sort())
  })
  it('creadores_revisiones', () => {
    expect([...columnasDe('creadores_revisiones')].sort()).toEqual([...COLUMNAS_CREADORES_REVISIONES].sort())
  })
  it('los carriles son los mismos que el check de la 0090', () => {
    const bloque = bloqueTabla('creadores_candidatos')
    const check = bloque.slice(bloque.indexOf('carril            text'), bloque.indexOf('motivos'))
    const enElSql = [...check.matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1])
    expect([...enElSql].sort()).toEqual([...CARRILES].sort())
  })
})

const filaBase = {
  creador_id: 'ig:1',
  usuario_ig: 'creador',
  seguidores: 800,
  segmento: 'aliado',
  carril: 'tambaleando',
  motivos: ['C 1,8', 3, 'sin audio'],
  nota_a: '85.0',
  version_rubrica: 'astra-2026-09-26',
  metricas: { seguidores: 800 },
  senal_colombia: true,
  fecha_dato: '2026-09-28T00:00:00Z',
  fecha_recepcion: '2026-09-28T01:00:00Z',
  actualizado_en: '2026-09-28T01:00:00Z',
}

describe('aCandidato', () => {
  it('acomoda la fila: nota numérica y solo motivos de texto', () => {
    const c = aCandidato(filaBase)
    expect(c?.notaA).toBe(85)
    expect(c?.motivos).toEqual(['C 1,8', 'sin audio'])
  })
  it('descarta un carril o un segmento fuera de vocabulario en vez de disfrazarlo', () => {
    expect(aCandidato({ ...filaBase, carril: 'inventado' })).toBeNull()
    expect(aCandidato({ ...filaBase, segmento: 'vip' })).toBeNull()
  })
})

describe('mediaDimension', () => {
  const rev = (notas: Record<string, number | null>): RevisionReel => ({
    id: 'x',
    revisionId: 'r',
    creadorId: 'ig:1',
    revisor: 'claude',
    rolReel: 'reciente_1',
    mediaId: '1',
    permalink: null,
    notas,
    sinAudio: true,
    descripcion: null,
    hojaCuadros: null,
    fechaRevision: '2026-09-28T00:00:00Z',
  })
  it('un reel pendiente (null) no cuenta como cero', () => {
    expect(mediaDimension([rev({ C: 2 }), rev({ C: null }), rev({ C: 1 })], 'C')).toBe(1.5)
  })
  it('sin ninguna nota, no hay media', () => {
    expect(mediaDimension([rev({ C: null })], 'C')).toBeNull()
  })
  it('aRevision convierte una nota no numérica en pendiente', () => {
    const fila = {
      id: 'x', revision_id: 'r', creador_id: 'ig:1', revisor: 'astra', rol_reel: 'aleatorio_2',
      media_id: '1', permalink: null, notas: { H: 2, S: 'pendiente' }, sin_audio: true,
      descripcion: null, hoja_cuadros: null, semilla: null,
      fecha_revision: '2026-09-28T00:00:00Z', fecha_recepcion: '2026-09-28T00:00:00Z',
    }
    expect(aRevision(fila)?.notas).toEqual({ H: 2, S: null })
    expect(aRevision({ ...fila, revisor: 'gpt' })).toBeNull()
  })
})

describe('porCarril', () => {
  it('devuelve todos los carriles en el orden del embudo', () => {
    const c = aCandidato(filaBase)!
    const grupos = porCarril([c])
    expect(grupos.map((g) => g.carril)).toEqual([...CARRILES])
    expect(grupos.find((g) => g.carril === 'tambaleando')?.candidatos).toHaveLength(1)
  })
})
