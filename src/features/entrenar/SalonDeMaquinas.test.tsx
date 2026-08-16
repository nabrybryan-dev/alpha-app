import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SalonDeMaquinas } from './SalonDeMaquinas'
import type { EjercicioPrescrito, SerieRegistrada } from '../../domain/types'

function ejercicio(id: string, sets: number, hechas: number): EjercicioPrescrito {
  const series: SerieRegistrada[] = Array.from({ length: hechas }, (_, i) => ({
    orden: i + 1,
    cargaKg: 40,
    reps: 8,
    rir: 2,
  }))
  return {
    id,
    categoria: 'SENTADILLA',
    nombre: 'Sentadilla',
    cues: '',
    prescripcion: '',
    descansoMin: 2,
    sets,
    rango: '8-10',
    repsDiana: 8,
    rirObjetivo: 2,
    series,
  }
}

const TRES_A_MEDIAS = [ejercicio('a', 3, 3), ejercicio('b', 3, 1), ejercicio('c', 3, 0)]
const TRES_HECHOS = [ejercicio('a', 3, 3), ejercicio('b', 3, 3), ejercicio('c', 3, 3)]

describe('SalonDeMaquinas', () => {
  it('cuenta las máquinas abiertas', () => {
    render(<SalonDeMaquinas ejercicios={TRES_A_MEDIAS} />)
    expect(screen.getByText('1/3 máquinas')).toBeInTheDocument()
  })

  it('cada ficha dice si está abierta o pendiente', () => {
    render(<SalonDeMaquinas ejercicios={TRES_A_MEDIAS} />)
    expect(screen.getByLabelText('LIBERTY BELL, abierta')).toBeInTheDocument()
    expect(screen.getByLabelText('FRUIT MACHINE, pendiente')).toBeInTheDocument()
    expect(screen.getByLabelText('SEVENS & BARS, pendiente')).toBeInTheDocument()
  })

  it('con todas hechas aparece la insignia y desaparece el contador', () => {
    render(<SalonDeMaquinas ejercicios={TRES_HECHOS} />)
    expect(screen.getByText('Salón completo')).toBeInTheDocument()
    expect(screen.queryByText(/máquinas$/)).not.toBeInTheDocument()
  })

  it('sin insignia no ofrece compartir', () => {
    render(<SalonDeMaquinas ejercicios={TRES_A_MEDIAS} />)
    expect(screen.queryByRole('button', { name: /compartir/i })).not.toBeInTheDocument()
  })

  it('sin ejercicios no pinta nada', () => {
    const { container } = render(<SalonDeMaquinas ejercicios={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  describe('compartir', () => {
    /**
     * Compartir es siempre un toque de la persona y abre la hoja del sistema,
     * donde ella elige destino y confirma. La app no publica por su cuenta.
     */
    it('solo comparte cuando lo tocan, y con el recuento', async () => {
      const share = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...navigator, share })
      try {
        render(<SalonDeMaquinas ejercicios={TRES_HECHOS} />)
        expect(share).not.toHaveBeenCalled()
        screen.getByRole('button', { name: /compartir/i }).click()
        expect(share).toHaveBeenCalledWith({ text: expect.stringContaining('3 de 3 máquinas') })
      } finally {
        vi.unstubAllGlobals()
      }
    })

    /** La programación es suya: viaja el recuento, no qué ejercicios hizo. */
    it('no manda el nombre de los ejercicios', () => {
      const share = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...navigator, share })
      try {
        render(<SalonDeMaquinas ejercicios={TRES_HECHOS} />)
        screen.getByRole('button', { name: /compartir/i }).click()
        expect(share.mock.calls[0][0].text).not.toMatch(/sentadilla/i)
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('el botón tiene 44px de área táctil', () => {
      render(<SalonDeMaquinas ejercicios={TRES_HECHOS} />)
      const boton = screen.getByRole('button', { name: /compartir/i })
      expect(boton.style.width).toBe('44px')
      expect(boton.style.height).toBe('44px')
    })
  })
})
