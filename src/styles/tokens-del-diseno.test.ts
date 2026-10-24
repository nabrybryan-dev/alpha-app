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

  // Los 15 valores de la maqueta 7 (líneas 50-51 y 82-83 de maqueta-v7.html), uno por uno, en cada tema.
  const CLARO: Record<string, string> = {
    'salon-3d-piel': '#c3c7cd', 'salon-3d-base': '#a3a8b0', 'salon-3d-apagada': '#b6bac1', 'salon-3d-luz': '#262b33',
    'salon-3d-hueso': '#f1eee6', 'salon-3d-cielo': '#ffffff', 'salon-3d-tierra': '#8d8a83', 'salon-3d-sombra': '0.2',
    'salon-3d-brillo': '0', 'pt-luz': 'rgba(255, 255, 255, 0.95)', 'pt-canto-1': '#dcdcdf', 'pt-canto-2': '#d1d1d5',
    'pt-canto-3': '#c6c6cb', 'pt-canto-4': '#bbbbc1', 'pt-sombra': 'rgba(0, 0, 0, 0.14)',
  }
  const OSCURO: Record<string, string> = {
    'salon-3d-piel': '#a9afb8', 'salon-3d-base': '#2b3038', 'salon-3d-apagada': '#3b414b', 'salon-3d-luz': '#e9eef4',
    'salon-3d-hueso': '#d9d4c8', 'salon-3d-cielo': '#cfd8e3', 'salon-3d-tierra': '#0b0e12', 'salon-3d-sombra': '0.45',
    'salon-3d-brillo': '0.22', 'pt-luz': 'rgba(255, 255, 255, 0.14)', 'pt-canto-1': '#28282d', 'pt-canto-2': '#212126',
    'pt-canto-3': '#1a1a1e', 'pt-canto-4': '#131316', 'pt-sombra': 'rgba(0, 0, 0, 0.7)',
  }
  const valorDe = (texto: string, nombre: string) => new RegExp(`^\\s*--${nombre}:\\s*([^;]+);`, 'm').exec(texto)?.[1].trim()

  it.each(NUEVOS)('--%s tiene el valor de la maqueta en los dos temas', (nombre) => {
    expect(valorDe(claro, nombre), `claro ${nombre}`).toBe(CLARO[nombre])
    expect(valorDe(oscuro, nombre), `oscuro ${nombre}`).toBe(OSCURO[nombre])
  })

  it('el mapa de valores de esta prueba cubre exactamente los tokens nuevos', () => {
    expect(Object.keys(CLARO).sort()).toEqual([...NUEVOS].sort())
    expect(Object.keys(OSCURO).sort()).toEqual([...NUEVOS].sort())
  })

  it('van juntos, ANTES del comentario del troquel (no partidos entre su comentario y su variable)', () => {
    for (const bloqueDelTema of [oscuro, claro]) {
      const comentario = '/* El corte de las dos esquinas opuestas del troquel. */'
      const troquel = bloqueDelTema.indexOf(bloqueDelTema.includes(comentario) ? comentario : '--troquel:')
      expect(troquel).toBeGreaterThan(0)
      for (const n of NUEVOS) expect(bloqueDelTema.indexOf(`--${n}:`), n).toBeLessThan(troquel)
    }
  })

  it('los cinco muelles ya existían: no se duplican', () => {
    for (const m of ['protagonista', 'informativo', 'transicional', 'ambiental', 'microinteraccion']) {
      // Cada muelle tiene UNA definición con `linear()` (generada por scripts/generar-muelles.mjs): la maqueta no añade otra.
      expect(css.match(new RegExp(`^\\s*--muelle-${m}:\\s*linear\\(`, 'gm'))?.length, m).toBe(1)
    }
  })
})
