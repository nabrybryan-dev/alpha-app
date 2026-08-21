import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import EncoderPage from './EncoderPage'
import type { Medicion } from './tanda'

/* La pantalla se monta sin cámara: `getUserMedia` no existe en jsdom y no se
 * llama hasta que alguien pulsa «Abrir cámara». Lo que se prueba aquí es lo que
 * decide si la herramienta se puede creer: que el aviso de provisionalidad esté
 * y no se pueda quitar, y que los criterios se lean de la tanda guardada. */

const CLAVE = 'alpha-encoder-fase2'

function serie(p: Partial<Medicion> = {}): Medicion {
  return {
    fecha: '2026-08-21T10:00:00Z',
    modo: 'serie',
    ejercicio: 'sentadilla',
    repsReales: 5,
    repsDetectadas: 5,
    vPrimera: 1,
    vUltima: 0.7,
    pvPct: 30,
    calidad: 'buena',
    motivos: '',
    nota: '',
    ...p,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('EncoderPage', () => {
  it('avisa de que los numeros son provisionales, y sin boton de cerrar', () => {
    render(<EncoderPage />)
    const aviso = screen.getByText(/Números provisionales/i)
    expect(aviso).toBeInTheDocument()
    // Si algun dia alguien le pone una X, este test se pone rojo a proposito:
    // el aviso deja de verse justo cuando mas falta hace, que es despues de la
    // primera vez que lo lees.
    const caja = aviso.closest('div')!
    expect(caja.querySelector('button')).toBeNull()
  })

  it('sin tanda, los criterios se quedan sin contestar en vez de salir en verde', () => {
    render(<EncoderPage />)
    expect(screen.getByText('Error de %PV vs referencia')).toBeInTheDocument()
    // Ocho criterios, todos con «--»: un criterio sin datos que se pintara
    // verde diria que la puerta esta pasada cuando no se ha medido nada.
    expect(screen.getAllByText('--')).toHaveLength(8)
  })

  it('lee la tanda guardada al abrir, que es lo que sobrevive a cerrar la app', () => {
    localStorage.setItem(CLAVE, JSON.stringify([serie(), serie()]))
    render(<EncoderPage />)
    expect(screen.getByText('2 en la tanda')).toBeInTheDocument()
    expect(screen.getByText('2 de 2')).toBeInTheDocument()
  })

  it('no deja guardar sin medicion: no hay fila que guardar', () => {
    render(<EncoderPage />)
    expect(screen.getByRole('button', { name: /Guardar medición/i })).toBeDisabled()
  })

  it('la g del sitio no es 9,81', async () => {
    render(<EncoderPage />)
    await userEvent.click(screen.getByText('Ajustes de la toma'))
    // 9,81 es un promedio; a 1.480 m y 4,5 grados el valor real ronda 9,775, y
    // compararse contra el promedio gasta un 0,35 % del presupuesto de error
    // con el signo siempre en la misma direccion.
    expect(screen.getByText(/9\.77\d\d m\/s²/)).toBeInTheDocument()
  })

  it('exportar y vaciar estan apagados con la tanda vacia', () => {
    render(<EncoderPage />)
    expect(screen.getByRole('button', { name: /Exportar CSV/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Vaciar tanda/i })).toBeDisabled()
  })
})
