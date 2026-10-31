import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COLUMNAS_GUIONES_LLAMADA, TABLA_GUIONES_LLAMADA } from './guionesLlamada'

/**
 * Lo que este archivo pide a la base, contra lo que crea la 0151 — y la puerta de la 0151 contra
 * la de la 0113. `guionesLlamada.test.ts` dobla a Supabase y aceptaría cualquier nombre de
 * columna; esta prueba lee el SQL de verdad.
 */
const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0151_guiones_llamada.sql'), 'utf8')
  // `\r?`: con CRLF en la copia de trabajo, `.` no cruza el `\r` y el comentario no se quitaría.
  .split(/\r?\n/)
  .map((linea) => linea.replace(/--.*$/, ''))
  .join('\n')

function columnasDelCreateTable(): string[] {
  const inicio = SQL.indexOf(`create table if not exists public.${TABLA_GUIONES_LLAMADA} (`)
  expect(inicio, 'la 0151 no crea la tabla').toBeGreaterThanOrEqual(0)
  return SQL.slice(inicio, SQL.indexOf('\n);', inicio))
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => /^[a-z_]+\s/.test(l) && !/^(unique|constraint|check|primary|foreign)\b/.test(l))
    .map((l) => l.split(/\s+/)[0])
}

describe('guiones de llamada · el código y la 0151 dicen lo mismo', () => {
  it('las columnas que se piden son las que crea la migración, en el mismo orden', () => {
    expect([...COLUMNAS_GUIONES_LLAMADA]).toEqual(columnasDelCreateTable())
  })

  it('el upsert de la función tiene su unique (usuario_id, revision)', () => {
    expect(SQL).toMatch(/unique \(usuario_id, revision\)/)
    const funcion = readFileSync(join(process.cwd(), 'supabase', 'functions', 'guion-llamada', 'index.ts'), 'utf8')
    expect(funcion).toContain('onConflict: "usuario_id,revision"')
  })

  it('la puerta es la de la consola (0113), no es_staff, y solo hay lectura', () => {
    expect(SQL).toMatch(/enable row level security/)
    expect(SQL).toMatch(/for select to authenticated/)
    expect(SQL).toMatch(/\(select public\.es_coach\(\)\)\s+or \(select public\.tiene_capacidad\('leer_entrenamiento'\)\)/)
    expect(SQL).not.toMatch(/es_staff/)
    expect(SQL).not.toMatch(/for (insert|update|delete|all)\b/)
    expect(SQL).toMatch(/revoke all on public\.guiones_llamada from anon, public;/)
    expect(SQL).toMatch(/grant select on public\.guiones_llamada to authenticated;/)
  })
})
