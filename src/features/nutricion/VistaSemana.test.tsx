import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VistaSemana } from './VistaSemana'
import type { ResumenSemana } from '../../domain/nutricion/semanaResumen'
import type { Visibilidad } from '../../domain/nutricion/visibilidad'

const FECHAS = [
  '2026-07-27',
  '2026-07-28',
  '2026-07-29',
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
  '2026-08-02',
]

const META = { kcal: 2100, proteinaG: 115, carbosG: 240, grasaG: 62 }

const resumen = (registrados: number[]): ResumenSemana => {
  const dias = FECHAS.map((fecha, i) => ({
    fecha,
    kcal: registrados.includes(i) ? 1900 : 0,
    proteinaG: registrados.includes(i) ? 110 : 0,
    registrado: registrados.includes(i),
  }))
  return {
    dias,
    diasRegistrados: registrados.length,
    promedioKcal: registrados.length ? 1900 : 0,
    promedioProteinaG: registrados.length ? 110 : 0,
    contraPauta: registrados.length ? 1900 - 2100 : 0,
    comidasRegistradas: registrados.length * 3,
  }
}

const TODO_VISIBLE: Visibilidad = {
  verComposicion: true,
  verObjetivoCalorico: true,
  verContadorKcal: true,
  estado: 'automatico',
}

const pintar = (registrados: number[], visibilidad: Visibilidad = TODO_VISIBLE) => {
  const onElegirDia = vi.fn()
  render(
    <VistaSemana
      resumen={resumen(registrados)}
      meta={META}
      visibilidad={visibilidad}
      onVolver={vi.fn()}
      onElegirDia={onElegirDia}
    />,
  )
  return { onElegirDia }
}

describe('VistaSemana', () => {
  it('enseña el promedio de lo registrado', () => {
    pintar([0, 1, 2])
    expect(screen.getByText('1.900')).toBeInTheDocument()
  })

  it('dice sobre cuántos días es esa media', () => {
    // Un promedio de dos días y uno de siete no se leen igual, y sin el número
    // parecen lo mismo.
    pintar([0, 1])
    expect(screen.getByText(/sobre 2 días anotados/i)).toBeInTheDocument()
  })

  it('un solo día se dice en singular', () => {
    pintar([0])
    expect(screen.getByText(/sobre 1 día anotado/i)).toBeInTheDocument()
  })

  it('marca la diferencia contra la pauta', () => {
    pintar([0])
    expect(screen.getByText('-200')).toBeInTheDocument()
  })

  it('avisa de los días que faltan por anotar', () => {
    pintar([0, 1, 2])
    expect(screen.getByText(/faltan/i)).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('con la semana completa no molesta con el aviso', () => {
    pintar([0, 1, 2, 3, 4, 5, 6])
    expect(screen.queryByText(/todavía no dice cómo fue la semana/i)).not.toBeInTheDocument()
  })

  describe('los días sin registro', () => {
    it('se distinguen de un día de cero calorías', () => {
      pintar([0])
      expect(screen.getByRole('button', { name: /2026-07-28: sin registrar/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /2026-07-27: 1900 kcal/i })).toBeInTheDocument()
    })
  })

  it('tocar un día lleva a ese día', async () => {
    const { onElegirDia } = pintar([0])
    await userEvent.click(screen.getByRole('button', { name: /2026-07-29/ }))
    expect(onElegirDia).toHaveBeenCalledWith('2026-07-29')
  })

  describe('una semana en blanco', () => {
    it('no enseña un promedio de cero, explica que falta registrar', () => {
      // Un "0 kcal de promedio" leería como si hubiera ayunado toda la semana.
      pintar([])
      expect(screen.getByText(/no has anotado nada todavía/i)).toBeInTheDocument()
      expect(screen.queryByText(/promedio registrado/i)).not.toBeInTheDocument()
    })
  })

  /**
   * Esta pantalla era el agujero del interruptor del contador: se apagó el
   * contador del diario y aquí seguía habiendo un promedio de kcal, un «vs.
   * pauta» y un gráfico de barras de calorías por día. Apagar el contador de una
   * pantalla y dejarlo en la de al lado no protege a nadie: solo le obliga a dar
   * un rodeo.
   */
  describe('con el contador apagado', () => {
    const SIN_CONTADOR: Visibilidad = {
      verComposicion: false,
      verObjetivoCalorico: false,
      verContadorKcal: false,
      estado: 'decidido',
    }

    it('no hay promedio de kcal ni comparación contra la pauta', () => {
      pintar([0, 1, 2], SIN_CONTADOR)
      expect(screen.queryByText(/promedio registrado/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/vs\. pauta/i)).not.toBeInTheDocument()
      expect(screen.queryByText('1.900')).not.toBeInTheDocument()
    })

    it('las barras dejan de medir calorías', () => {
      // Una barra proporcional a las kcal sigue siendo el contador, dibujado.
      pintar([0], SIN_CONTADOR)
      expect(screen.queryByRole('button', { name: /1900 kcal/i })).not.toBeInTheDocument()
    })

    it('pero sí se sigue viendo qué días anotó: eso es adherencia, no una cifra sobre su cuerpo', () => {
      pintar([0], SIN_CONTADOR)
      expect(screen.getByRole('button', { name: /2026-07-27: registrado/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /2026-07-28: sin registrar/i })).toBeInTheDocument()
      expect(screen.getByText('Días anotados')).toBeInTheDocument()
    })

    it('la media de proteína se va con el objetivo calórico: es una meta', () => {
      pintar([0, 1], SIN_CONTADOR)
      expect(screen.queryByText(/proteína media/i)).not.toBeInTheDocument()
    })
  })
})
