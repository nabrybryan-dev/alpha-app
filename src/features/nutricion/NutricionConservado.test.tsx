import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { TotalDia } from '../../domain/nutricion/dia'
import { hoyIso } from '../../data/dbInstance'
import { db } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import { AdherenciaDia } from './AdherenciaDia'
import { Hidratacion } from './Hidratacion'
import { PanelCalibracion } from './PanelCalibracion'
import { PanelMicros } from './PanelMicros'
import { TiraSemana } from './TiraSemana'
import { VistaSemana } from './VistaSemana'

/**
 * Inventario de lo que Nutrición ya hacía y el rediseño NO puede perder.
 *
 * Estas pruebas están escritas contra el código anterior al rediseño: tienen
 * que pasar antes y después. Lo que vigilan es el inventario de la zona 2:
 * tira de la semana, semana, micros, calibración, hidratación, adherencia,
 * vista simple (en MiPlan.test) y la compuerta (en DiarioDia.test).
 */

const USUARIO = 'u-valentina'

const FECHAS = [
  '2026-10-19',
  '2026-10-20',
  '2026-10-21',
  '2026-10-22',
  '2026-10-23',
  '2026-10-24',
  '2026-10-25',
]

const resumenSemana = () => ({
  dias: FECHAS.map((fecha, i) => ({
    fecha,
    kcal: i < 3 ? 1800 : 0,
    proteinaG: i < 3 ? 120 : 0,
    registrado: i < 3,
  })),
  diasRegistrados: 3,
  promedioKcal: 1800,
  promedioProteinaG: 120,
  contraPauta: -100,
  comidasRegistradas: 9,
})

const total = (porDia: Record<string, number>, parciales: string[] = []): TotalDia => ({
  porDia,
  parciales: new Set(parciales),
  margenPct: 10,
})

describe('tira de la semana', () => {
  it('pinta los siete días, con punto en los que tienen registro', () => {
    render(
      <TiraSemana
        fecha="2026-10-22"
        conRegistro={new Set(['2026-10-19', '2026-10-22'])}
        onElegir={() => {}}
      />,
    )

    const dias = screen.getAllByRole('button', { name: /^\d{4}-\d{2}-\d{2}$/ })
    expect(dias).toHaveLength(7)
    expect(dias[0]).toHaveAttribute('aria-pressed', 'false')
    expect(dias[3]).toHaveAttribute('aria-pressed', 'true')
  })

  it('tocar un día lo entrega para abrir lo registrado ese día', async () => {
    const elegir = vi.fn()
    render(
      <TiraSemana fecha="2026-10-22" conRegistro={new Set()} onElegir={elegir} />,
    )

    await userEvent.click(screen.getByRole('button', { name: '2026-10-20' }))
    expect(elegir).toHaveBeenCalledWith('2026-10-20')
  })

  /**
   * `bg-placa` no existía en `tailwind.config.js`: el punto de «día con
   * registro» se pintaba transparente y el relleno de la barra de kcal también.
   * Se usa la clase que sí está en el tema.
   */
  it('el punto del día con registro usa una clase definida', () => {
    const { container } = render(
      <TiraSemana
        fecha="2026-10-22"
        conRegistro={new Set(['2026-10-19'])}
        onElegir={() => {}}
      />,
    )

    expect(container.querySelector('.bg-logrado')).toBeInTheDocument()
    expect(container.querySelector('.bg-placa')).toBeNull()
  })
})

describe('la vista de la semana', () => {
  it('sigue enseñando promedio, contra pauta, barras y días por anotar', () => {
    const resumen = resumenSemana()
    render(
      <MemoryRouter>
        <VistaSemana
          resumen={resumen}
          meta={{ kcal: 1900, proteinaG: 135, carbosG: 190, grasaG: 60 }}
          visibilidad={{
            verComposicion: true,
            verObjetivoCalorico: true,
            verContadorKcal: true,
            estado: 'automatico',
          }}
          onElegirDia={() => {}}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText(/promedio registrado/i)).toBeInTheDocument()
    expect(screen.getByText(/vs\. pauta/i)).toBeInTheDocument()
    expect(screen.getAllByText(/días anotados/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/faltan/i)).toBeInTheDocument()
  })
})

describe('micronutrientes', () => {
  it('enseña hierro, vitamina C y potasio con sus referencias', () => {
    render(<PanelMicros total={total({ hierro_mg: 4.2, vitamina_c_mg: 30, potasio_mg: 900 })} />)

    expect(screen.getByRole('heading', { name: 'Micronutrientes clave' })).toBeInTheDocument()
    expect(screen.getByText('Hierro')).toBeInTheDocument()
    expect(screen.getByText('Vitamina C')).toBeInTheDocument()
    expect(screen.getByText('Potasio')).toBeInTheDocument()
    expect(screen.getByText(/18 mg/)).toBeInTheDocument()
  })

  it('cuando a un alimento le falta el dato, la cifra es un mínimo con «≥»', () => {
    const { container } = render(
      <PanelMicros total={total({ hierro_mg: 4.2, vitamina_c_mg: 30, potasio_mg: 900 }, ['vitamina_c_mg'])} />,
    )

    expect(container.textContent).toContain('≥ 30')
  })
})

describe('calibración del ojo', () => {
  it('dice cuántas pruebas lleva y ofrece hacer una', async () => {
    render(<PanelCalibracion pruebas={[]} diasPesando={0} onRegistrar={() => {}} />)

    expect(screen.getByRole('heading', { name: 'Tu ojo' })).toBeInTheDocument()
    expect(screen.getByText('0 / 15 pruebas')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Hacer una prueba' }))
    expect(screen.getByLabelText('Nombre del alimento')).toBeInTheDocument()
  })
})

describe('hidratación', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
  })

  it('suma y resta de 250 ml, y la meta sale del peso × 30 ml', async () => {
    render(<Hidratacion usuarioId={USUARIO} />)

    expect(screen.getByText(/de 1,8L/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar 250 mililitros' }))
    expect(db.nutricion.hidratacionDe(USUARIO, hoyIso())).toBe(250)

    const quitar = await screen.findByRole('button', { name: 'Quitar 250 mililitros' })
    await userEvent.click(quitar)
    expect(db.nutricion.hidratacionDe(USUARIO, hoyIso())).toBe(0)
    expect(screen.queryByRole('button', { name: 'Quitar 250 mililitros' })).toBeNull()
  })

  /**
   * Sin peso la meta no sale de ninguna fórmula: son 2 L fijos. Decir «tu peso
   * × 30 ml» ahí es enseñar un cálculo que no se hizo.
   */
  it('sin peso dice que la meta es fija, no que salió del peso', () => {
    render(<Hidratacion usuarioId="u-sin-peso" />)

    expect(screen.getByText(/de 2L/)).toBeInTheDocument()
    expect(screen.getByText(/meta fija de 2 L/i)).toBeInTheDocument()
    expect(screen.queryByText(/tu peso × 30 ml/i)).toBeNull()
  })
})

describe('adherencia del día', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
  })

  it('las tres respuestas se guardan y después queda fijo', async () => {
    render(<AdherenciaDia usuarioId={USUARIO} />)

    expect(screen.getByText(/¿cumpliste el plan hoy\?/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sí ✓' }))

    expect(screen.getByText(/registrado: cumplido/i)).toBeInTheDocument()
    expect(db.nutricion.adherenciasByUsuario(USUARIO).some((a) => a.fecha === hoyIso())).toBe(true)
  })
})
