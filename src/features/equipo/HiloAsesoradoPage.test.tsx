/**
 * Puerta de Manuela al hilo de un asesorado (decisión de Bryan, 30-sep). Datos ficticios del seed;
 * el contenido de los mensajes no se lee ni se pinta en estas pruebas (puede traer salud).
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, idCoach } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import type { Rol } from '../../domain/types'

const estado = { rol: 'nutricionista' as Rol, capacidades: new Set<string>(['responder_por_asesorado']) }

vi.mock('../../app/SessionProvider', () => {
  const sesion = () => ({
    usuario: { id: 'u-manuela', nombre: 'Staff Prueba', rol: estado.rol, avatarIniciales: 'SP' },
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  })
  return { useSesion: sesion, useSesionOpcional: sesion }
})
vi.mock('../../data/consola/capacidadesStaff', async (original) => {
  const real = await original<typeof import('../../data/consola/capacidadesStaff')>()
  return { ...real, capacidadesDe: () => Promise.resolve([...estado.capacidades]) }
})
vi.mock('../chat/Conversacion', () => ({
  Conversacion: ({ yoId, otroId }: { yoId: string; otroId: string }) => (
    <p data-testid="hilo" data-yo={yoId} data-otro={otroId}>
      hilo
    </p>
  ),
}))

const { default: HiloAsesoradoPage } = await import('./HiloAsesoradoPage')

function ir(otroId: string) {
  return render(
    <MemoryRouter initialEntries={[`/equipo/mensajes/${otroId}`]}>
      <Routes>
        <Route path="/equipo/mensajes/:asesoradoId" element={<HiloAsesoradoPage />} />
        <Route path="/equipo" element={<p>Equipo</p>} />
        <Route path="/" element={<p>Portada</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  reiniciarDb()
  estado.rol = 'nutricionista'
  estado.capacidades = new Set(['responder_por_asesorado'])
})

describe('HiloAsesoradoPage', () => {
  it('ACCESO PERMITIDO: con responder_por_asesorado abre su propio hilo con el asesorado (ella y él, no el del coach)', async () => {
    const a = db.usuarios.asesorados()[0]
    ir(a.id)
    const hilo = await screen.findByTestId('hilo')
    expect(hilo).toHaveAttribute('data-yo', 'u-manuela')
    expect(hilo).toHaveAttribute('data-otro', a.id)
  })

  it('ACCESO DENEGADO: sin la capacidad vuelve a Equipo y no monta ningún hilo', async () => {
    estado.capacidades = new Set()
    ir(db.usuarios.asesorados()[0].id)
    expect(await screen.findByText('Equipo')).toBeInTheDocument()
    expect(screen.queryByTestId('hilo')).toBeNull()
  })

  it('ACCESO DENEGADO: no abre el hilo del coach ni un id inexistente', async () => {
    const c = ir(idCoach())
    expect(await screen.findByText('Equipo')).toBeInTheDocument()
    expect(screen.queryByTestId('hilo')).toBeNull()
    c.unmount()
    ir('no-existe')
    expect(await screen.findByText('Equipo')).toBeInTheDocument()
  })

  it('ACCESO DENEGADO: quien no es nutricionista no pasa, aunque tuviera la capacidad', async () => {
    estado.rol = 'asesorado'
    ir(db.usuarios.asesorados()[0].id)
    expect(await screen.findByText('Portada')).toBeInTheDocument()
    expect(screen.queryByTestId('hilo')).toBeNull()
  })
})
