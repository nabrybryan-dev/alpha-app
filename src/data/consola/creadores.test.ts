import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CARRILES,
  COLUMNAS_CREADORES_CANDIDATOS,
  COLUMNAS_CREADORES_REVISIONES,
  aCandidato,
  aRevision,
  candidatosDelTablero,
  mediaDimension,
  porCarril,
  resumenS,
  revisionesDe,
  vueltasDeRevision,
  type RevisionReel,
} from './creadores'

/**
 * Supabase simulado en su capa más baja: una tabla de `estado.total` filas que devuelve,
 * como mucho, `estado.maxFilas` por petición (el `max-rows` de PostgREST), y que solo
 * entrega filas si se le pide un `range`. Así se ve si la lectura pagina hasta completar.
 */
const estado = {
  activo: true,
  total: 0,
  maxFilas: 1000,
  error: null as null | { message: string },
  lanza: false,
  rangos: [] as [number, number][],
}

function filaSimulada(i: number) {
  return {
    creador_id: `ig:${i}`, usuario_ig: `c${i}`, seguidores: 800, segmento: 'aliado', carril: 'etapa1',
    motivos: [], nota_a: null, version_rubrica: null, metricas: {}, senal_colombia: null,
    fecha_dato: '2026-09-28T00:00:00Z', fecha_recepcion: '2026-09-28T00:00:00Z', actualizado_en: '2026-09-28T00:00:00Z',
    id: `r${i}`, revision_id: 'v1', revisor: 'claude', rol_reel: 'reciente_1', media_id: `${i}`,
    permalink: null, notas: {}, sin_audio: true, descripcion: null, hoja_cuadros: null, semilla: null,
    fecha_revision: '2026-09-28T00:00:00Z',
  }
}

vi.mock('../supabase', () => {
  const consulta = () => {
    const b: Record<string, unknown> = {}
    const yo = () => b
    Object.assign(b, {
      select: yo,
      eq: yo,
      order: yo,
      range: (desde: number, hasta: number) => {
        estado.rangos.push([desde, hasta])
        if (estado.lanza) throw new Error('red caída')
        if (estado.error) return Promise.resolve({ data: null, error: estado.error, count: null })
        const fin = Math.min(hasta, desde + estado.maxFilas - 1, estado.total - 1)
        const data = []
        for (let i = desde; i <= fin; i++) data.push(filaSimulada(i))
        return Promise.resolve({ data, error: null, count: estado.total })
      },
    })
    return b
  }
  return {
    get modoNube() {
      return estado.activo
    },
    supabase: () => ({ from: consulta }),
  }
})

beforeEach(() => {
  estado.activo = true
  estado.total = 0
  estado.maxFilas = 1000
  estado.error = null
  estado.lanza = false
  estado.rangos = []
})

describe('la lectura del tablero no confunde un fallo con un vacío (E-01) y pagina (E-06)', () => {
  it('trae las 2.500 filas aunque el servidor entregue como mucho 1.000 por petición', async () => {
    estado.total = 2500
    const r = await candidatosDelTablero()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.datos).toHaveLength(2500)
    expect(estado.rangos.length).toBeGreaterThanOrEqual(3)
  })

  it('con un max-rows menor que la página (500) sigue pidiendo hasta completar el conteo', async () => {
    estado.total = 1200
    estado.maxFilas = 500
    const r = await candidatosDelTablero()
    expect(r.ok && r.datos.length).toBe(1200)
  })

  it('un error de la consulta es un error, no una lista vacía', async () => {
    estado.error = { message: 'permiso denegado' }
    const r = await candidatosDelTablero()
    expect(r.ok).toBe(false)
    const rev = await revisionesDe('ig:1')
    expect(rev.ok).toBe(false)
  })

  it('una excepción también es un error', async () => {
    estado.lanza = true
    expect((await candidatosDelTablero()).ok).toBe(false)
    expect((await revisionesDe('ig:1')).ok).toBe(false)
  })

  it('una tabla vacía de verdad es un vacío confirmado', async () => {
    const r = await candidatosDelTablero()
    expect(r).toEqual({ ok: true, datos: [] })
  })

  it('las revisiones también paginan', async () => {
    estado.total = 1500
    const r = await revisionesDe('ig:1')
    expect(r.ok && r.datos.length).toBe(1500)
  })
})

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

const reel = (extra: Partial<RevisionReel>): RevisionReel => ({
  id: 'x', revisionId: 'v1', creadorId: 'ig:1', revisor: 'claude', rolReel: 'reciente_1', mediaId: '1',
  permalink: null, notas: {}, sinAudio: true, descripcion: null, hojaCuadros: null,
  fechaRevision: '2026-09-28T00:00:00Z', ...extra,
})

describe('resumenS: la seguridad nunca se promedia (E-03)', () => {
  it('S 1 y S 3 dan un mínimo de 1, marcado bajo, no una media de 2', () => {
    const s = resumenS([reel({ notas: { S: 1 } }), reel({ notas: { S: 3 } })])
    expect(s).toEqual({ minimo: 1, bajo: true, conNota: 2, pendientes: 0, total: 2 })
  })
  it('cuenta los pendientes y la cobertura', () => {
    const s = resumenS([reel({ notas: { S: 2 } }), reel({ notas: { S: null } }), reel({ notas: {} })])
    expect(s).toEqual({ minimo: 2, bajo: false, conNota: 1, pendientes: 2, total: 3 })
  })
  it('sin ninguna S conocida no hay mínimo', () => {
    expect(resumenS([reel({ notas: { S: null } })]).minimo).toBeNull()
  })
})

describe('vueltasDeRevision: una vuelta por revision_id, la más reciente primero (E-02)', () => {
  it('no mezcla dos vueltas del mismo reel', () => {
    const vueltas = vueltasDeRevision([
      reel({ id: 'a', revisionId: 'v1', fechaRevision: '2026-09-20T00:00:00Z', notas: { S: 1 } }),
      reel({ id: 'b', revisionId: 'v2', fechaRevision: '2026-09-27T00:00:00Z', notas: { S: 3 } }),
      reel({ id: 'c', revisionId: 'v2', fechaRevision: '2026-09-27T00:00:00Z', revisor: 'astra', notas: { S: 3 } }),
    ])
    expect(vueltas.map((v) => v.revisionId)).toEqual(['v2', 'v1'])
    expect(vueltas[0].filas.map((f) => f.id)).toEqual(['b', 'c'])
    expect(vueltas[1].filas.map((f) => f.id)).toEqual(['a'])
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
