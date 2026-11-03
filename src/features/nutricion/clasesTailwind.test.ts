import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Las clases de color que usan las pantallas tienen que existir en el tema. Un
 * `bg-` inventado no rompe el build: se pinta transparente y nadie se entera.
 */
describe('clases del tema', () => {
  it('logrado, la clase del punto y de la barra, está definida', () => {
    const config = readFileSync(resolve(process.cwd(), 'tailwind.config.js'), 'utf8')

    expect(config).toMatch(/logrado:/)
  })
})
