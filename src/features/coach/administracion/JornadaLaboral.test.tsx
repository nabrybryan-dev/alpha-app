import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isoLocal, sumarDias, type ItemPlan } from '../../../domain/planOrganizador'

const HOY = isoLocal(new Date())
const est = { rol: 'nutricionista', items: [] as ItemPlan[], fallo: null as string | null }
const terminar = vi.fn(async (_id: string) => ({ ok: true as const, id: 'x' }))
const reabrir = vi.fn(async (_id: string) => ({ ok: true as const, id: 'x' }))

vi.mock('../../../data/consola/planItems', () => ({
  planItems: () => Promise.resolve(est.fallo ? { ok: false, error: est.fallo } : { ok: true, datos: est.items }),
  terminarTarea: (id: string) => terminar(id),
  reabrirTarea: (id: string) => reabrir(id),
}))
vi.mock('../../../app/SessionProvider', () => ({
  useSesionOpcional: () => ({ usuario: { id: 'u', nombre: 'X', rol: est.rol, avatarIniciales: 'X' } }),
}))

const { JornadaLaboral } = await import('./JornadaLaboral')

let n = 0
const mk = (o: Partial<ItemPlan>): ItemPlan => {
  n += 1
  return {
    id: `i${n}`, nivel: 'tarea', padreId: null, titulo: `Item ${n}`, primerPaso: null, dueno: 'manuela', palanca: null,
    fecha: null, estimadoMin: null, prioridad: 'pequena', estado: 'pendiente', iniciadaEn: null, hechaEn: null,
    vecesMovida: 0, origen: null, actualizadoEn: '2026-09-30T00:00:00Z', ...o,
  }
}
const montar = () => render(<MemoryRouter><JornadaLaboral /></MemoryRouter>)

beforeEach(() => {
  est.rol = 'nutricionista'
  est.fallo = null
  est.items = [
    mk({ id: 'o1', nivel: 'objetivo', titulo: 'Objetivo de 90 días', fecha: null }),
    mk({ id: 'h1', nivel: 'hito', padreId: 'o1', titulo: 'Hito de la semana', fecha: HOY }),
    mk({ id: 't1', padreId: 'h1', titulo: 'Tarea de hoy', fecha: HOY }),
    mk({ id: 't2', padreId: null, titulo: 'Tarea suelta de hoy', fecha: HOY }),
    mk({ id: 'tb', titulo: 'Tarea de Bryan', dueno: 'bryan', fecha: HOY }),
  ]
  terminar.mockClear()
  reabrir.mockClear()
})

describe('JornadaLaboral', () => {
  it('Manuela ve sus tareas de hoy con botón de tachar y el objetivo al que aportan; no ve las de Bryan', async () => {
    montar()
    expect(await screen.findByText('Tarea de hoy')).toBeInTheDocument()
    expect(screen.queryByText('Tarea de Bryan')).toBeNull()
    const fila = screen.getByRole('listitem', { name: 'Tarea de hoy' })
    expect(within(fila).getByText(/Hito de la semana/)).toBeInTheDocument()
    expect(within(fila).getByText(/Objetivo de 90 días/)).toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: 'Tachar: Tarea de hoy' })).toBeInTheDocument()
  })

  it('tachar llama a terminarTarea con el id y vuelve a leer; deshacer llama a reabrirTarea', async () => {
    const u = userEvent.setup()
    montar()
    const boton = await screen.findByRole('button', { name: 'Tachar: Tarea de hoy' })
    // La base guarda «hecha»; la relectura que sigue al tachar ya la trae así.
    est.items = est.items.map((i) => (i.id === 't1' ? { ...i, estado: 'hecha' as const } : i))
    await u.click(boton)
    expect(terminar).toHaveBeenCalledWith('t1')
    await u.click(await screen.findByRole('button', { name: 'Deshacer: Tarea de hoy' }))
    expect(reabrir).toHaveBeenCalledWith('t1')
  })

  it('lo que el plan no trae se dice FALTA: entregable, fecha del objetivo y tarea sin hito', async () => {
    montar()
    const a = await screen.findByRole('listitem', { name: 'Tarea de hoy' })
    expect(within(a).getByText(/Entregable: FALTA/)).toBeInTheDocument()
    expect(within(a).getByText(/Mediano plazo: FALTA la fecha del objetivo/)).toBeInTheDocument()
    const b = screen.getByRole('listitem', { name: 'Tarea suelta de hoy' })
    expect(within(b).getByText(/Objetivo: FALTA/)).toBeInTheDocument()
  })

  it('un fallo de lectura se ve como error con Reintentar, no como «sin tareas»', async () => {
    est.fallo = 'RLS'
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('RLS')
    expect(screen.queryByText(/No hay tareas/)).toBeNull()
  })

  it('OR-03: Bryan ve la jornada de Manuela en solo lectura, sin ningún botón de tachar sobre ella', async () => {
    est.rol = 'coach'
    montar()
    await screen.findByText('Tarea de Bryan')
    const ajena = screen.getByRole('region', { name: 'Jornada de Manuela · solo lectura' })
    expect(within(ajena).getByText('Tarea de hoy')).toBeInTheDocument()
    expect(within(ajena).queryByRole('button')).toBeNull()
    expect(screen.getByRole('button', { name: 'Tachar: Tarea de Bryan' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tachar: Tarea de hoy' })).toBeNull()
  })

  it('sin tareas de hoy lo dice y no inventa', async () => {
    est.items = [mk({ titulo: 'Otra semana', fecha: sumarDias(HOY, 30) })]
    montar()
    await waitFor(() => expect(screen.getByText(/No hay tareas para hoy/)).toBeInTheDocument())
  })
})
