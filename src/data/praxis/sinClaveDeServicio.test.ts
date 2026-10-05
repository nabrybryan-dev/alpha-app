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
// Cualquier forma de nombrar una clave de servicio: la variable vieja, la nueva de Supabase
// (`SUPABASE_SECRET_KEY`, `sb_secret_…`) y el rol, en mayúsculas o minúsculas (revisión del
// PR #331, B2). Se busca en el CÓDIGO: los comentarios se quitan antes, porque varios dicen
// justamente «nunca con service_role».
const CLAVE = /service_role|secret_key|sb_secret_/i
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivos(ruta)
    return /\.(ts|tsx)$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : []
  })
}

describe('Praxis no usa la clave de servicio', () => {
  it('la guarda ve una clave de servicio donde sí la hay', () => {
    expect(CLAVE.test(sinComentarios(readFileSync(join(RAIZ, 'supabase', 'functions', 'responder-chat', 'index.ts'), 'utf8')))).toBe(true)
  })

  it.each([
    ['la Edge Function praxis-registro', join(RAIZ, 'supabase', 'functions', 'praxis-registro')],
    ['el dominio de Praxis', join(RAIZ, 'src', 'domain', 'praxis')],
    ['la capa de datos de Praxis', join(RAIZ, 'src', 'data', 'praxis')],
    ['la pantalla de Praxis', join(RAIZ, 'src', 'features', 'praxis')],
  ])('%s no la nombra', (_, dir) => {
    const lista = archivos(dir)
    expect(lista.length).toBeGreaterThan(0)
    const culpables = lista.filter((f) => CLAVE.test(sinComentarios(readFileSync(f, 'utf8'))))
    expect(culpables).toEqual([])
  })
})

describe('la guarda ve las formas nuevas de la clave', () => {
  it.each([
    "const k = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')",
    "const k = Deno.env.get('SUPABASE_SECRET_KEY')",
    "const k = 'sb_secret_abc'",
    "headers: { role: 'service_role' }",
  ])('«%s»', (codigo) => {
    expect(CLAVE.test(sinComentarios(codigo))).toBe(true)
  })

  it('un comentario que dice «nunca con service_role» no es un uso', () => {
    expect(CLAVE.test(sinComentarios('// se lee con el JWT, nunca con service_role\nconst a = 1'))).toBe(false)
    expect(CLAVE.test(sinComentarios('/* nunca con service_role */ const a = 1'))).toBe(false)
  })
})
