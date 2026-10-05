/**
 * «Mi día» del staff que también entrena (Manuela), maqueta «Espacios de Alpha» del 28-sep.
 *
 * La sesión se sustituye en su capa más baja para que la persona que mira sea staff
 * (`nutricionista`) con los datos ficticios del seed de Valentina: así se prueba la pantalla
 * de verdad, con sus números reales, sin inventar un usuario nuevo en la base de demo.
 *
 * Lo que sujeta: el orden de la maqueta para el staff, que cada cifra sale de los datos (y
 * que lo que falta se dice, no se rellena), y que el asesorado normal NO ve nada de esto.
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '../../app/ThemeProvider'
import { db, hoyIso } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import type { Rol } from '../../domain/types'

const quien = { rol: 'nutricionista' as Rol }

vi.mock('../../app/SessionProvider', () => {
  const sesion = () => ({
    usuario: { id: 'u-valentina', nombre: 'Manuela Prueba', rol: quien.rol, avatarIniciales: 'MP' },
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  })
  return { useSesion: sesion, useSesionOpcional: sesion }
})

const { default: HoyPage } = await import('./HoyPage')

function pintar() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <HoyPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

const antes = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
  quien.rol = 'nutricionista'
})

describe('Mi día del staff', () => {
  it('pinta las secciones de la maqueta en su orden', async () => {
    pintar()
    const nutricion = await screen.findByRole('region', { name: 'Mi nutrición de hoy' })
    const orden = [
      screen.getByRole('region', { name: 'Resumen de la semana' }),
      screen.getByRole('region', { name: 'Tu revisión de la semana' }),
      screen.getByRole('region', { name: 'Chequeo de hoy' }),
      nutricion,
      screen.getByRole('region', { name: 'Medidas y peso' }),
    ]
    for (let i = 1; i < orden.length; i++) expect(antes(orden[i - 1], orden[i])).toBe(true)
  })

  it('«Tu semana» cuenta con los datos reales, y deja /progreso a mano', async () => {
    pintar()
    const semana = screen.getByRole('region', { name: 'Resumen de la semana' })
    const activo = db.microciclos.byUsuario('u-valentina').find((m) => m.estado === 'activo')!
    expect(within(semana).getByText(new RegExp(`de ${activo.sesiones.length} sesiones hechas`))).toBeInTheDocument()
    // El seed trae sueño apuntado los últimos días: sale una media, no una raya.
    expect(within(semana).getByText(/horas de sueño de media/)).toBeInTheDocument()
    expect(within(semana).getByText(/% de adherencia/)).toBeInTheDocument()
    expect(within(semana).getByRole('link', { name: 'Mi progreso' })).toHaveAttribute('href', '/progreso')
    await screen.findByRole('region', { name: 'Mi nutrición de hoy' })
  })

  it('sin horas de sueño apuntadas lo dice en vez de inventar la media', async () => {
    for (const c of db.bienestar.byUsuario('u-valentina')) db.bienestar.guardar({ ...c, horasSueno: undefined })
    pintar()
    const semana = screen.getByRole('region', { name: 'Resumen de la semana' })
    expect(within(semana).getByText('Sin horas de sueño apuntadas')).toBeInTheDocument()
    await screen.findByRole('region', { name: 'Mi nutrición de hoy' })
  })

  it('el chequeo de hoy se hace dentro de la pantalla y, hecho, queda en resumen', async () => {
    const { unmount } = pintar()
    const chequeo = screen.getByRole('region', { name: 'Chequeo de hoy' })
    expect(within(chequeo).getByRole('button', { name: /Guardar check-in/ })).toBeInTheDocument()
    await screen.findByRole('region', { name: 'Mi nutrición de hoy' })
    unmount()

    db.bienestar.guardar({ id: 'ck-hoy', usuarioId: 'u-valentina', fecha: hoyIso(), horasSueno: 7, estres: 'POCO', dolor: 5 })
    pintar()
    const hecho = screen.getByRole('region', { name: 'Chequeo de hoy' })
    expect(within(hecho).getByText('Registrado')).toBeInTheDocument()
    expect(within(hecho).queryByRole('button', { name: /Guardar check-in/ })).not.toBeInTheDocument()
    expect(within(hecho).getByText('5/10')).toBeInTheDocument()
    await screen.findByRole('region', { name: 'Mi nutrición de hoy' })
  })

  it('su nutrición de hoy va contra su objetivo y lleva al diario', async () => {
    pintar()
    const nutricion = await screen.findByRole('region', { name: 'Mi nutrición de hoy' })
    // La meta del día ALTO del plan del seed: 2.100 kcal.
    expect(within(nutricion).getByText(/de 2\.100 kcal/)).toBeInTheDocument()
    expect(within(nutricion).getByRole('link', { name: 'Abrir mi diario' })).toHaveAttribute('href', '/nutricion')
  })

  it('medidas y peso: el último peso en grande, su curva y el acceso a registrar', async () => {
    pintar()
    const medidas = screen.getByRole('region', { name: 'Medidas y peso' })
    const ultimo = [...db.bienestar.byUsuario('u-valentina')].reverse().find((c) => c.pesoKg !== undefined)!.pesoKg!
    expect(within(medidas).getByText(`${ultimo.toLocaleString('es-CO')} kilos`)).toBeInTheDocument()
    expect(within(medidas).getByRole('img', { name: /Peso de las últimas 8 semanas/ })).toBeInTheDocument()
    expect(within(medidas).getByRole('link', { name: 'Registrar' })).toHaveAttribute('href', '/bienestar')
    await screen.findByRole('region', { name: 'Mi nutrición de hoy' })
  })

  it('ya no lleva los tres accesos sueltos de la fase 1', async () => {
    pintar()
    expect(screen.queryByRole('navigation', { name: 'Mi día' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Chequeo y medidas' })).not.toBeInTheDocument()
    await screen.findByRole('region', { name: 'Mi nutrición de hoy' })
  })
})

describe('el asesorado normal no cambia', () => {
  it('no ve ninguna de las piezas de Mi día y conserva su check-in y sus tres cifras', () => {
    quien.rol = 'asesorado'
    pintar()
    for (const nombre of ['Resumen de la semana', 'Chequeo de hoy', 'Mi nutrición de hoy', 'Medidas y peso']) {
      expect(screen.queryByRole('region', { name: nombre })).not.toBeInTheDocument()
    }
    expect(screen.getByText('Check-in diario pendiente')).toBeInTheDocument()
    expect(screen.getByText('Racha')).toBeInTheDocument()
  })
})
