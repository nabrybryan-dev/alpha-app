import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// La tabla `estandarizado_ejercicio` (0043) se sembro una vez el 2026-08-25 y nadie la recalculaba. La
// 0149 pone quien: una funcion de la base que recalcula todo lo derivado, programada con pg_cron. Este
// test no corre SQL (no hay Postgres en vitest): fija por texto lo que NO puede perderse de la migracion
// y que sus constantes sean las mismas que usa `estandarizacion.ts`. La prueba contra Postgres vive en
// `supabase/test/220-estandarizado-recalculo.sql` y corre en la CI.

// Las constantes se leen del TEXTO de estandarizacion.ts y no se importan: importarlo desde un test de
// src/ lo haria pasar por «enchufado» ante codigo-huerfano.test.ts, y no lo esta (ver ese test).
function constante(nombre: string): number {
  const m = new RegExp(`export const ${nombre} = (\\d+)`).exec(readFileSync('src/domain/estandarizacion.ts', 'utf8'))
  expect(m, `no se encontro ${nombre}`).not.toBeNull()
  return Number(m![1])
}
const RACHA_PARA_ESTANDARIZAR = constante('RACHA_PARA_ESTANDARIZAR')
const BANDA_RIR = constante('BANDA_RIR')

const RUTA = 'supabase/migrations/0149_estandarizado_se_recalcula.sql'

function sql(): string {
  expect(existsSync(RUTA), `falta ${RUTA}`).toBe(true)
  // Sin comentarios: lo que se afirma tiene que estar en el codigo, no en la prosa.
  return readFileSync(RUTA, 'utf8')
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n')
}

describe('0149 · quien recalcula estandarizado_ejercicio', () => {
  it('existe la funcion, con ruta fija, de definer y solo para el servidor', () => {
    const s = sql()
    expect(s).toMatch(/create or replace function public\.recalcular_estandarizado\(\)/)
    expect(s).toMatch(/security definer/)
    expect(s).toMatch(/set search_path = public/)
    expect(s).toMatch(/revoke all on function public\.recalcular_estandarizado\(\) from public, anon, authenticated/)
    expect(s).toMatch(/grant execute on function public\.recalcular_estandarizado\(\) to service_role/)
  })

  it('el motivo guardado es el de la ULTIMA ruptura (order by numero desc), no el de la primera', () => {
    expect(sql()).toMatch(/array_agg\(motivo order by numero desc\) filter \(where ev = 'rompe'\)/)
  })

  it('no pisa un veto del coach: solo actualiza filas derivadas', () => {
    const s = sql()
    expect(s).toMatch(/on conflict \(usuario_id, ejercicio_id\) do update/)
    expect(s).toMatch(/where public\.estandarizado_ejercicio\.origen = 'derivado'/)
  })

  it('usa la misma racha y la misma banda que el modulo de dominio', () => {
    const s = sql()
    expect(s).toContain(`ok >= ${RACHA_PARA_ESTANDARIZAR}`)
    expect(s).toContain(`> ${BANDA_RIR}`)
  })

  it('una racha solo suma con el microciclo cerrado (marcar de mas es el error caro)', () => {
    expect(sql()).toMatch(/estado_micro = 'cerrado'\s+then 'suma'/)
  })

  it('el cron se programa solo si pg_cron existe, y es idempotente', () => {
    const s = sql()
    expect(s).toMatch(/pg_available_extensions where name = 'pg_cron'/)
    expect(s).toMatch(/cron\.unschedule\('recalcular-estandarizado'\)/)
    expect(s).toMatch(/cron\.schedule\(\s*'recalcular-estandarizado'/)
  })

  it('no toca otras tablas: ninguna escritura fuera de estandarizado_ejercicio', () => {
    const s = sql()
    expect(s).not.toMatch(/(insert into|update|delete from)\s+public\.(?!estandarizado_ejercicio)/)
  })
})
