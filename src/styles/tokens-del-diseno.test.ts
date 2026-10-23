import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Los tokens del «Diseño final 3» (maqueta 7) que `tokens.css` de main todavía no tenía:
 *
 *   · `--salon-3d-*`: los colores de la escena 3D del salón que el CSS necesita (piel, base, apagada, luz,
 *     hueso, cielo, tierra, sombra y brillo), en los dos temas.
 *   · `--pt-*`: el canto en relieve de la tecla 3D (luz, cuatro cantos y sombra), en los dos temas.
 *
 * Los muelles, las curvas y las duraciones YA estaban en `tokens.css`: no se vuelven a definir aquí.
 */
const css = readFileSync(join(__dirname, 'tokens.css'), 'utf8').replace(/\r\n/g, '\n')

function bloque(abre: string): string {
  const inicio = css.indexOf(abre)
  expect(inicio, `no hay bloque «${abre}»`).toBeGreaterThanOrEqual(0)
  return css.slice(inicio, css.indexOf('\n}', inicio))
}

const oscuro = bloque(':root,\n[data-theme="dark"] {')
const claro = bloque('[data-theme="light"] {')

const NUEVOS = [
  'salon-3d-piel', 'salon-3d-base', 'salon-3d-apagada', 'salon-3d-luz', 'salon-3d-hueso',
  'salon-3d-cielo', 'salon-3d-tierra', 'salon-3d-sombra', 'salon-3d-brillo',
  'pt-luz', 'pt-canto-1', 'pt-canto-2', 'pt-canto-3', 'pt-canto-4', 'pt-sombra',
]

const veces = (texto: string, nombre: string) => texto.match(new RegExp(`^\\s*--${nombre}:`, 'gm'))?.length ?? 0

describe('tokens del diseño final 3', () => {
  it.each(NUEVOS)('--%s está definido una vez en el tema oscuro y una en el claro', (nombre) => {
    expect(veces(oscuro, nombre)).toBe(1)
    expect(veces(claro, nombre)).toBe(1)
  })

  it('los valores de la maqueta 7 (claro y oscuro) se conservan', () => {
    expect(claro).toMatch(/--salon-3d-piel:\s*#c3c7cd/i)
    expect(oscuro).toMatch(/--salon-3d-piel:\s*#a9afb8/i)
    expect(claro).toMatch(/--pt-canto-1:\s*#dcdcdf/i)
    expect(oscuro).toMatch(/--pt-canto-4:\s*#131316/i)
  })

  it('los cinco muelles ya existían: no se duplican', () => {
    for (const m of ['protagonista', 'informativo', 'transicional', 'ambiental', 'microinteraccion']) {
      // Cada muelle tiene UNA definición con `linear()` (generada por scripts/generar-muelles.mjs): la maqueta no añade otra.
      expect(css.match(new RegExp(`^\\s*--muelle-${m}:\\s*linear\\(`, 'gm'))?.length, m).toBe(1)
    }
  })
})
