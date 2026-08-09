/**
 * La puerta al plan de entrenamiento.
 *
 * Lo que estos tests protegen, y que es fácil de romper sin darse cuenta:
 * la puerta NO puede tapar bienestar (donde se cargan las medidas), NO puede
 * aplicarse al staff, y NO puede bloquear a quien todavía no ha sincronizado
 * su perfil. Un candado que deja fuera de la sesión a alguien porque la nube
 * tardó es peor que el problema que resuelve.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PuertaDeMedidas } from './PuertaDeMedidas'
import type { MedidaCorporal, Perfil, Usuario } from '../../domain/types'

const asesorada: Usuario = { id: 'u1', nombre: 'Ana', rol: 'asesorado', avatarIniciales: 'AN' }
const coach: Usuario = { id: 'c1', nombre: 'Bryan', rol: 'coach', avatarIniciales: 'BR' }

let usuarioActual: Usuario = asesorada
let perfilActual: Perfil | undefined

vi.mock('../../app/SessionProvider', () => ({
  useSesion: () => ({
    usuario: usuarioActual,
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  }),
}))

vi.mock('../../data/dbInstance', () => ({
  db: { perfiles: { byUsuario: () => perfilActual } },
  hoyIso: () => '2026-08-11',
  useDbVersion: () => 0,
}))

const medida = (over: Partial<MedidaCorporal> = {}): MedidaCorporal => ({
  fecha: '2026-08-05',
  pesoKg: 62,
  alturaCm: 165,
  perimetros: { Cintura: 74 },
  ...over,
})

const perfil = (over: Partial<Perfil> = {}): Perfil => ({
  usuarioId: 'u1',
  objetivos: '',
  edad: 28,
  diasEntrenamiento: 5,
  tiempoSesionMin: 90,
  somatotipo: '',
  volumenSemanal: {},
  medidas: [medida()],
  ...over,
})

function montar() {
  render(
    <MemoryRouter>
      <PuertaDeMedidas>
        <p>mi semana de entrenamiento</p>
      </PuertaDeMedidas>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  usuarioActual = asesorada
  perfilActual = perfil()
})
afterEach(cleanup)

describe('PuertaDeMedidas', () => {
  it('con medidas vigentes deja pasar', () => {
    montar()
    expect(screen.getByText('mi semana de entrenamiento')).toBeInTheDocument()
    expect(screen.queryByTestId('puerta-medidas')).not.toBeInTheDocument()
  })

  it('sin medidas bloquea y NO deja ver el plan', () => {
    perfilActual = perfil({ medidas: [] })
    montar()
    expect(screen.queryByText('mi semana de entrenamiento')).not.toBeInTheDocument()
    expect(screen.getByTestId('puerta-medidas')).toBeInTheDocument()
  })

  it('lista exactamente lo que falta', () => {
    perfilActual = perfil({ medidas: [medida({ perimetros: {} })] })
    montar()
    expect(screen.getByText('· Cintura')).toBeInTheDocument()
    expect(screen.queryByText('· Peso')).not.toBeInTheDocument()
  })

  it('siempre ofrece la salida a bienestar, que es donde se cargan', () => {
    perfilActual = perfil({ medidas: [] })
    montar()
    expect(screen.getByRole('link', { name: /cargar mis medidas/i })).toHaveAttribute(
      'href',
      '/bienestar',
    )
  })

  it('con medidas vencidas bloquea y dice cuántos días llevan', () => {
    perfilActual = perfil({ medidas: [medida({ fecha: '2026-01-01' })] })
    montar()
    expect(screen.getByTestId('puerta-medidas')).toBeInTheDocument()
    expect(screen.getByText(/tus medidas están vencidas/i)).toBeInTheDocument()
    expect(screen.getByText('222')).toBeInTheDocument()
  })

  it('al staff NO se le aplica: entra a ver a otros', () => {
    usuarioActual = coach
    perfilActual = perfil({ medidas: [] })
    montar()
    expect(screen.getByText('mi semana de entrenamiento')).toBeInTheDocument()
  })

  it('sin perfil sincronizado deja pasar: no se bloquea por no saber', () => {
    perfilActual = undefined
    montar()
    expect(screen.getByText('mi semana de entrenamiento')).toBeInTheDocument()
  })

  it('exige los perímetros extra que el coach marcó por objetivo', () => {
    perfilActual = perfil({ medidasRequeridas: ['Glúteo'] })
    montar()
    expect(screen.getByTestId('puerta-medidas')).toBeInTheDocument()
    expect(screen.getByText('· Glúteo')).toBeInTheDocument()
  })
})
