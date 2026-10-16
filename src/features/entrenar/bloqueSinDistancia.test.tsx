import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { BloqueCardio } from '../../domain/types'
import { BloquesSesion } from './BloquesSesion'

/**
 * UN BLOQUE DE CORE O DE FUERZA NO PIDE DISTANCIA (Bryan, 16-oct-2026: a Karin «se le cargó
 * un ejercicio de abdomen donde le pidió distancia, un error muy grande»).
 *
 * La sesión compartida del jueves (Karin, Dhanny, Lina) va entera en bloques: explosividad,
 * fuerza en cadena cruzada, cardio y estabilidad de core. Al marcar cualquiera salían
 * duración, distancia y FC media, como si la plancha fuera una carrera. Ahora la distancia y
 * la FC solo salen en un bloque que sí es de desplazamiento; el resto pide la duración.
 */

const marcado = (titulo: string): BloqueCardio => ({
  id: titulo,
  titulo,
  indicaciones: '',
  duracionMin: 20,
  hechoEn: '2026-10-15T20:00:00.000Z',
})

function pinta(bloque: BloqueCardio) {
  render(<BloquesSesion bloques={[bloque]} esMetabolica onMarcar={() => {}} onRegistrar={() => {}} />)
}

describe('BloquesSesion · qué se anota según el bloque', () => {
  it.each(['4. Estabilidad de core', '2. Transferencia de fuerza en cadena cruzada', '1. Explosividad', 'Abdomen', 'Movilidad de cadera', 'COPENHAGEN PLANK — 3×30 seg', 'Stretching pasivo'])(
    '«%s» pide la duración y no la distancia ni la FC',
    (titulo) => {
      pinta(marcado(titulo))
      expect(screen.getByLabelText(new RegExp(`Duración real de ${titulo}`))).toBeInTheDocument()
      expect(screen.queryByLabelText(/Distancia de/)).toBeNull()
      expect(screen.queryByLabelText(/Frecuencia cardíaca media/)).toBeNull()
    },
  )

  it.each([
    '3. Cardio',
    'Z2 larga',
    'Trote suave',
    // Títulos mixtos reales de la base: nombran un medio de cardio, y ese manda.
    'Calentamiento 10 min: bici + activación de glúteo',
    'CAMINATA 30 MIN + FOAM ROLLER + MOVILIDAD — 1×30 min + circuito',
    'MOVILIDAD DINÁMICA + CARDIO SUAVE — 1×10 min',
  ])('«%s» sigue pidiendo duración, distancia y FC', (titulo) => {
    pinta(marcado(titulo))
    expect(screen.getByLabelText(/Distancia de/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Frecuencia cardíaca media/)).toBeInTheDocument()
  })
})
