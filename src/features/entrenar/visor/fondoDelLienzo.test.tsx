import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PATRON_POR_ID } from '../../../domain/patrones/catalogo'
import { VisorPatron } from './VisorPatron'

/** El fondo del lienzo del visor sigue el tema y cambia al alternarlo, sin recargar. */
let estilo: HTMLStyleElement
beforeEach(() => {
  estilo = document.createElement('style')
  estilo.textContent =
    ':root, [data-theme="dark"] { --salon-3d-lienzo: #0b0e12; }\n[data-theme="light"] { --salon-3d-lienzo: #e4e1d9; }'
  document.head.appendChild(estilo)
})
afterEach(() => {
  estilo.remove()
  document.documentElement.removeAttribute('data-theme')
})

describe('fondo del lienzo del visor', () => {
  it('cambia de color cuando cambia data-theme', async () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    const { container } = render(<VisorPatron patron={PATRON_POR_ID.sentadilla} />)
    const fondo = () => (container.querySelector('canvas')!.parentElement as HTMLElement).style.background
    expect(fondo()).toBe('rgb(11, 14, 18)')
    await act(async () => {
      document.documentElement.setAttribute('data-theme', 'light')
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(fondo()).toBe('rgb(228, 225, 217)')
  })
})
