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
  eventosDelTablero,
  COLUMNAS_CREADORES_EVENTOS,
  mediaDimension,
  porCarril,
  resumenS,
  revisionesDe,
  vueltasDeRevision,
  type RevisionReel,
} from './creadores'

/**
 * Supabase simulado en su capa más baja: una base en memoria (`estado.tablas`, o `estado.total`
 * filas generadas) que entiende `eq`, `gt`, `order`, `range` y `limit`, cuenta exacto y entrega,
 * como mucho, `estado.maxFilas` por petición (el `max-rows` de PostgREST). `estado.trasPeticion`
 * cambia la base ENTRE una petición y la siguiente, que es donde una paginación por posición
 * se rompe (N-01 de la revisión de Codex del 28-sep).
 */
type FilaMem = Record<string, unknown>
const estado = {
  activo: true,
  total: 0,
  maxFilas: 1000,
  error: null as null | { message: string },
  lanza: false,
  peticiones: 0,
  tablas: null as null | Record<string, FilaMem[]>,
  trasPeticion: null as null | ((n: number, tablas: Record<string, FilaMem[]>) => void),
  /** Un servidor que ignora el cursor (devuelve la misma página): la lectura debe notarlo. */
  ignorarCursor: false,
}

function filaSimulada(i: number): FilaMem {
  return {
    creador_id: `ig:${i}`, usuario_ig: `c${i}`, seguidores: 800, segmento: 'aliado', carril: 'etapa1',
    motivos: [], nota_a: null, version_rubrica: null, metricas: {}, senal_colombia: null,
    fecha_dato: '2026-09-28T00:00:00Z', fecha_recepcion: '2026-09-28T00:00:00Z', actualizado_en: '2026-09-28T00:00:00Z',
    id: `r${i}`, revision_id: 'v1', revisor: 'claude', rol_reel: 'reciente_1', media_id: `${i}`,
    permalink: null, notas: {}, sin_audio: true, descripcion: null, hoja_cuadros: null, semilla: null,
    fecha_revision: '2026-09-28T00:00:00Z', carril_nuevo: 'mensaje_enviado',
  }
}

function filasDe(tabla: string): FilaMem[] {
  if (!estado.tablas) estado.tablas = {}
  if (!estado.tablas[tabla]) estado.tablas[tabla] = Array.from({ length: estado.total }, (_, i) => filaSimulada(i))
  return estado.tablas[tabla]
}

