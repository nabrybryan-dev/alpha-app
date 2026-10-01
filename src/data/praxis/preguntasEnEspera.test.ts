import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TABLA_PREGUNTAS_EN_ESPERA, dejarPreguntaEnEspera } from './preguntasEnEspera'

const MIGRACION = join(process.cwd(), 'supabase', 'migrations', '0105_praxis_preguntas_en_espera.sql')

let abiertas: number
let errorConteo: { code: string; message: string } | null
let errorInsert: { code: string; message: string } | null
let insertado: Record<string, unknown> | undefined

vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    from: (tabla: string) => {
      expect(tabla).toBe('praxis_preguntas_en_espera')
      return {
        select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: errorConteo ? null : abiertas, error: errorConteo }) }) }),
        insert: (payload: Record<string, unknown>) => {
          insertado = payload
          return Promise.resolve({ error: errorInsert })
        },
      }
    },
  }),
}))

describe('la tabla es la de la migración 0105', () => {
  const sql = readFileSync(MIGRACION, 'utf8')

  it('existe con ese nombre y con las columnas que este archivo escribe', () => {
    expect(sql).toContain(`create table if not exists public.${TABLA_PREGUNTAS_EN_ESPERA}`)
    for (const columna of ['usuario_id', 'pregunta', 'destinatario', 'que_falto', 'citas', 'estado']) expect(sql).toMatch(new RegExp(`\\b${columna}\\b`))
  })

  it('enciende RLS, cierra anon y no deja a la persona decidir el estado ni borrar', () => {
    expect(sql).toMatch(/alter table public\.praxis_preguntas_en_espera enable row level security/)
    expect(sql).toMatch(/revoke all on public\.praxis_preguntas_en_espera from anon, public/)
    expect(sql).toMatch(/grant insert \(usuario_id, pregunta, destinatario, que_falto, citas\) on public\.praxis_preguntas_en_espera to authenticated/)
    expect(sql).not.toMatch(/grant[^;]*delete[^;]*praxis_preguntas_en_espera to authenticated/)
  })

  it('no trae datos de nadie: ni correos ni filas sembradas', () => {
    expect(sql).not.toMatch(/@[a-z0-9-]+\.(com|co|test)\b/)
    expect(sql).not.toMatch(/insert into public\.praxis_preguntas_en_espera/)
  })
})

describe('dejarPreguntaEnEspera', () => {
  beforeEach(() => {
    abiertas = 0
    errorConteo = null
    errorInsert = null
    insertado = undefined
  })
  const base = { usuarioId: 'u-1', frase: '¿Por qué bajó la carga del press?', queFalto: 'porque_no_escrito' as const, citas: ['M5→M6 · PRESS BANCA · cargaKg'] }

  it('guarda la pregunta de la persona, con el rol al que va', async () => {
    await expect(dejarPreguntaEnEspera(base)).resolves.toEqual({ ok: true, destinatario: 'coach' })
    expect(insertado).toEqual({ usuario_id: 'u-1', pregunta: '¿Por qué bajó la carga del press?', destinatario: 'coach', que_falto: 'porque_no_escrito', citas: ['M5→M6 · PRESS BANCA · cargaKg'] })
  })

  it('una frase con riesgo NO se inserta', async () => {
    await expect(dejarPreguntaEnEspera({ ...base, frase: '¿qué hago si me quiero morir?' })).resolves.toEqual({ ok: false, motivo: 'riesgo' })
    expect(insertado).toBeUndefined()
  })

  it('con dos abiertas no inserta la tercera', async () => {
    abiertas = 2
    await expect(dejarPreguntaEnEspera(base)).resolves.toEqual({ ok: false, motivo: 'tope' })
    expect(insertado).toBeUndefined()
  })

  it('si la tabla todavía no existe (migración sin aplicar), lo dice: no finge que la dejó', async () => {
    errorConteo = { code: '42P01', message: 'relation "praxis_preguntas_en_espera" does not exist' }
    await expect(dejarPreguntaEnEspera(base)).resolves.toEqual({ ok: false, motivo: 'no_disponible' })
    expect(insertado).toBeUndefined()
  })

  it('PostgREST también dice que la tabla no existe con PGRST205', async () => {
    errorInsert = { code: 'PGRST205', message: "Could not find the table 'public.praxis_preguntas_en_espera' in the schema cache" }
    await expect(dejarPreguntaEnEspera(base)).resolves.toEqual({ ok: false, motivo: 'no_disponible' })
  })

  it('si la base rechaza la fila por el tope (RLS), es «tope» y no un éxito', async () => {
    errorInsert = { code: '42501', message: 'new row violates row-level security policy' }
    await expect(dejarPreguntaEnEspera(base)).resolves.toEqual({ ok: false, motivo: 'tope' })
  })

  it('cualquier otro error es un error, nunca un «listo»', async () => {
    errorInsert = { code: 'XX000', message: 'algo' }
    await expect(dejarPreguntaEnEspera(base)).resolves.toEqual({ ok: false, motivo: 'error' })
  })

  it('sin usuario no hace nada', async () => {
    await expect(dejarPreguntaEnEspera({ ...base, usuarioId: '' })).resolves.toEqual({ ok: false, motivo: 'sin_nube' })
  })
})
