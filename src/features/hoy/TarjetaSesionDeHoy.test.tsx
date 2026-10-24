import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { db } from '../../data/dbInstance'
import type { Sesion } from '../../domain/types'
import { TarjetaSesionDeHoy } from './TarjetaSesionDeHoy'

function sesionBase(): Sesion {
  const m = db.microciclos.byUsuario('u-valentina').find((x) => x.estado === 'activo')
  if (!m) throw new Error('el seed no trae microciclo activo')
  return { ...m.sesiones[0], ejercicios: m.sesiones[0].ejercicios.map((e) => ({ ...e, series: [] })) }
}

const pintar = (sesion: Sesion, hecha: boolean) =>
  render(
    <MemoryRouter>
      <TarjetaSesionDeHoy sesion={sesion} etiqueta="Sesión de hoy · M1" totalSeries={10} hecha={hecha} prioridad={[]} />
    </MemoryRouter>,
  )

describe('TarjetaSesionDeHoy — los tres estados', () => {
  it('hecha: «Sesión registrada» y ya no ofrece empezar ni continuar', () => {
    pintar(sesionBase(), true)
    expect(screen.getByText('Sesión registrada')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Empezar sesión|Continuar sesión/ })).not.toBeInTheDocument()
  })

  it('una sola serie anotada ya es «en curso»: continúa y dice 0 ejercicios hechos', () => {
    const s = sesionBase()
    s.ejercicios[0] = { ...s.ejercicios[0], sets: 3, series: [{ orden: 1, cargaKg: 20, reps: 8, rir: 2 }] }
    pintar(s, false)
    expect(screen.getByRole('link', { name: /Continuar sesión/ })).toHaveAttribute('href', `/entrenar/sesion/${s.id}`)
    expect(screen.getByText(`0 de ${s.ejercicios.length} ejercicios hechos`)).toBeInTheDocument()
  })

  it('sin nada anotado: empezar, sin barra', () => {
    pintar(sesionBase(), false)
    expect(screen.getByRole('link', { name: /Empezar sesión/ })).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
