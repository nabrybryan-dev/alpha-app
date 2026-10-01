import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Praxis lee y escribe SIEMPRE con el JWT de la persona, nunca con la clave de servicio
 * (DISENO.md §1.3). Con la clave de servicio la RLS no aplica: un fallo en un filtro
 * dejaría leer o escribir lo de otro asesorado.
 *
 * `responder-chat` sí la usa (es anterior), y sirve de control: si esta guarda no la viera
 * ahí, no estaría mirando nada.
 */
const RAIZ = process.cwd()
const CLAVE = /SERVICE_ROLE/

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivos(ruta)
    return /\.(ts|tsx)$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : []
  })
}

describe('Praxis no usa la clave de servicio', () => {
  it('la guarda ve una clave de servicio donde sí la hay', () => {
    expect(CLAVE.test(readFileSync(join(RAIZ, 'supabase', 'functions', 'responder-chat', 'index.ts'), 'utf8'))).toBe(true)
  })

  it.each([
    ['la Edge Function praxis-registro', join(RAIZ, 'supabase', 'functions', 'praxis-registro')],
    ['el dominio de Praxis', join(RAIZ, 'src', 'domain', 'praxis')],
    ['la capa de datos de Praxis', join(RAIZ, 'src', 'data', 'praxis')],
    ['la pantalla de Praxis', join(RAIZ, 'src', 'features', 'praxis')],
  ])('%s no la nombra', (_, dir) => {
    const lista = archivos(dir)
    expect(lista.length).toBeGreaterThan(0)
    const culpables = lista.filter((f) => CLAVE.test(readFileSync(f, 'utf8')))
    expect(culpables).toEqual([])
  })
})
