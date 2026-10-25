import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Boton3D } from './Boton3D'

const css = readFileSync(join(__dirname, '../../styles/tokens.css'), 'utf8').replace(/\r\n/g, '\n')

describe('Boton3D', () => {
  it('con «to» es un enlace de la app con la clase del botón con cuerpo', () => {
    render(
      <MemoryRouter>
        <Boton3D to="/entrenar/sesion/s1" bloque>
          Empezar sesión
        </Boton3D>
      </MemoryRouter>,
    )
    const enlace = screen.getByRole('link', { name: 'Empezar sesión' })
    expect(enlace).toHaveAttribute('href', '/entrenar/sesion/s1')
    expect(enlace).toHaveClass('btn-3d', 'btn-3d-bloque')
  })

  it('sin «to» es un botón que no envía formularios por defecto y responde al toque', () => {
    const alTocar = vi.fn()
    render(
      <Boton3D onClick={alTocar} redondo aria-label="Siguiente">
        →
      </Boton3D>,
    )
    const boton = screen.getByRole('button', { name: 'Siguiente' })
    expect(boton).toHaveAttribute('type', 'button')
    expect(boton).toHaveClass('btn-3d', 'btn-3d-redondo')
    fireEvent.click(boton)
    expect(alTocar).toHaveBeenCalledTimes(1)
  })

  it('deshabilitado no se pulsa', () => {
    const alTocar = vi.fn()
    render(
      <Boton3D disabled onClick={alTocar}>
        Guardar
      </Boton3D>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(alTocar).not.toHaveBeenCalled()
  })
})

describe('Boton3D — su CSS en tokens.css', () => {
  /** El texto de la regla `selector { ... }` (la primera que empieza por ese selector). */
  function regla(selector: string, desde = 0): string {
    const i = css.indexOf(`\n${selector} {`, desde)
    expect(i, `no hay regla «${selector}»`).toBeGreaterThanOrEqual(0)
    return css.slice(i, css.indexOf('\n}', i))
  }

  it('usa solo tokens para sus colores y cantos (ningún hexadecimal suelto en la regla)', () => {
    const r = regla('.btn-3d')
    expect(r).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
    for (const t of ['--btn-a', '--btn-c', '--btn-luz', '--btn-sombra', '--canto-1', '--canto-5', '--on-rojo', '--perspectiva']) {
      expect(r, t).toContain(t)
    }
  })

  it('los tokens del botón están definidos, con el valor de la maqueta', () => {
    for (const [t, v] of [
      ['--btn-a', '#ff4a4a'],
      ['--btn-c', '#c40f0f'],
      ['--canto-1', '#a50f0f'],
      ['--canto-5', '#420505'],
      ['--on-rojo', '#ffffff'],
    ]) {
      expect(css, t).toMatch(new RegExp(`${t}:\\s*${v}`))
    }
  })

  it('se hunde al pulsar: aplana la inclinación y baja 4 px', () => {
    const r = regla('.btn-3d:active')
    expect(r).toContain('rotateX(0deg) translateY(4px)')
  })

  it('con movimiento reducido queda plano y sin transición, también al pulsar', () => {
    const inicio = css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .btn-3d,')
    expect(inicio, 'falta el bloque de movimiento reducido del botón').toBeGreaterThanOrEqual(0)
    const bloque = css.slice(inicio, css.indexOf('\n}\n', inicio))
    expect(bloque).toContain('.btn-3d:active')
    expect(bloque).toMatch(/transform:\s*none/)
    expect(bloque).toMatch(/transition:\s*none/)
  })
})