vi.mock('../supabase', () => {
  const consulta = (tabla: string) => {
    const q = {
      orden: [] as [string, boolean][],
      eq: [] as [string, unknown][],
      gt: [] as [string, string][],
      desde: 0,
      hasta: Number.POSITIVE_INFINITY,
      head: false,
    }
    const ejecutar = async () => {
      estado.peticiones += 1
      if (estado.lanza) throw new Error('red caída')
      if (estado.error) return { data: null, error: estado.error, count: null }
      let filas = filasDe(tabla).filter((f) => q.eq.every(([c, v]) => f[c] === v))
      if (!estado.ignorarCursor) filas = filas.filter((f) => q.gt.every(([c, v]) => String(f[c]) > v))
      // Como PostgREST: el conteo exacto respeta TODOS los filtros (también el cursor).
      const count = filas.length
      if (q.head) {
        estado.trasPeticion?.(estado.peticiones, estado.tablas!)
        return { data: null, error: null, count }
      }
      filas = [...filas].sort((a, b) => {
        for (const [c, asc] of q.orden) {
          const x = String(a[c])
          const y = String(b[c])
          if (x !== y) return (x < y ? -1 : 1) * (asc ? 1 : -1)
        }
        return 0
      })
      const fin = Math.min(q.hasta, q.desde + estado.maxFilas - 1)
      const data = filas.slice(q.desde, fin + 1).map((f) => ({ ...f }))
      estado.trasPeticion?.(estado.peticiones, estado.tablas!)
      return { data, error: null, count }
    }
    const b: Record<string, unknown> = {}
    Object.assign(b, {
      select: (_c?: string, o?: { head?: boolean }) => ((q.head = Boolean(o?.head)), b),
      eq: (c: string, v: unknown) => (q.eq.push([c, v]), b),
      gt: (c: string, v: string) => (q.gt.push([c, v]), b),
      order: (c: string, o?: { ascending?: boolean }) => (q.orden.push([c, o?.ascending !== false]), b),
      range: (d: number, h: number) => ((q.desde = d), (q.hasta = h), b),
      limit: (n: number) => ((q.hasta = q.desde + n - 1), b),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => ejecutar().then(res, rej),
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
  estado.peticiones = 0
  estado.tablas = null
  estado.trasPeticion = null
  estado.ignorarCursor = false
})

describe('la lectura del tablero no confunde un fallo con un vacío (E-01) y pagina (E-06)', () => {
  it('trae las 2.500 filas aunque el servidor entregue como mucho 1.000 por petición', async () => {
    estado.total = 2500
    const r = await candidatosDelTablero()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.datos).toHaveLength(2500)
    expect(estado.peticiones).toBeGreaterThanOrEqual(3)
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
    estado.tablas = {
      creadores_revisiones: Array.from({ length: 1500 }, (_, i) => ({ ...filaSimulada(i), creador_id: 'ig:1' })),
    }
    estado.maxFilas = 400
    const r = await revisionesDe('ig:1')
    expect(r.ok && r.datos.length).toBe(1500)
  })
})

const cand = (id: string, actualizado: string): FilaMem => ({ ...filaSimulada(0), creador_id: id, usuario_ig: id, actualizado_en: actualizado })

describe('la lectura no se deja engañar por una fila que cambia entre páginas (N-01)', () => {
  it('una fila actualizada entre la primera y la segunda página no falta ni sale dos veces', async () => {
    // El caso de Codex: [A,B,C,D]; tras la página [A,B] se actualiza D y el orden por
    // actualizado_en pasa a [D,A,B,C]. Por posición, la segunda página traía [B,C].
    estado.tablas = {
      creadores_candidatos: [
        cand('ig:a', '2026-09-28T04:00:00Z'),
        cand('ig:b', '2026-09-28T03:00:00Z'),
        cand('ig:c', '2026-09-28T02:00:00Z'),
        cand('ig:d', '2026-09-28T01:00:00Z'),
      ],
    }
    estado.maxFilas = 2
    estado.trasPeticion = (n, t) => {
      if (n === 1) t.creadores_candidatos.find((f) => f.creador_id === 'ig:d')!.actualizado_en = '2026-09-28T05:00:00Z'
    }
    const r = await candidatosDelTablero()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const ids = r.datos.map((c) => c.creadorId)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(['ig:a', 'ig:b', 'ig:c', 'ig:d'])
    // Se sigue mostrando lo más reciente primero: D, recién actualizado, arriba.
    expect(ids[0]).toBe('ig:d')
  })

  it('una fila que entra por detrás del cursor a mitad de lectura hace la lectura incompleta, no «completa»', async () => {
    estado.tablas = {
      creadores_candidatos: [cand('ig:b', '2026-09-28T00:00:00Z'), cand('ig:c', '2026-09-28T00:00:00Z'), cand('ig:d', '2026-09-28T00:00:00Z')],
    }
    estado.maxFilas = 2
    estado.trasPeticion = (n, t) => {
      if (n === 1) t.creadores_candidatos.push(cand('ig:a', '2026-09-28T00:00:00Z'))
    }
    const r = await candidatosDelTablero()
    // Por posición salía «ok» con ig:c dos veces y sin ig:a. Ahora es un error que se reintenta.
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/incompleta/)
  })

  it('una revisión nueva que llega a mitad de lectura no duplica otra', async () => {
    const rev = (id: string, fecha: string): FilaMem => ({ ...filaSimulada(0), id, media_id: id, fecha_revision: fecha })
    estado.tablas = {
      creadores_revisiones: [rev('r1', '2026-09-27T00:00:00Z'), rev('r2', '2026-09-26T00:00:00Z'), rev('r3', '2026-09-25T00:00:00Z')],
    }
    estado.maxFilas = 2
    estado.trasPeticion = (n, t) => {
      if (n === 1) t.creadores_revisiones.push(rev('r4', '2026-09-28T00:00:00Z'))
    }
    const r = await revisionesDe('ig:0')
    // Nunca «ok» con una fila repetida: o las cuatro sin repetir (la más reciente primero), o un error.
    if (r.ok) {
      const ids = r.datos.map((x) => x.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect([...ids].sort()).toEqual(['r1', 'r2', 'r3', 'r4'])
      expect(ids[0]).toBe('r4')
    } else {
      expect(r.error).toMatch(/incompleta/)
    }
  })

  it('si el servidor repite filas (ignora el cursor), la lectura lo dice en vez de darlas por buenas', async () => {
    estado.total = 3
    estado.maxFilas = 2
    estado.ignorarCursor = true
    const r = await candidatosDelTablero()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/repetid/)
  })
})

describe('la historia de carriles (creadores_eventos) se lee entera (E-05)', () => {
  it('lee los eventos paginando y conserva un carril fuera de vocabulario para avisarlo', async () => {
    estado.tablas = {
      creadores_eventos: [
        ...Array.from({ length: 5 }, (_, i) => ({ id: `e${i}`, creador_id: `ig:${i}`, carril_nuevo: 'mensaje_enviado', fecha_dato: '2026-09-28T00:00:00Z' })),
        { id: 'e9', creador_id: 'ig:9', carril_nuevo: 'inventado', fecha_dato: '2026-09-28T00:00:00Z' },
      ],
    }
    estado.maxFilas = 2
    const r = await eventosDelTablero()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.datos.map((e) => e.creadorId).sort()).toEqual(['ig:0', 'ig:1', 'ig:2', 'ig:3', 'ig:4', 'ig:9'])
      expect(r.datos.find((e) => e.creadorId === 'ig:9')?.carrilNuevo).toBe('inventado')
    }
  })

  it('un error al leer la historia es un error, no una historia vacía', async () => {
    estado.error = { message: 'permiso denegado' }
    expect((await eventosDelTablero()).ok).toBe(false)
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
  it('creadores_eventos: las columnas que se leen existen en la 0090', () => {
    const enElSql = columnasDe('creadores_eventos')
    for (const c of COLUMNAS_CREADORES_EVENTOS) expect(enElSql).toContain(c)
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
    expect(s).toEqual({ minimo: 1, bajo: true, conNota: 2, pendientes: 0, total: 2, reels: 1, reelsConS: 1 })
  })
  it('cuenta los pendientes y la cobertura', () => {
    const s = resumenS([reel({ notas: { S: 2 } }), reel({ notas: { S: null } }), reel({ notas: {} })])
    expect(s).toEqual({ minimo: 2, bajo: false, conNota: 1, pendientes: 2, total: 3, reels: 1, reelsConS: 1 })
  })
  it('dos revisores del mismo reel son dos evaluaciones de UN reel, no dos reels (N-02)', () => {
    const s = resumenS([
      reel({ id: 'a', mediaId: '777', revisor: 'claude', notas: { S: 3 } }),
      reel({ id: 'b', mediaId: '777', revisor: 'astra', notas: { S: 1 } }),
    ])
    expect(s.reels).toBe(1)
    expect(s.reelsConS).toBe(1)
    expect(s.total).toBe(2)
    expect(s.conNota).toBe(2)
    // El mínimo sigue siendo sobre TODAS las notas: el S=1 de Astra veta.
    expect(s.minimo).toBe(1)
    expect(s.bajo).toBe(true)
  })
  it('un reel cuenta como «con S» si alguno de sus revisores ya la puso', () => {
    const s = resumenS([
      reel({ id: 'a', mediaId: '1', revisor: 'claude', notas: { S: 2 } }),
      reel({ id: 'b', mediaId: '1', revisor: 'astra', notas: { S: null } }),
      reel({ id: 'c', mediaId: '2', revisor: 'claude', notas: {} }),
    ])
    expect(s).toMatchObject({ reels: 2, reelsConS: 1, conNota: 1, pendientes: 2, total: 3 })
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
