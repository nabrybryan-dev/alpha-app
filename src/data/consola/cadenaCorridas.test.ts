import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  aCadenaCorrida,
  COLUMNAS_CADENA_CORRIDAS,
  corridasDeLaCadena,
  corridasDeTodaLaCartera,
  type FilaCadenaCorrida,
  TABLA_CADENA_CORRIDAS,
  ultimoEventoPorPaso,
} from './cadenaCorridas'

const MIGRACION = join(process.cwd(), 'supabase', 'migrations', '0083_consola_servidor_y_permisos.sql')

function filaDePrueba(extra: Partial<FilaCadenaCorrida> = {}): FilaCadenaCorrida {
  return {
    id: 'id-1',
    event_id: 'evento-1',
    run_id: 'run-1',
    usuario_id: 'u-1',
    semana_inicio: '2026-09-28',
    paso: 1,
    intento: 1,
    estado: 'completado',
    secuencia: 1,
    hash_artefacto: 'hash-1',
    version_reglas: 'reglas-v1',
    fecha_dato: '2026-09-28T12:00:00Z',
    fecha_recepcion: '2026-09-28T12:05:00Z',
    resumen: 'Dictamen de la semana',
    avisos: [],
    preguntas_pendientes: [],
    creado_en: '2026-09-28T12:05:00Z',
    ...extra,
  }
}

describe('el nombre de las columnas sale de la migración 0083, no se inventa aquí', () => {
  it('cada columna que se pide con select() existe de verdad en la tabla cadena_corridas', () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    const bloque = sql.slice(
      sql.indexOf('create table if not exists public.cadena_corridas'),
      sql.indexOf('comment on table public.cadena_corridas'),
    )
    expect(bloque.length).toBeGreaterThan(0)
    for (const columna of COLUMNAS_CADENA_CORRIDAS) {
      expect(bloque, `la migración 0083 no declara la columna "${columna}"`).toMatch(
        new RegExp(`\\b${columna}\\b`),
      )
    }
  })

  it('la tabla que se consulta es la que crea la migración', () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    expect(sql).toContain(`create table if not exists public.${TABLA_CADENA_CORRIDAS}`)
  })
})

describe('aCadenaCorrida: traduce la fila cruda al vocabulario del dominio', () => {
  it('pasa camelCase y conserva los valores', () => {
    const fila = filaDePrueba()
    expect(aCadenaCorrida(fila)).toEqual({
      id: 'id-1',
      eventId: 'evento-1',
      runId: 'run-1',
      usuarioId: 'u-1',
      semanaInicio: '2026-09-28',
      paso: 1,
      intento: 1,
      estado: 'completado',
      secuencia: 1,
      hashArtefacto: 'hash-1',
      versionReglas: 'reglas-v1',
      fechaDato: '2026-09-28T12:00:00Z',
      fechaRecepcion: '2026-09-28T12:05:00Z',
      resumen: 'Dictamen de la semana',
      avisos: [],
      preguntasPendientes: [],
      creadoEn: '2026-09-28T12:05:00Z',
    })
  })

  it('descarta (no lanza, no inventa) una fila con un paso fuera de 1-4', () => {
    expect(aCadenaCorrida(filaDePrueba({ paso: 9 }))).toBeNull()
  })

  it('descarta una fila con un estado que no reconoce', () => {
    expect(aCadenaCorrida(filaDePrueba({ estado: 'algo-nuevo' }))).toBeNull()
  })

  it('avisos y preguntas_pendientes que no llegan como arreglo se vuelven arreglo vacío, no undefined', () => {
    const fila = aCadenaCorrida(filaDePrueba({ avisos: null, preguntas_pendientes: 'no-es-un-arreglo' }))
    expect(fila?.avisos).toEqual([])
    expect(fila?.preguntasPendientes).toEqual([])
  })
})

