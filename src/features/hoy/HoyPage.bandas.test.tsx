/**
 * Hoy del asesorado en tres bandas (Fase 3, paso 3; 04 §3.2 y maqueta v7).
 *
 * Banda 0, solo si aplica: lo que se dice antes que nada (algo no subió, permiso, cribado de salud).
 * Banda 1, «Lo de hoy»: la sesión con su estado, los carteles del microciclo (empieza el…,
 * terminó el…), la pregunta del día, el check-in y los pendientes (nutrición, cuestionarios).
 * Banda 2, «La semana»: la revisión con la pregunta del coach y el cuadro para escribirle.
 * Banda 3, «El resto», plegada.
 *
 * Estas pruebas se escribieron en rojo contra el orden viejo, que ponía la revisión de la
 * semana arriba de todo y la sesión en el puesto 9 de 19 (04 §1.2); hoy están en verde.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { db } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import type { Cuestionario, Microciclo } from '../../domain/types'
import HoyPage from './HoyPage'

const LUNES = new Date('2026-08-24T08:00:00')

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

const antes = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
const banda = (nombre: string) => screen.getByRole('region', { name: nombre })
const resto = () => screen.getByRole('button', { name: /El resto/i })

/** Deja al asesorado con una sola sesión de lunes y `hechos` ejercicios con todas sus series. */
function conSesionDeLunes(hechos: number) {
  const base = db.microciclos.byUsuario('u-valentina').find((x) => x.estado === 'activo')
  if (!base) throw new Error('el seed no trae microciclo activo')
  const s = base.sesiones[0]
  const propuesta: Microciclo = {
    ...base,
    id: 'm-bandas-test',
    numero: base.numero + 1,
    estado: 'propuesto',
    fechaInicio: '2026-08-24',
    sesiones: [
      {
        ...s,
        id: 's-lun',
        nombre: 'ESPALDA (LUNES)',
        orden: 1,
        testPost: undefined,
        preparacion: s.preparacion?.map((p) => ({ ...p, hechoEn: undefined })),
        bloquesCardio: s.bloquesCardio?.map((b) => ({ ...b, hechoEn: undefined })),
        ejercicios: s.ejercicios.map((e, i) => ({
          ...e,
          series:
            i < hechos
              ? Array.from({ length: e.sets }, (_, k) => ({ orden: k + 1, cargaKg: 20, reps: 8, rir: 2 }))
              : [],
        })),
      },
    ],
  }
  db.microciclos.guardarPropuesta(propuesta)
  db.microciclos.activarPropuesta(propuesta.id)
  return s.ejercicios.length
}

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(LUNES)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Hoy en tres bandas — el tema', () => {
  it('el asesorado NO fuerza data-theme="light": sigue el tema de la persona (decisión de Bryan)', () => {
    const { container } = pintar()
    expect(container.querySelector('[data-theme="light"]')).toBeNull()
    expect(container.querySelector('[data-theme]')).toBeNull()
  })
})

