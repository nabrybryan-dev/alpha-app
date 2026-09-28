/**
 * El espacio «Equipo» de Manuela (maqueta «Espacios de Alpha», 28-sep).
 *
 * Se sustituyen la sesión, las capacidades y las dos lecturas de las bandejas en su capa
 * más baja: la cartera sale del seed ficticio (Valentina, Mateo, Sara) con el mismo
 * `resumenAsesorado` que usa la consola, y «Por aprobar» cuenta lo que las bandejas leen.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import type { Rol } from '../../domain/types'
import { resumenAsesorado } from '../coach/resumenAsesorado'

const estado = {
  rol: 'nutricionista' as Rol,
  capacidades: new Set<string>(),
  primeros: [] as { estado: string }[],
  renovados: [] as { estado: string }[],
}

vi.mock('../../app/SessionProvider', () => {
  const sesion = () => ({
    usuario: { id: 'u-manuela', nombre: 'Manuela Prueba', rol: estado.rol, avatarIniciales: 'MP' },
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  })
  return { useSesion: sesion, useSesionOpcional: sesion }
})

// Las capacidades se sustituyen en su capa más baja (la consulta a `capacidades_staff`), y se
// leen EN CADA llamada: así se ve si la pantalla vuelve a preguntar cuando el permiso cambia
// a mitad de sesión (E-11), en vez de quedarse con la primera respuesta.
vi.mock('../../data/consola/capacidadesStaff', async (original) => {
  const real = await original<typeof import('../../data/consola/capacidadesStaff')>()
  return { ...real, capacidadesDe: () => Promise.resolve([...estado.capacidades]) }
})

vi.mock('../../data/consola/primerosPlanes', () => ({
  primerosPlanesPendientes: () => Promise.resolve(estado.primeros),
}))

vi.mock('../../data/consola/planesRenovados', () => ({
  planesRenovadosPendientes: () => Promise.resolve(estado.renovados),
}))

const { default: EquipoPage } = await import('./EquipoPage')
const { REVALIDAR_CAPACIDADES_MS } = await import('./useCapacidadesVigentes')

function pintar() {
  return render(
    <MemoryRouter initialEntries={['/equipo']}>
      <Routes>
        <Route path="/equipo" element={<EquipoPage />} />
        <Route path="/" element={<p>Portada</p>} />
        <Route path="/coach/consola" element={<p>La consola</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  reiniciarDb()
  estado.rol = 'nutricionista'
  estado.capacidades = new Set()
  estado.primeros = []
  estado.renovados = []
})

describe('EquipoPage', () => {
  it('la cartera va con su semáforo: los que piden atención primero, con su motivo', async () => {
    estado.capacidades = new Set(['leer_entrenamiento'])
    pintar()
    await screen.findByRole('link', { name: 'Abrir la consola completa' })
    const cartera = screen.getByRole('region', { name: 'Cartera' })
    const resumenes = db.usuarios.entrenan().map((u) => resumenAsesorado(db, u))
    const atencion = resumenes.filter((r) => r.semaforo.color !== 'verde')
    const alDia = resumenes.filter((r) => r.semaforo.color === 'verde')
    for (const r of atencion) {
      expect(within(cartera).getByText(r.usuario.nombre)).toBeInTheDocument()
      expect(within(cartera).getAllByText(r.semaforo.motivo).length).toBeGreaterThan(0)
    }
    if (alDia.length > 0) {
      // Los que van al día, plegados detrás de un botón real.
      const plegados = within(cartera).getByRole('button', { name: new RegExp(`${alDia.length} al día`) })
      expect(plegados).toHaveAttribute('aria-expanded', 'false')
      fireEvent.click(plegados)
      for (const r of alDia) expect(within(cartera).getByText(r.usuario.nombre)).toBeInTheDocument()
    }
    expect(screen.getByText(new RegExp(`${resumenes.length} personas · ${atencion.length} pide`))).toBeInTheDocument()
  })

  it('sin capacidades no pinta «Por aprobar» ni la consola, y la cartera no enlaza a ella', async () => {
    pintar()
    await screen.findByText(/permiso de leer el entrenamiento/)
    expect(screen.queryByText('Por aprobar')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Abrir la consola completa' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Cartera' })).queryAllByRole('link')).toHaveLength(0)
  })

  it('sin leer_entrenamiento la cartera no muestra nombres ni semáforos, solo por qué (E-11)', async () => {
    estado.capacidades = new Set(['aprobar_primer_plan'])
    pintar()
    await screen.findByText(/permiso de leer el entrenamiento/)
    const cartera = screen.getByRole('region', { name: 'Cartera' })
    for (const u of db.usuarios.entrenan()) {
      expect(within(cartera).queryByText(u.nombre)).not.toBeInTheDocument()
    }
    expect(within(cartera).getByText(/permiso de leer el entrenamiento/)).toBeInTheDocument()
    expect(screen.queryByText(/pide atención|piden atención/)).not.toBeInTheDocument()
  })

  it('«Por aprobar» suma primeros planes y renovados que esperan decisión, en rojo', async () => {
    estado.capacidades = new Set(['aprobar_primer_plan', 'aprobar_plan_estrategico'])
    estado.primeros = [{ estado: 'propuesto' }, { estado: 'espera_bryan' }]
    estado.renovados = [{ estado: 'propuesto' }]
    pintar()
    expect(await screen.findByText('3 por aprobar')).toBeInTheDocument()
    expect(screen.getByText('2 primeros planes · 1 renovado')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Por aprobar/ })).toHaveAttribute('href', '/equipo-nutricion')
  })

  it('con una sola capacidad cuenta solo esa bandeja, sin fingir un cero en la otra', async () => {
    estado.capacidades = new Set(['aprobar_primer_plan'])
    estado.primeros = [{ estado: 'propuesto' }]
    estado.renovados = [{ estado: 'propuesto' }, { estado: 'propuesto' }]
    pintar()
    expect(await screen.findByText('1 por aprobar')).toBeInTheDocument()
    expect(screen.getByText('1 primer plan')).toBeInTheDocument()
    expect(screen.queryByText(/renovado/)).not.toBeInTheDocument()
  })

  it('con leer_entrenamiento, cada fila abre la consola ya puesta en esa persona', async () => {
    estado.capacidades = new Set(['leer_entrenamiento'])
    pintar()
    expect(await screen.findByRole('link', { name: 'Abrir la consola completa' })).toHaveAttribute('href', '/coach/consola')
    const cartera = screen.getByRole('region', { name: 'Cartera' })
    const boton = within(cartera).queryByRole('button')
    if (boton) fireEvent.click(boton)
    const fila = within(cartera).getAllByRole('link')[0]
    fireEvent.click(fila)
    expect(screen.getByText('La consola')).toBeInTheDocument()
    const guardado = JSON.parse(sessionStorage.getItem('consola-coach:seleccion') ?? '{}') as { persona?: string }
    expect(db.usuarios.entrenan().map((u) => u.id)).toContain(guardado.persona)
  })

  it('lleva a los mensajes y ya no trae la tarjeta de nutrición del equipo', async () => {
    pintar()
    // Espera a que lleguen las capacidades: sin esto, su respuesta pinta fuera de act().
    await screen.findByText(/permiso de leer el entrenamiento/)
    expect(screen.getByRole('link', { name: /Mensajes/ })).toHaveAttribute('href', '/chat')
    expect(screen.queryByText('Nutrición del equipo')).not.toBeInTheDocument()
  })

  it('un asesorado no entra', () => {
    estado.rol = 'asesorado'
    pintar()
    expect(screen.getByText('Portada')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Cartera' })).not.toBeInTheDocument()
  })

  /** Alguien de la cartera que no es Manuela: su nombre es lo que no debe quedar a la vista. */
  const alguien = () => db.usuarios.entrenan().find((u) => u.id !== 'u-manuela')!

  async function carteraVisible() {
    pintar()
    const cartera = await screen.findByRole('region', { name: 'Cartera' })
    await screen.findByRole('link', { name: 'Abrir la consola completa' })
    const boton = within(cartera).queryByRole('button', { name: /al día/ })
    if (boton) fireEvent.click(boton)
    expect(within(cartera).getByText(alguien().nombre)).toBeInTheDocument()
    return cartera
  }

  it('si le quitan leer_entrenamiento a mitad de sesión, al volver a la pestaña la cartera se retira (E-11)', async () => {
    estado.capacidades = new Set(['leer_entrenamiento'])
    const cartera = await carteraVisible()
    estado.capacidades = new Set()
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(within(cartera).queryByText(alguien().nombre)).not.toBeInTheDocument())
    expect(within(cartera).getByText(/permiso de leer el entrenamiento/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Abrir la consola completa' })).not.toBeInTheDocument()
  })

  it('también al volver a hacerse visible la página (visibilitychange)', async () => {
    estado.capacidades = new Set(['leer_entrenamiento'])
    const cartera = await carteraVisible()
    estado.capacidades = new Set()
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(within(cartera).queryByText(alguien().nombre)).not.toBeInTheDocument())
  })

  it('y sola, cada pocos minutos, aunque la pestaña nunca pierda el foco', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      estado.capacidades = new Set(['leer_entrenamiento'])
      const cartera = await carteraVisible()
      estado.capacidades = new Set()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(REVALIDAR_CAPACIDADES_MS + 10)
      })
      await waitFor(() => expect(within(cartera).queryByText(alguien().nombre)).not.toBeInTheDocument())
    } finally {
      vi.useRealTimers()
    }
  })

  it('«Por aprobar» también se retira si le quitan la capacidad a mitad de sesión (E-11)', async () => {
    estado.capacidades = new Set(['aprobar_primer_plan'])
    estado.primeros = [{ estado: 'propuesto' }]
    pintar()
    expect(await screen.findByText('1 por aprobar')).toBeInTheDocument()
    estado.capacidades = new Set()
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(screen.queryByText('Por aprobar')).not.toBeInTheDocument())
  })
})
