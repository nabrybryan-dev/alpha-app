import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { salaDelVisor } from './salaEnCache'

/**
 * LA SALA EN CACHÉ DEL VISOR SE REHACE AL CAMBIAR DE TEMA (zona 8).
 *
 * La caché es del módulo: si la clave no lleva el tema, al alternar `data-theme` sin
 * recargar se serviría la pared del tema anterior. Se inyectan dos paredes distintas.
 */
let estilo: HTMLStyleElement
beforeEach(() => {
  estilo = document.createElement('style')
  estilo.textContent =
    ':root, [data-theme="dark"] { --salon-3d-pared: #101114; }\n[data-theme="light"] { --salon-3d-pared: #f1eee6; }'
  document.head.appendChild(estilo)
})
afterEach(() => {
  estilo.remove()
  document.documentElement.removeAttribute('data-theme')
})

describe('salaDelVisor', () => {
  it('rehace la sala cuando cambia el tema y la reutiliza cuando no', () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    const oscura = salaDelVisor(undefined, 72, false)
    expect(salaDelVisor(undefined, 72, false)).toBe(oscura)
    document.documentElement.setAttribute('data-theme', 'light')
    const clara = salaDelVisor(undefined, 72, false)
    expect(clara).not.toBe(oscura)
    expect(clara.color[2 * 3]).toBeGreaterThan(0.9)
    expect(oscura.color[2 * 3]).toBeLessThan(0.1)
  })
})
