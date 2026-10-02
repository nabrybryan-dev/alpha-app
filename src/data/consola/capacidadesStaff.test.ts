import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// El `check` vigente es el que redefinió la 0090 (la 0083 más `aprobar_primer_plan`,
// `aprobar_plan_estrategico`, `revisar_creadores` y `firmar_creadores`).
const MIGRACION = join(process.cwd(), 'supabase', 'migrations', '0090_creadores_tablero_lectura.sql')

interface FilaError {
  message: string
}

const estado = {
  activo: true,
  filas: [] as unknown[],
  error: null as FilaError | null,
  usuarioPedido: undefined as string | undefined,
}

function cliente() {
  return {
    from: (tabla: string) => {
      if (tabla !== 'capacidades_staff') throw new Error(`tabla inesperada: ${tabla}`)
      return {
        select: () => ({
          eq: (_columna: string, valor: string) => {
            estado.usuarioPedido = valor
            return Promise.resolve({ data: estado.filas, error: estado.error })
          },
        }),
      }
    },
  }
}

vi.mock('../supabase', () => ({
  get modoNube() {
    return estado.activo
  },
  supabase: () => cliente(),
}))

const { CAPACIDADES, capacidadesDe } = await import('./capacidadesStaff')

beforeEach(() => {
  estado.activo = true
  estado.filas = []
  estado.error = null
  estado.usuarioPedido = undefined
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Las migraciones que sumaron una capacidad cada una leyendo la lista vigente de la base
// (`array['nueva']` dentro de su bloque DO), en el orden en que se aplican.
const AMPLIACIONES = [
  ['0094_decisiones_compartidas.sql', 'decisiones_compartidas'],
  ['0095_comentarios_app.sql', 'triar_comentarios'],
  ['0096_buzon_mercadeo.sql', 'responder_mercadeo'],
  ['0098_plan_items.sql', 'organizar_plan'],
  ['0102_admin_tablero.sql', 'ver_administracion'],
  ['0106_dos_cuentas_de_bryan.sql', 'solo_tablero'],
  ['0106_dos_cuentas_de_bryan.sql', 'puesto_de_coach'],
] as const

describe('CAPACIDADES sale del mismo vocabulario que el `check` vigente (0083 + 0086 + 0087 + 0090 + 0094 a 0098, 0102 y 0106)', () => {
  it('cada capacidad declarada aquí existe en el `check` de la migración, y al revés', () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    const inicio = sql.indexOf('add constraint capacidades_staff_capacidad_check')
    const bloque = sql.slice(inicio, sql.indexOf('));', inicio))
    expect(inicio).toBeGreaterThan(0)
    const enElSql = [...bloque.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    for (const [archivo, capacidad] of AMPLIACIONES) {
      const migracion = readFileSync(join(process.cwd(), 'supabase', 'migrations', archivo), 'utf8')
      // La suma la declara UNA vez, y la migración no copia la lista de otra: la lee de la base.
      expect(migracion, `${archivo} no suma «${capacidad}»`).toMatch(new RegExp(`array\\[[^\\]]*'${capacidad}'`))
      expect(migracion, `${archivo} copia la lista en vez de leer la vigente`).toContain('pg_get_constraintdef')
      enElSql.push(capacidad)
    }
    for (const capacidad of CAPACIDADES) {
      expect(enElSql, `ninguna migración declara la capacidad "${capacidad}"`).toContain(capacidad)
    }
    expect([...enElSql].sort()).toEqual([...CAPACIDADES].sort())
  })
})

describe('capacidadesDe', () => {
  it('en modo demo no consulta nada', async () => {
    estado.activo = false
    await expect(capacidadesDe('u-1')).resolves.toEqual([])
  })

  it('sin usuarioId no consulta nada', async () => {
    await expect(capacidadesDe('')).resolves.toEqual([])
  })

  it('filtra por SU usuario_id', async () => {
    estado.filas = []
    await capacidadesDe('u-especifico')
    expect(estado.usuarioPedido).toBe('u-especifico')
  })

  it('devuelve la lista de capacidades de las filas', async () => {
    estado.filas = [{ capacidad: 'detener_publicacion' }, { capacidad: 'reportar_riesgo' }]
    await expect(capacidadesDe('u-1')).resolves.toEqual(['detener_publicacion', 'reportar_riesgo'])
  })

  it('descarta una capacidad que no reconoce, en vez de colarla disfrazada de válida', async () => {
    estado.filas = [{ capacidad: 'detener_publicacion' }, { capacidad: 'inventada' }]
    await expect(capacidadesDe('u-1')).resolves.toEqual(['detener_publicacion'])
  })

  it('ante un error de la base devuelve [], nunca lanza', async () => {
    estado.error = { message: 'RLS' }
    await expect(capacidadesDe('u-1')).resolves.toEqual([])
  })
})
