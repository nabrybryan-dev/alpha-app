import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TABLA_AVISOS_COACH, dejarAvisoAlCoach } from './avisoAlCoach'

const MIGRACION = join(process.cwd(), 'supabase', 'migrations', '0108_praxis_avisos_coach.sql')
const FRASE_DE_PRUEBA = 'me duele mucho el codo zzfrase-ficticia'

let insertados: Record<string, unknown>[]
let llamadasSelect: number
let respuesta: () => Promise<{ error: { code: string; message: string } | null }>
let tablaPedida: string | undefined

vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    from: (tabla: string) => {
      tablaPedida = tabla
      return {
        insert: (payload: Record<string, unknown>) => {
          insertados.push(payload)
          return {
            select: () => {
              llamadasSelect++
              return respuesta()
            },
            then: (a: (v: unknown) => unknown, b?: (e: unknown) => unknown) => respuesta().then(a, b),
          }
        },
      }
    },
  }),
}))

beforeEach(() => {
  insertados = []
  llamadasSelect = 0
  tablaPedida = undefined
  respuesta = () => Promise.resolve({ error: null })
})

describe('la tabla es la de la migración 0108', () => {
  const sql = readFileSync(MIGRACION, 'utf8')
  it('tiene ese nombre y las tres columnas que se escriben, y ninguna de texto', () => {
    expect(sql).toContain(TABLA_AVISOS_COACH)
    for (const c of ['usuario_id', 'origen', 'nivel']) expect(sql).toMatch(new RegExp(String.raw`\b${c}\b`))
  })
})

describe('dejarAvisoAlCoach', () => {
  it('escribe EXACTAMENTE una fila de tres campos, sin .select()', async () => {
    const r = await dejarAvisoAlCoach({ usuarioId: 'u-aviso-1', nivel: 'salud' })
    expect(r).toEqual({ ok: true })
    expect(tablaPedida).toBe('praxis_avisos_coach')
    expect(insertados).toEqual([{ usuario_id: 'u-aviso-1', origen: 'praxis', nivel: 'salud' }])
    expect(llamadasSelect).toBe(0)
  })

  it('la entrada no tiene dónde poner la frase: ni siquiera pasándola a la fuerza llega a la base', async () => {
    await dejarAvisoAlCoach({ usuarioId: 'u-aviso-1', nivel: 'salud', frase: FRASE_DE_PRUEBA } as unknown as { usuarioId: string; nivel: 'salud' })
    expect(JSON.stringify(insertados)).not.toContain('zzfrase')
    expect(Object.keys(insertados[0]).sort()).toEqual(['nivel', 'origen', 'usuario_id'])
  })

  it('un nivel inválido no se envía', async () => {
    const r = await dejarAvisoAlCoach({ usuarioId: 'u-aviso-1', nivel: 'cualquier cosa' as never })
    expect(r).toEqual({ ok: false, motivo: 'nivel' })
    expect(insertados).toEqual([])
  })

  it('sin id de usuario no escribe', async () => {
    expect(await dejarAvisoAlCoach({ usuarioId: '', nivel: 'salud' })).toEqual({ ok: false, motivo: 'sin_nube' })
    expect(insertados).toEqual([])
  })

  it.each(['42P01', 'PGRST205'])('tabla sin migrar (%s): no_disponible, nunca ok', async (code) => {
    respuesta = () => Promise.resolve({ error: { code, message: 'x' } })
    expect(await dejarAvisoAlCoach({ usuarioId: 'u-aviso-1', nivel: 'vida' })).toEqual({ ok: false, motivo: 'no_disponible' })
  })

  it('otro error de la base: error', async () => {
    respuesta = () => Promise.resolve({ error: { code: '42501', message: 'x' } })
    expect(await dejarAvisoAlCoach({ usuarioId: 'u-aviso-1', nivel: 'vida' })).toEqual({ ok: false, motivo: 'error' })
  })

  it('red caída (rechazo): error, y no lanza', async () => {
    respuesta = () => Promise.reject(new Error('red'))
    expect(await dejarAvisoAlCoach({ usuarioId: 'u-aviso-1', nivel: 'nino' })).toEqual({ ok: false, motivo: 'error' })
  })

  it('tiempo agotado: error, y no lanza', async () => {
    vi.useFakeTimers()
    try {
      respuesta = () => new Promise(() => {})
      const p = dejarAvisoAlCoach({ usuarioId: 'u-aviso-1', nivel: 'pareja' })
      await vi.advanceTimersByTimeAsync(3100)
      expect(await p).toEqual({ ok: false, motivo: 'error' })
    } finally {
      vi.useRealTimers()
    }
  })
})
