import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { db, hoyIso } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import HoyPage from './HoyPage'

/**
 * EL CHECK-IN, EN LÍNEA EN HOY (paso 6 del rediseño).
 *
 * Antes era un enlace a `/bienestar`: la persona salía de su día para hacer lo primero
 * que la app le pide cada mañana. Ahora es el MISMO formulario (`ChequeoDeHoy`), dentro
 * de Hoy, y `/bienestar` sigue existiendo como detalle.
 */
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

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
})

describe('Hoy · el check-in se hace sin salir de la pantalla', () => {
  it('el formulario está dentro de Hoy, no detrás de un enlace a Bienestar', async () => {
    pintar()
    expect(await screen.findByRole('region', { name: 'Chequeo de hoy' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guardar check-in/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Check-in diario pendiente/ })).not.toBeInTheDocument()
  })

  it('hecho, queda en resumen y no vuelve a pedir el formulario', async () => {
    db.bienestar.guardar({
      id: 'ck-hoy-test',
      usuarioId: 'u-valentina',
      fecha: hoyIso(),
      horasSueno: 7,
      estres: 'POCO',
      dolor: 5,
    })
    pintar()
    const chequeo = await screen.findByRole('region', { name: 'Chequeo de hoy' })
    expect(screen.getByText('Registrado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Guardar check-in/ })).not.toBeInTheDocument()
    // El dolor se sigue viendo en rojo, como en el formulario.
    expect(chequeo.querySelector('.border-rojo')).not.toBeNull()
    expect(screen.getByText('5/10')).toBeInTheDocument()
  })

  it('el historial se va a Progreso, que ahora es su casa', async () => {
    db.bienestar.guardar({
      id: 'ck-hoy-test',
      usuarioId: 'u-valentina',
      fecha: hoyIso(),
      horasSueno: 7,
      estres: 'POCO',
      dolor: 0,
    })
    pintar()
    expect(await screen.findByRole('link', { name: 'Ver mi historial' })).toHaveAttribute('href', '/progreso')
  })

  it('deja una entrada visible a Bienestar para el recordatorio y el resumen del día', async () => {
    pintar()
    const chequeo = await screen.findByRole('region', { name: 'Chequeo de hoy' })
    expect(within(chequeo).getByRole('link', { name: /Ver todo y recordatorio/ })).toHaveAttribute(
      'href',
      '/bienestar',
    )
  })
})
