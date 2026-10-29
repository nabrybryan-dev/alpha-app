import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EjercicioCompletado } from './EjercicioCompletado'

/**
 * El velo de «Ejercicio completado» es claro SOLO si se monta dentro de `[data-sesion]`
 * (render, no solo lectura del código fuente). jsdom no resuelve `var()` ni carga
 * `tokens.css`, así que se emula la única parte de la cascada que importa aquí: el canal
 * `--ink-900-rgb` que el velo lee EN su elemento. Se toma de `tokens.css` el ámbito claro
 * real (selectores y valor) y el valor base de `:root`, y se decide con `matches()` sobre el
 * DOM montado qué valor recibe el velo. Si el velo se monta fuera del contenedor, recibe el
 * valor base (negro) y la prueba falla.
 */
const css = readFileSync(join(__dirname, '../../styles/tokens.css'), 'utf8').replace(/\r\n/g, '\n')
const inicio = css.search(/\[data-theme="light"\] \[data-salon="entrenar"\],/)
const ambito = css.slice(inicio, css.indexOf('\n}', inicio))
const selectoresClaros = ambito.slice(0, ambito.indexOf('{')).split(',').map((s) => s.trim())
const canal = (bloque: string) => /--ink-900-rgb:\s*([\d ]+);/.exec(bloque)?.[1]?.trim()
const CLARO = canal(ambito)
const BASE = canal(css.slice(css.search(/:root,\s*\[data-theme="dark"\]\s*\{/)))

function canalDelVelo(velo: HTMLElement): string | undefined {
  const usado = /var\((--[a-z0-9-]+)\)/.exec(velo.getAttribute('style') ?? '')?.[1]
  expect(usado, 'el velo debe leer un canal -rgb').toBe('--ink-900-rgb')
  for (let n: HTMLElement | null = velo; n; n = n.parentElement) {
    if (document.documentElement.dataset.theme === 'light' && selectoresClaros.some((s) => n!.matches(s))) return CLARO
  }
  return BASE
}

const EX = { nombre: 'Sentadilla', series: 3 }

afterEach(() => {
  delete document.documentElement.dataset.theme
})

describe('el velo de «Ejercicio completado», montado', () => {
  it('los dos valores existen y son distintos (claro hueso, base oscuro)', () => {
    expect(CLARO).toBeTruthy()
    expect(BASE).toBe('8 9 10')
    expect(CLARO).not.toBe(BASE)
  })

  it('DENTRO de [data-sesion] en tema claro el velo es claro', () => {
    document.documentElement.dataset.theme = 'light'
    render(
      <div data-sesion="entrenar">
        <EjercicioCompletado ex={EX} onSeguir={vi.fn()} />
      </div>,
    )
    expect(canalDelVelo(screen.getByRole('dialog'))).toBe(CLARO)
  })

  it('FUERA de [data-sesion] el mismo velo NO se aclara', () => {
    document.documentElement.dataset.theme = 'light'
    render(<EjercicioCompletado ex={EX} onSeguir={vi.fn()} />)
    expect(canalDelVelo(screen.getByRole('dialog'))).toBe(BASE)
  })

  it('en tema oscuro, dentro o fuera, el velo es el de siempre', () => {
    document.documentElement.dataset.theme = 'dark'
    render(
      <div data-sesion="entrenar">
        <EjercicioCompletado ex={EX} onSeguir={vi.fn()} />
      </div>,
    )
    expect(canalDelVelo(screen.getByRole('dialog'))).toBe(BASE)
  })
})

describe('SesionPage monta el corte DENTRO de su contenedor [data-sesion]', () => {
  // Montar SesionPage entera exige registrar todas las series; aquí se comprueba la estructura:
  // el JSX del corte es el último hijo del div raíz que lleva data-sesion.
  const src = readFileSync(join(__dirname, 'SesionPage.tsx'), 'utf8').replace(/\r\n/g, '\n')
  it('<EjercicioCompletado> es hijo directo del cierre del div raíz de la sesión', () => {
    expect(src).toMatch(/return \(\s*(?:\/\/[^\n]*\n\s*)*<div data-sesion="entrenar"/)
    expect(src).toMatch(/\{exCompletado && <EjercicioCompletado [^\n]*\/>\}\n {4}<\/div>\n {2}\)\n\}\n?$/)
  })
})
