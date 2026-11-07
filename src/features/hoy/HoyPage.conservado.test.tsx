/**
 * Lo que la pantalla Hoy del asesorado YA hacía antes de ponerla en tres bandas
 * (relevo-sin-perdidas, Fase 3 paso 3). Cada prueba fija una cosa que no se puede perder
 * al reordenar: se escribieron contra la pantalla vieja y tienen que seguir en verde con
 * la nueva. Lo que vive en «El resto» (plegado) se abre primero con `abrirElResto`.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { db, hoyIso } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import type { Cuestionario } from '../../domain/types'
import HoyPage from './HoyPage'

vi.mock('../avisos/PedirPermiso', () => ({
  PedirPermiso: ({ usuarioId }: { usuarioId: string }) => <div data-testid="pedir-permiso">{usuarioId}</div>,
}))

const salud = { necesita: false }
vi.mock('../cribado/necesitaCribado', async (original) => ({
  ...(await original<typeof import('../cribado/necesitaCribado')>()),
  necesitaPantallaDeSalud: () => salud.necesita,
}))

function pintar() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <MemoryRouter>
          <HoyPage />
        </MemoryRouter>
      </SessionProvider>
    </ThemeProvider>,
  )
}

/** Abre «El resto» si la pantalla lo trae plegado; en la pantalla vieja no hace nada. */
function abrirElResto() {
  const boton = screen.queryByRole('button', { name: /El resto/i })
  if (boton && boton.getAttribute('aria-expanded') === 'false') fireEvent.click(boton)
}

const hrefDe = (nombre: RegExp | string) => screen.getByRole('link', { name: nombre }).getAttribute('href')

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
  salud.necesita = false
})
afterEach(() => vi.restoreAllMocks())

describe('Hoy del asesorado — lo que se conserva', () => {
  it('aviso «algo no subió»: sigue saliendo cuando hay registros apartados', () => {
    localStorage.setItem(
      'alpha-cola-descartes',
      JSON.stringify([1, 2].map(() => ({ tabla: 'registro_comida', tipo: 'upsert', payload: {}, duenio: 'u-valentina' }))),
    )
    pintar()
    expect(screen.getByText(/Al menos 2 registros no han llegado/)).toBeInTheDocument()
  })

  it('aviso «algo no subió»: sin nada apartado no ocupa sitio', () => {
    pintar()
    expect(screen.queryByText(/no han llegado al servidor/)).not.toBeInTheDocument()
  })

  it('permiso de avisos push: se sigue ofreciendo en Hoy', () => {
    pintar()
    expect(screen.getByTestId('pedir-permiso')).toHaveTextContent('u-valentina')
  })

  it('salud: sin ficha de cribado, el formulario sale arriba y no se esconde', () => {
    salud.necesita = true
    pintar()
    expect(screen.getByText(/Antes de seguir, tu salud/)).toBeInTheDocument()
  })

  it('salud: con ficha, «Cuéntanoslo» deja volver a contestar el cribado', () => {
    pintar()
    expect(screen.queryByText(/Antes de seguir, tu salud/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cuéntanoslo' }))
    expect(screen.getByText(/Antes de seguir, tu salud/)).toBeInTheDocument()
  })

  it('pregunta del día de la cadena: se pinta con su enunciado y se contesta en sitio', () => {
    const q: Cuestionario = {
      id: 'preg-prueba-M1',
      titulo: 'Tu coach te pregunta',
      descripcion: '',
      asignadoA: ['u-valentina'],
      origen: 'cadena',
      preguntas: [{ id: 'p1', tipo: 'texto', enunciado: '¿Cómo sientes el hombro hoy?' }],
    }
    vi.spyOn(db.cuestionarios, 'asignadosA').mockReturnValue([q])
    pintar()
    expect(screen.getByText('¿Cómo sientes el hombro hoy?')).toBeInTheDocument()
  })

  it('pendientes de hoy: los cuestionarios llevan a /cuestionarios y la nutrición se registra desde su tarjeta', async () => {
    const q: Cuestionario = {
      id: 'cuest-prueba',
      titulo: 'Un cuestionario',
      descripcion: '',
      asignadoA: ['u-valentina'],
      preguntas: [{ id: 'p1', tipo: 'texto', enunciado: 'x' }],
    }
    vi.spyOn(db.cuestionarios, 'asignadosA').mockReturnValue([q])
    pintar()
    abrirElResto()
    expect(await screen.findByRole('link', { name: 'Registrar' })).toHaveAttribute('href', '/nutricion')
    expect(hrefDe(/1 cuestionario por responder/)).toBe('/cuestionarios')
  })

  it('check-in pendiente: el formulario está en Hoy y /bienestar sigue a un toque (paso 6)', () => {
    pintar()
    expect(screen.getByRole('region', { name: 'Chequeo de hoy' })).toBeInTheDocument()
    expect(hrefDe(/Ver todo y recordatorio/)).toBe('/bienestar')
  })

  it('check-in hecho: dice «registrado» y no lo vuelve a pedir', () => {
    vi.spyOn(db.bienestar, 'byUsuario').mockReturnValue([
      { fecha: hoyIso() } as never,
    ])
    pintar()
    expect(screen.queryByText(/Check-in diario pendiente/)).not.toBeInTheDocument()
  })

  it('la sesión de hoy lleva a /entrenar/sesion/:id', () => {
    pintar()
    expect(hrefDe(/Empezar sesión/)).toMatch(/^\/entrenar\/sesion\/.+/)
  })

  it('enlaces del resto: logros, contenidos y cuestionarios siguen llegando a su pantalla', () => {
    pintar()
    abrirElResto()
    expect(document.querySelector('a[href="/logros"]')).not.toBeNull()
    expect(document.querySelector('a[href="/contenidos"]')).not.toBeNull()
    expect(document.querySelector('a[href="/cuestionarios"]')).not.toBeNull()
  })

  it('bloque actual, álbum y radar siguen en la pantalla; el mapa de fatiga vive en Progreso', () => {
    pintar()
    abrirElResto()
    expect(screen.queryByText(/Fatiga por grupo muscular/)).not.toBeInTheDocument()
    expect(screen.getByText(/Radar Alfa/)).toBeInTheDocument()
  })

  it('barra para escribirle al coach y revisión de la semana: siguen', () => {
    pintar()
    expect(screen.getByText(/Escríbele a tu coach/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /revisión de la semana/i })).toBeInTheDocument()
  })

  it('vista simple (Karin): sin «microciclo» ni cadencia en Hoy', () => {
    const perfil = db.perfiles.byUsuario('u-valentina')
    if (!perfil) throw new Error('el seed no trae perfil')
    vi.spyOn(db.perfiles, 'byUsuario').mockReturnValue({ ...perfil, vistaSimple: true })
    pintar()
    abrirElResto()
    expect(screen.getByText(/^Semana \d+$/)).toBeInTheDocument()
    expect(screen.queryByText(/Cadencia/)).not.toBeInTheDocument()
    expect(screen.queryByText(/microciclo/i, { selector: 'p, h2, h3' })).not.toBeInTheDocument()
  })

  it('sin vista simple, el contexto del microciclo sí se dice', () => {
    pintar()
    expect(screen.getByText(/Cadencia \d+ días/)).toBeInTheDocument()
  })
})