describe('Hoy en tres bandas — el orden', () => {
  it('la sesión de hoy abre la banda 1 y va ANTES que la revisión de la semana', () => {
    conSesionDeLunes(0)
    pintar()
    const hoy = banda('Lo de hoy')
    const sesion = within(hoy).getByRole('link', { name: /Empezar sesión/ })
    const semana = banda('La semana')
    expect(antes(sesion, semana)).toBe(true)
    expect(within(semana).getByRole('region', { name: /revisión de la semana/i })).toBeInTheDocument()
  })

  it('banda 1: sesión, pregunta del día, check-in y nutrición de hoy, en ese orden', () => {
    const q: Cuestionario = {
      id: 'preg-bandas-M1',
      titulo: 'Tu coach te pregunta',
      descripcion: '',
      asignadoA: ['u-valentina'],
      origen: 'cadena',
      preguntas: [{ id: 'p1', tipo: 'texto', enunciado: '¿Cómo sientes el hombro hoy?' }],
    }
    vi.spyOn(db.cuestionarios, 'asignadosA').mockReturnValue([q])
    conSesionDeLunes(0)
    pintar()
    const hoy = banda('Lo de hoy')
    const orden = [
      within(hoy).getByRole('link', { name: /Empezar sesión/ }),
      within(hoy).getByText('¿Cómo sientes el hombro hoy?'),
      // El check-in va EN LÍNEA desde el paso 6 (zona 3): el formulario, no un enlace.
      within(hoy).getByRole('region', { name: 'Chequeo de hoy' }),
      within(hoy).getByText(/Marcar nutrición de hoy/),
    ]
    for (let i = 1; i < orden.length; i++) expect(antes(orden[i - 1], orden[i])).toBe(true)
  })

  it('banda 2: la revisión y el cuadro para escribirle al coach; no están en la banda 1', () => {
    pintar()
    const semana = banda('La semana')
    expect(within(semana).getByRole('region', { name: /revisión de la semana/i })).toBeInTheDocument()
    expect(within(semana).getByText(/Escríbele a tu coach/)).toBeInTheDocument()
    expect(within(banda('Lo de hoy')).queryByText(/Escríbele a tu coach/)).not.toBeInTheDocument()
  })

  it('banda 0: lo que no subió va ANTES de la sesión', () => {
    localStorage.setItem(
      'alpha-cola-descartes',
      JSON.stringify([{ tabla: 'registro_comida', tipo: 'upsert', payload: {}, duenio: 'u-valentina' }]),
    )
    conSesionDeLunes(0)
    pintar()
    const aviso = screen.getByText(/Al menos 1 registro no ha llegado/)
    expect(antes(aviso, within(banda('Lo de hoy')).getByRole('link', { name: /Empezar sesión/ }))).toBe(true)
  })

  it('las tres bandas van en orden: hoy, la semana, el resto', () => {
    pintar()
    expect(antes(banda('Lo de hoy'), banda('La semana'))).toBe(true)
    expect(antes(banda('La semana'), resto())).toBe(true)
  })
})

describe('Hoy en tres bandas — «El resto» plegado', () => {
  it('arranca plegado: bloque, álbum, radar y contenidos no están a la vista', () => {
    pintar()
    expect(resto()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: /Contenidos/ })).not.toBeInTheDocument()
    // El mapa de fatiga ya no está en Hoy: se mudó a Progreso (paso 7, zona 3).
    expect(screen.queryByText(/Fatiga por grupo muscular/)).not.toBeInTheDocument()
    // jsdom no aplica Tailwind: el contenedor tiene que traer la clase que lo oculta de verdad,
    // porque `hidden` solo lo anula cualquier `display:flex` (visto en la captura del 24-oct).
    expect(document.getElementById(resto().getAttribute('aria-controls') ?? '')).toHaveClass('hidden')
    expect(document.getElementById(resto().getAttribute('aria-controls') ?? '')).not.toHaveClass('flex')
  })

  it('un toque lo abre y deja ver todo lo que había', () => {
    pintar()
    fireEvent.click(resto())
    expect(resto()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: /Contenidos/ })).toBeVisible()
    expect(screen.getByRole('link', { name: /Cuestionarios/ })).toBeVisible()
    expect(screen.getByText('Racha')).toBeVisible()
  })
})

describe('Hoy en tres bandas — la tarjeta de sesión dice su estado', () => {
  it('sin empezar: «Empezar sesión», sin barra de avance', () => {
    conSesionDeLunes(0)
    pintar()
    expect(screen.getByRole('link', { name: /Empezar sesión/ })).toBeInTheDocument()
    expect(within(banda('Lo de hoy')).queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('en curso: «Continuar sesión» con «N de M ejercicios hechos» y su barra', () => {
    const total = conSesionDeLunes(1)
    pintar()
    expect(screen.getByRole('link', { name: /Continuar sesión/ })).toBeInTheDocument()
    expect(screen.getByText(`1 de ${total} ejercicios hechos`)).toBeInTheDocument()
    expect(within(banda('Lo de hoy')).getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      String(Math.round(100 / total)),
    )
  })
})
