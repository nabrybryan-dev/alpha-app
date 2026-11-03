import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * «Ejercicio completado» en tema claro (ronda 2, R2-4). El velo usaba `var(--ink-900)`,
 * un alias que se calcula en `:root` y llega ya resuelto: invertir `--ink-900-rgb` dentro
 * de `[data-sesion]` no lo alcanzaba y quedaba un velo negro a pantalla completa. Hay que
 * leer el canal `-rgb` EN el elemento, para que siga el ámbito invertido.
 */
const fuente = readFileSync(join(__dirname, 'EjercicioCompletado.tsx'), 'utf8')

describe('EjercicioCompletado sigue el tema', () => {
  it('el velo lee el canal -rgb (sigue el ámbito invertido), no el alias de :root', () => {
    expect(fuente).toMatch(/background:\s*'rgb\(var\(--ink-900-rgb\)\)'/)
  })
  it('no usa ningún alias var(--ink-N) ni var(--silver-N) fijado en :root', () => {
    expect(fuente).not.toMatch(/var\(--(ink|silver)-\d+\)/)
  })
})
