import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Rol } from '../domain/types'

/**
 * La consola se abre por CAPACIDAD, no por rol (decisión de Bryan, 26-sep). El resto del
 * panel del coach sigue siendo solo del coach. Se sustituyen la sesión y las capacidades
 * en su capa más baja para probar la guarda real de `CoachLayout`.
 */
const estado = {
  rol: 'nutricionista' as Rol,
  cargando: false,
  capacidades: new Set<string>(),
}

vi.mock('./SessionProvider', () => ({
  useSesion: () => ({
    usuario: { id: 'u-staff', nombre: 'Staff', rol: estado.rol, avatarIniciales: 'ST' },
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  }),
  useSesionOpcional: () => null,
}))

vi.mock('../features/coach/consola/useCapacidades', () => ({
  useCapacidades: () => ({
    cargando: estado.cargando,
    tiene: (c: string) => estado.capacidades.has(c),
    usuarioId: 'u-staff',
  }),
}))

vi.mock('../components/ui/TopBar', () => ({ TopBar: ({ titulo }: { titulo: string }) => <h1>{titulo}</h1> }))

const { CoachLayout } = await import('./layouts')

function en(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/" element={<p>Portada</p>} />
        <Route path="/coach" element={<CoachLayout />}>
          <Route index element={<p>Cartera del coach</p>} />
          <Route path="consola" element={<p>Contenido de la consola</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('CoachLayout · acceso por capacidad', () => {
  afterEach(() => {
    estado.rol = 'nutricionista'
    estado.cargando = false
    estado.capacidades = new Set()
  })

  it('staff con leer_entrenamiento entra a la consola', () => {
    estado.capacidades = new Set(['leer_entrenamiento'])
    en('/coach/consola')
    expect(screen.getByText('Contenido de la consola')).toBeInTheDocument()
    // Sin los enlaces del panel del coach: solo la vuelta a su app.
    expect(screen.queryByText('Revisar audios y vídeos')).not.toBeInTheDocument()
    expect(screen.getByText('Volver a mi app')).toBeInTheDocument()
  })

  it('…pero el resto del panel del coach sigue siendo solo del coach', () => {
    estado.capacidades = new Set(['leer_entrenamiento'])
    en('/coach')
    expect(screen.getByText('Portada')).toBeInTheDocument()
    expect(screen.queryByText('Cartera del coach')).not.toBeInTheDocument()
  })

  it('staff SIN la capacidad va a la portada, como antes', () => {
    estado.capacidades = new Set(['responder_por_asesorado'])
    en('/coach/consola')
    expect(screen.getByText('Portada')).toBeInTheDocument()
  })

  it('mientras las capacidades cargan no abre ni echa: espera', () => {
    estado.cargando = true
    en('/coach/consola')
    expect(screen.getByText('Comprobando tu acceso a la consola…')).toBeInTheDocument()
    expect(screen.queryByText('Contenido de la consola')).not.toBeInTheDocument()
    expect(screen.queryByText('Portada')).not.toBeInTheDocument()
  })

  it('el coach entra a todo, tenga o no filas de capacidades', () => {
    estado.rol = 'coach'
    en('/coach')
    expect(screen.getByText('Cartera del coach')).toBeInTheDocument()
    expect(screen.getByText('Revisar audios y vídeos')).toBeInTheDocument()
  })

  it('un asesorado nunca entra a la consola', () => {
    estado.rol = 'asesorado'
    en('/coach/consola')
    expect(screen.getByText('Portada')).toBeInTheDocument()
  })
})
