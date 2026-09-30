import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { db, hoyIso } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import EquipoNutricionPage from './EquipoNutricionPage'

/**
 * El panel de la nutricionista. Estas pruebas nacen de un refactor: el cálculo
 * de las filas pasó a estar memoizado y a hacer una sola pasada por las
 * adherencias, y el archivo no tenía ninguna prueba que sujetara las cifras.
 *
 * Lo que sujetan es la distinción que más fácil se pierde al juntar recorridos:
 * la ventana de 30 días vale para los CONTADORES, pero no para la RACHA.
 */

const pintar = (ruta = '/equipo-nutricion') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <SessionProvider>
        <EquipoNutricionPage />
      </SessionProvider>
    </MemoryRouter>,
  )

const comoStaff = () => localStorage.setItem('alpha-usuario', 'u-bryan')

const hace = (dias: number): string => {
  const d = new Date(`${hoyIso()}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString().slice(0, 10)
}

/**
 * 35 días seguidos cumpliendo, de hoy hacia atrás. El número está elegido: pasa
 * de los 30 de la ventana, así que separa las dos lecturas. El seed trae 12
 * adherencias de los últimos 12 días y `marcarAdherencia` las pisa por fecha.
 */
const treintaYCincoDiasSeguidos = () => {
  for (let i = 0; i < 35; i++) db.nutricion.marcarAdherencia('u-valentina', hace(i), 'si')
}

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
  comoStaff()
})

describe('EquipoNutricionPage', () => {
  it('la selección desde Equipo muestra solo esa persona, sin bandejas ni enlaces globales', () => {
    pintar('/equipo-nutricion?persona=u-valentina')
    const cartera = screen.getByRole('region', { name: 'Adherencia del equipo' })
    expect(within(cartera).getByText(db.usuarios.byId('u-valentina')!.nombre)).toBeInTheDocument()
    for (const u of db.usuarios.asesorados().filter((u) => u.id !== 'u-valentina')) {
      expect(within(cartera).queryByText(u.nombre)).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('link', { name: /Qué cifras ve cada asesorado/ })).toBeNull()
    expect(screen.getByRole('link', { name: 'Volver a Equipo' })).toHaveAttribute('href', '/equipo')
  })

  it('una selección inválida no abre la cartera completa como alternativa', () => {
    pintar('/equipo-nutricion?persona=no-existe')
    const cartera = screen.getByRole('region', { name: 'Adherencia del equipo' })
    expect(within(cartera).getByRole('status')).toHaveTextContent('no está disponible')
    for (const u of db.usuarios.asesorados()) expect(within(cartera).queryByText(u.nombre)).toBeNull()
  })
  /**
   * Los contadores SÍ se cortan a 30 días: de hoy a hace 30 hay 31 días
   * registrados, no 35. Si el corte se perdiera, la nutricionista leería una
   * adherencia calculada sobre una ventana que la pantalla dice no usar.
   */
  it('los contadores solo miran los últimos 30 días', () => {
    treintaYCincoDiasSeguidos()
    const { container } = pintar()

    expect(container.textContent).toContain('31✓ · 0± · 0✗ en 31 días')
    expect(container.textContent).toContain('100%')
  })

  /**
   * LA RACHA NO. Mide constancia, y cortarla en el borde de la ventana
   * convertiría a quien lleva 35 días seguidos en alguien que lleva 31. Es la
   * mitad del cálculo que se pierde al reutilizar la lista ya filtrada, que es
   * justo el atajo que invita a tomar juntar los dos recorridos en uno.
   */
  it('la racha cuenta más atrás de la ventana de 30 días', () => {
    treintaYCincoDiasSeguidos()
    const { container } = pintar()

    expect(container.textContent).toContain('Racha 35')
  })

  /**
   * La prueba del memo. Las filas se cachean por versión del estado, así que
   * una escritura posterior TIENE que invalidarlo. Si la llave estuviera mal
   * -por ejemplo memoizando solo por el día- esto seguiría mostrando las cifras
   * viejas, sin error y sin aviso.
   */
  it('una adherencia nueva se refleja: el memo no sirve cifras viejas', async () => {
    treintaYCincoDiasSeguidos()
    const { container } = pintar()
    expect(container.textContent).toContain('31✓ · 0± · 0✗ en 31 días')

    // Hoy pasa de cumplido a parcial: un ✓ menos y un ± más, sin cambiar el total.
    db.nutricion.marcarAdherencia('u-valentina', hace(0), 'parcial')

    expect(await screen.findByText(/30✓/)).toBeTruthy()
    expect(container.textContent).toContain('30✓ · 1± · 0✗ en 31 días')
  })

  /**
   * Las tres cifras de arriba (maqueta «Espacios de Alpha», 28-sep) salen de las mismas
   * filas que la lista: evaluados = quien tiene algún registro en 30 días; piden atención =
   * lo que la lista pinta en rojo (sin registros o por debajo del 50 %).
   */
  it('la cabecera cuenta evaluados y los que piden atención con las filas de la lista', () => {
    // Valentina en rojo a propósito: 30 días sin cumplir.
    for (let i = 0; i < 30; i++) db.nutricion.marcarAdherencia('u-valentina', hace(i), 'no')
    pintar()
    const resumen = screen.getByRole('group', { name: 'Resumen del equipo' })
    const asesorados = db.usuarios.asesorados()
    const conRegistros = asesorados.filter((a) =>
      db.nutricion.adherenciasByUsuario(a.id).some((x) => x.fecha >= hace(30)),
    ).length
    expect(within(resumen).getByText(`${conRegistros} evaluados con registros en 30 días`)).toBeInTheDocument()
    // Todos los sin registros + Valentina, que está al 0 %.
    const atencion = asesorados.length - conRegistros + 1
    expect(within(resumen).getByText(`${atencion} piden atención`)).toBeInTheDocument()
    expect(within(resumen).getByText(/esperan decidir qué cifras ven/)).toBeInTheDocument()
  })

  /** Sin la capacidad de aprobar, las bandejas de la consola no se pintan (se ocultan solas). */
  it('sin capacidades de aprobación no hay bandejas de planes', () => {
    pintar()
    expect(screen.queryByText('Primeros planes por aprobar')).not.toBeInTheDocument()
    expect(screen.queryByText('Planes estratégicos por aprobar')).not.toBeInTheDocument()
  })

  /** Quien no es staff no entra: se le redirige fuera y no ve al equipo. */
  it('un asesorado no puede entrar', () => {
    localStorage.setItem('alpha-usuario', 'u-valentina')
    const { container } = pintar()

    expect(container.textContent).not.toContain('Evaluación nutricional del equipo')
  })
})
