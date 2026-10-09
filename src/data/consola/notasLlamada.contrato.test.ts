import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COLUMNAS_NOTAS_LLAMADA, TABLA_NOTAS_LLAMADA } from './notasLlamada'

/**
 * Lo que este archivo pide a la base, contra lo que las migraciones crean.
 *
 * POR QUÉ EXISTE. La 0112 se aplicó a producción sin que su archivo entrara al repo (9-oct-2026):
 * durante un día `COLUMNAS_NOTAS_LLAMADA` no tuvo contra qué compararse, y una columna mal
 * escrita aquí habría dado un `select` roto en producción con las 7.359 pruebas en verde —
 * `notasLlamada.test.ts` dobla a Supabase, así que acepta cualquier nombre. Esta prueba lee los
 * dos archivos de verdad: si alguien añade una columna al código sin su migración (o al revés),
 * falla aquí y no en el teléfono de Manuela.
 */
const MIGRACIONES = join(process.cwd(), 'supabase', 'migrations')
const SQL_0112 = readFileSync(join(MIGRACIONES, '0112_notas_de_llamada.sql'), 'utf8')
const SQL_0113 = readFileSync(join(MIGRACIONES, '0113_notas_llamada_la_puerta_de_la_consola.sql'), 'utf8')

/** Quita los comentarios `-- …`: el texto de un comentario no es esquema. */
function sinComentarios(sql: string): string {
  return sql
    .split('\n')
    .map((linea) => linea.replace(/--.*$/, ''))
    .join('\n')
}

function columnasDelCreateTable(sql: string, tabla: string): string[] {
  const limpio = sinComentarios(sql)
  const inicio = limpio.indexOf(`create table public.${tabla} (`)
  expect(inicio, `la 0112 no crea ${tabla}`).toBeGreaterThanOrEqual(0)
  return limpio
    .slice(inicio, limpio.indexOf('\n);', inicio))
    .split('\n')
    .slice(1)
    .map((linea) => linea.trim())
    .filter((linea) => /^[a-z_]+\s/.test(linea) && !/^(unique|constraint|check|primary|foreign)\b/.test(linea))
    .map((linea) => linea.split(/\s+/)[0])
}

function columnasAnadidas(sql: string, tabla: string): string[] {
  const patron = new RegExp(`alter table public\\.${tabla} add column(?: if not exists)? ([a-z_]+)`, 'g')
  return [...sinComentarios(sql).matchAll(patron)].map((m) => m[1])
}

describe('notas de llamada · las columnas del código son las de las migraciones', () => {
  const enLaBase = [
    ...columnasDelCreateTable(SQL_0112, TABLA_NOTAS_LLAMADA),
    ...columnasAnadidas(SQL_0113, TABLA_NOTAS_LLAMADA),
  ]

  it('el lector de migraciones ve las columnas (si no ve ninguna, lo de abajo no prueba nada)', () => {
    expect(columnasDelCreateTable(SQL_0112, TABLA_NOTAS_LLAMADA)).toEqual([
      'id',
      'usuario_id',
      'coach_id',
      'fecha',
      'hora',
      'conclusiones',
      'proxima_reunion',
      'creado_en',
    ])
    expect(columnasAnadidas(SQL_0113, TABLA_NOTAS_LLAMADA)).toEqual(['tareas'])
  })

  it('cada columna que el código pide existe en la tabla', () => {
    for (const columna of COLUMNAS_NOTAS_LLAMADA) {
      expect(enLaBase, `el código pide «${columna}» y ninguna migración la crea`).toContain(columna)
    }
  })

  it('y no queda ninguna columna de la tabla sin leer', () => {
    expect([...COLUMNAS_NOTAS_LLAMADA].sort()).toEqual([...enLaBase].sort())
  })
})

describe('notas de llamada · la puerta es la de la consola, no la de la 0112', () => {
  const sql = sinComentarios(SQL_0113)

  it('la 0113 rehace las dos políticas con es_coach() o leer_entrenamiento', () => {
    for (const politica of ['notas_llamada_leer', 'notas_llamada_escribir']) {
      expect(sql, `la 0113 no retira la política vieja ${politica}`).toContain(
        `drop policy if exists ${politica} on public.notas_llamada`,
      )
      const inicio = sql.indexOf(`create policy ${politica} on public.notas_llamada`)
      expect(inicio, `la 0113 no crea ${politica}`).toBeGreaterThanOrEqual(0)
      const cuerpo = sql.slice(inicio, sql.indexOf(';', inicio))
      expect(cuerpo).toContain('to authenticated')
      expect(cuerpo).toContain('public.es_coach()')
      expect(cuerpo).toContain("public.tiene_capacidad('leer_entrenamiento')")
    }
  })

  it('quien anota sigue siendo quien dice la base: coach_id = auth.uid() en la política de escritura', () => {
    const inicio = sql.indexOf('create policy notas_llamada_escribir')
    expect(sql.slice(inicio, sql.indexOf(';', inicio))).toContain('coach_id = (select auth.uid())')
  })

  it('anon se queda sin nada y authenticated solo con select e insert', () => {
    expect(sql).toContain('revoke all on public.notas_llamada from anon, public;')
    expect(sql).toContain('revoke all on public.notas_llamada from authenticated;')
    expect(sql).toContain('grant select, insert on public.notas_llamada to authenticated;')
    expect(sql).not.toMatch(/grant[^;]*\b(update|delete|truncate|all)\b[^;]*to authenticated/)
  })
})