describe('ultimoEventoPorPaso: el último por secuencia, no por orden de llegada', () => {
  it('se queda con la mayor secuencia de cada paso', () => {
    const c1 = aCadenaCorrida(filaDePrueba({ id: 'a', paso: 1, secuencia: 1 }))!
    const c2 = aCadenaCorrida(filaDePrueba({ id: 'b', paso: 1, secuencia: 3 }))!
    const c3 = aCadenaCorrida(filaDePrueba({ id: 'c', paso: 2, secuencia: 2 }))!
    const resultado = ultimoEventoPorPaso([c1, c2, c3])
    expect(resultado[1]?.id).toBe('b')
    expect(resultado[2]?.id).toBe('c')
    expect(resultado[3]).toBeUndefined()
  })

  it('una lista vacía da un objeto vacío, no lanza', () => {
    expect(ultimoEventoPorPaso([])).toEqual({})
  })
})

let filas: FilaCadenaCorrida[]
let errorPropio: { code: string; message: string } | null
let usuarioFiltrado: string | undefined
let semanaFiltrada: string | undefined
let columnasPedidas: string | undefined

vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    from: (tabla: string) => {
      expect(tabla).toBe('cadena_corridas')
      return {
        select: (columnas: string) => {
          columnasPedidas = columnas
          return {
            eq: (columna: string, valor: string) => {
              if (columna === 'usuario_id') usuarioFiltrado = valor
              if (columna === 'semana_inicio') semanaFiltrada = valor
              const encadenable = {
                eq: (columna2: string, valor2: string) => {
                  if (columna2 === 'semana_inicio') semanaFiltrada = valor2
                  return { order: () => Promise.resolve({ data: filas, error: errorPropio }) }
                },
                order: () => Promise.resolve({ data: filas, error: errorPropio }),
              }
              return encadenable
            },
            order: () => Promise.resolve({ data: filas, error: errorPropio }),
          }
        },
      }
    },
  }),
}))

describe('corridasDeLaCadena: nunca lanza, y filtra por LA persona correcta', () => {
  beforeEach(() => {
    filas = [filaDePrueba()]
    errorPropio = null
    usuarioFiltrado = undefined
    semanaFiltrada = undefined
    columnasPedidas = undefined
  })

  it('pide exactamente las columnas declaradas, ni una de más ni de menos', async () => {
    await corridasDeLaCadena('u-1')
    expect(columnasPedidas).toBe(COLUMNAS_CADENA_CORRIDAS.join(','))
  })

  it('filtra por SU usuario_id, no por "lo que devuelva"', async () => {
    await corridasDeLaCadena('u-especifico')
    expect(usuarioFiltrado).toBe('u-especifico')
  })

  it('con semanaInicio, también filtra por semana', async () => {
    await corridasDeLaCadena('u-1', '2026-09-28')
    expect(semanaFiltrada).toBe('2026-09-28')
  })

  it('sin semanaInicio, no restringe por semana', async () => {
    await corridasDeLaCadena('u-1')
    expect(semanaFiltrada).toBeUndefined()
  })

  it('devuelve [] ante un error de la base, nunca lanza', async () => {
    errorPropio = { code: '42P01', message: 'relation "cadena_corridas" does not exist' }
    await expect(corridasDeLaCadena('u-1')).resolves.toEqual([])
  })

  it('sin usuarioId no consulta nada', async () => {
    columnasPedidas = undefined
    await corridasDeLaCadena('')
    expect(columnasPedidas).toBeUndefined()
  })
})

describe('corridasDeTodaLaCartera: toda la cadena de una vez, sin filtrar por persona', () => {
  beforeEach(() => {
    filas = [filaDePrueba({ id: 'a', usuario_id: 'u-1' }), filaDePrueba({ id: 'b', usuario_id: 'u-2' })]
    errorPropio = null
    usuarioFiltrado = undefined
    columnasPedidas = undefined
  })

  it('pide exactamente las columnas declaradas', async () => {
    await corridasDeTodaLaCartera()
    expect(columnasPedidas).toBe(COLUMNAS_CADENA_CORRIDAS.join(','))
  })

  it('no filtra por usuario_id: trae la cartera entera', async () => {
    const corridas = await corridasDeTodaLaCartera()
    expect(usuarioFiltrado).toBeUndefined()
    expect(corridas.map((c) => c.usuarioId)).toEqual(['u-1', 'u-2'])
  })

  it('devuelve [] ante un error de la base, nunca lanza', async () => {
    errorPropio = { code: '42P01', message: 'relation "cadena_corridas" does not exist' }
    await expect(corridasDeTodaLaCartera()).resolves.toEqual([])
  })
})
