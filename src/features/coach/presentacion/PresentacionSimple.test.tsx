import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PresentarAlAsesorado } from './PresentacionAsesorado'
import type { DatosPersona } from '../consola/usePersona'

const datos = {
  usuario: { id: 'u1', nombre: 'Ana' }, activo: undefined, checkins: [], adherencias: [], perfil: undefined, hoy: '2026-11-02',
  plan: { estado: 'cargando' }, corridas: { estado: 'listo', valor: [] },
} as unknown as DatosPersona

describe('presentar en versión simple o técnica', () => {
  afterEach(cleanup)

  it('ofrece los dos botones y la técnica muestra las siete secciones de siempre', () => {
    render(<PresentarAlAsesorado datos={datos} historial={[]} />)
    expect(screen.getByRole('button', { name: 'Presentar (simple)' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Presentar a Ana' }))
    for (const t of ['Tu plan', 'Conclusiones', 'El mapa de tu plan', 'Lo que te pedimos y lo que hiciste', 'Velocidad y técnica']) {
      expect(screen.getByRole('heading', { name: t })).toBeInTheDocument()
    }
  })

  it('la simple deja Tu plan, Esta semana y Conclusiones, y oculta las técnicas', () => {
    render(<PresentarAlAsesorado datos={datos} historial={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Presentar (simple)' }))
    for (const t of ['Tu plan', 'Conclusiones']) expect(screen.getByRole('heading', { name: t })).toBeInTheDocument()
    for (const t of ['El mapa de tu plan', 'Lo que te pedimos y lo que hiciste', 'Velocidad y técnica', 'Tu semana pasada, esta y la que viene']) {
      expect(screen.queryByRole('heading', { name: t })).toBeNull()
    }
  })
})
