import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PanelPalancas } from './PanelPalancas'

/* Datos inventados: una medida real es el brazo de momento de la cadera de una
 * persona concreta, y aquí no van datos de asesorados. */

const MEDIDA = JSON.stringify({
  ok: true,
  negativas: ['El plano frontal no se mide con una sola cámara.'],
  escala: { mmPorPx: 1.89, dispersion: 0.55, fiable: false },
  sigmaArticulacionPx: 6.2,
  sigmaBrazoMm: 16.7,
  ejeObjetivo: 'cadera',
  grupoObjetivo: 'Isquios',
  grupoObjetivoTexto: 'los isquios',
  porFotograma: [
    { t: 0, ok: true, brazos: { cadera: { mm: 218, unLado: false, derivado: false, sigmaExtraMm: 0 } } },
    { t: 0.5, ok: true, brazos: { cadera: { mm: 190, unLado: false, derivado: false, sigmaExtraMm: 0 } } },
  ],
  medidos: 668,
  total: 721,
  descartadosPorSalto: 9,
  causas: { sin_persona: 45, sin_carga: 8, sin_consenso: 0, sin_eje: 0, salto: 4 },
  maximoEje: { mm: 218, t: 0, fraccion: 0.02 },
  origen: { video: '001', ejercicio: 'peso muerto con barra' },
})

function archivo(texto: string, nombre = 'medida.json') {
  return new File([texto], nombre, { type: 'application/json' })
}

describe('abrir una medida', () => {
  it('antes de abrir nada, no se inventa una pantalla vacía', () => {
    render(<PanelPalancas />)
    expect(screen.getByRole('button', { name: 'Abrir medida' })).toBeInTheDocument()
    expect(screen.queryByText(/Lo que no se puede prometer/)).toBeNull()
  })

  it('al abrirla, sale la pantalla de palancas con su medida', async () => {
    render(<PanelPalancas />)
    await userEvent.upload(screen.getByLabelText('Abrir medida de palancas'), archivo(MEDIDA))
    await waitFor(() => expect(screen.getByText(/Lo que no se puede prometer/)).toBeInTheDocument())
    expect(screen.getByText('218')).toBeInTheDocument()
    expect(screen.getByText(/Trabaja los isquios/)).toBeInTheDocument()
  })

  it('y una escala dudosa llega dudosa, sin corregirse por el camino', async () => {
    render(<PanelPalancas />)
    await userEvent.upload(screen.getByLabelText('Abrir medida de palancas'), archivo(MEDIDA))
    await waitFor(() => expect(screen.getByText('Dudosa')).toBeInTheDocument())
  })

  it('dice de qué vídeo salió, para poder volver a él', async () => {
    render(<PanelPalancas />)
    await userEvent.upload(screen.getByLabelText('Abrir medida de palancas'), archivo(MEDIDA))
    await waitFor(() => expect(screen.getByText(/peso muerto con barra/)).toBeInTheDocument())
  })
})

describe('un archivo que no vale', () => {
  it('falla con una frase, no con una pantalla en blanco', async () => {
    render(<PanelPalancas />)
    await userEvent.upload(
      screen.getByLabelText('Abrir medida de palancas'),
      archivo('{"esto":"no es una medida"}'),
    )
    await waitFor(() => expect(screen.getByText(/eje protagónico/)).toBeInTheDocument())
    expect(screen.queryByText(/Lo que no se puede prometer/)).toBeNull()
  })

  it('y no deja a medias la medida anterior', async () => {
    // Ver el número de una medida bajo el error de otra es peor que no ver nada.
    render(<PanelPalancas />)
    const entrada = screen.getByLabelText('Abrir medida de palancas')
    await userEvent.upload(entrada, archivo(MEDIDA))
    await waitFor(() => expect(screen.getByText('218')).toBeInTheDocument())

    await userEvent.upload(entrada, archivo('roto{'))
    await waitFor(() => expect(screen.getByText(/no es un archivo JSON/)).toBeInTheDocument())
    expect(screen.queryByText('218')).toBeNull()
  })
})
