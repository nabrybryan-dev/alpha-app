import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { aclaradoDelTema } from './piezasDelTema'
import { FS } from '../visor/sombreado'

/**
 * LA SALA DE BLENDER TAMBIÉN SIGUE EL TEMA (zona 8, ronda 2).
 *
 * Las piezas llegan con la luz de un gimnasio oscuro horneada y texturas de hormigón y
 * hierro. Teñir los colores de los vértices no sirve (la textura oscura multiplica y la
 * pared sigue negra: medido en captura, ~55/255). Por eso el motor tiene un uniforme
 * `u_aclarado` que levanta las piezas horneadas hacia la luz; 0 en oscuro (igual que
 * antes) y más de 0 en claro.
 */
describe('aclaradoDelTema', () => {
  it('es 0 en oscuro y positivo en claro', () => {
    expect(aclaradoDelTema('dark')).toBe(0)
    expect(aclaradoDelTema('light')).toBeGreaterThan(0.5)
    expect(aclaradoDelTema('light')).toBeLessThanOrEqual(1)
  })

  it('el shader aplica el uniforme solo a lo horneado, y el motor lo sube', () => {
    expect(FS).toMatch(/uniform float u_aclarado;/)
    expect(FS).toMatch(/horneado = 1\.0 - \(1\.0 - horneado\)/)
    const motor = readFileSync(join(__dirname, '../visor/motor.ts'), 'utf8')
    expect(motor).toMatch(/u\('u_aclarado'\)/)
    expect(motor).toMatch(/fijarAclarado\(/)
  })
})
