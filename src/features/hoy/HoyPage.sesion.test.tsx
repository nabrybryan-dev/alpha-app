/**
 * Qué sesión propone la tarjeta de Hoy.
 *
 * ROJO A PROPÓSITO (2026-08-24). Documenta el segundo fallo de
 * `docs/specs/2026-08-24-la-semana-programada-no-llega-diseno.md`: Hoy y
 * Entrenar respondían distinto a la misma pregunta. Entrenar usa
 * `sesionDestacada` —hoy, si no la siguiente por delante, si no la rezagada— y
 * Hoy usaba `sesionSugerida`, que cae en `pendientes[0]`: la primera del array,
 * que no es «la siguiente». Un lunes sin sesión, con la del martes pendiente y
 * una del miércoles colgada de antes, Hoy empujaba la vieja.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { db } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import type { Microciclo, Sesion } from '../../domain/types'
import HoyPage from './HoyPage'

/** Lunes. El día del incidente que abrió esto. */
const LUNES = new Date('2026-08-24T08:00:00')

function renderizarHoy() {
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

function activo(): Microciclo {
  const m = db.microciclos.byUsuario('u-valentina').find((x) => x.estado === 'activo')
  if (!m) throw new Error('el seed no trae microciclo activo')
  return m
}

/** Una copia de una sesión del seed, con día en el nombre y sin nada registrado. */
function sesionDelDia(base: Sesion, id: string, nombre: string, orden: number): Sesion {
  return {
    ...base,
    id,
    nombre,
    orden,
    testPost: undefined,
    preparacion: base.preparacion?.map((p) => ({ ...p, hechoEn: undefined })),
    bloquesCardio: base.bloquesCardio?.map((b) => ({ ...b, hechoEn: undefined })),
    ejercicios: base.ejercicios.map((e) => ({ ...e, series: [] })),
  }
}

/** Deja a la asesorada con estas sesiones y nada registrado. */
function conSesiones(sesiones: Sesion[]): void {
  const base = activo()
  const propuesta: Microciclo = {
    ...base,
    id: 'm-hoy-test',
    numero: base.numero + 1,
    estado: 'propuesto',
    fechaInicio: '2026-08-24',
    sesiones,
  }
  db.microciclos.guardarPropuesta(propuesta)
  db.microciclos.activarPropuesta(propuesta.id)
}

describe('HoyPage — qué sesión propone', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(LUNES)
  })

  afterEach(() => vi.useRealTimers())

  it('un lunes con sesión de lunes pendiente, propone la de hoy', async () => {
    const base = activo().sesiones
    conSesiones([
      sesionDelDia(base[0], 's-mie', 'CUÁDRICEPS (MIÉRCOLES)', 1),
      sesionDelDia(base[1], 's-lun', 'ESPALDA (LUNES)', 2),
    ])

    renderizarHoy()
    expect(await screen.findByText('ESPALDA (LUNES)')).toBeInTheDocument()
    expect(screen.getByText(/Sesión de hoy/)).toBeInTheDocument()
  })

  /** El caso que rompía: hoy no toca, y la que viene es la de mañana. */
  it('un lunes sin sesión, propone la siguiente por delante, no la colgada de antes', async () => {
    const base = activo().sesiones
    conSesiones([
      sesionDelDia(base[0], 's-mie', 'CUÁDRICEPS (MIÉRCOLES)', 1),
      sesionDelDia(base[1], 's-mar', 'ESPALDA (MARTES)', 2),
    ])

    renderizarHoy()
    expect(await screen.findByText('ESPALDA (MARTES)')).toBeInTheDocument()
    expect(screen.getByText(/Pendiente del martes/)).toBeInTheDocument()
    expect(screen.queryByText('CUÁDRICEPS (MIÉRCOLES)')).not.toBeInTheDocument()
  })

  /** Si de verdad no queda nada por delante, se rescata la que quedó atrás. */
  it('sin nada por delante, rescata la que quedó atrás', async () => {
    const base = activo().sesiones
    conSesiones([sesionDelDia(base[0], 's-dom', 'CUÁDRICEPS (DOMINGO)', 1)])

    renderizarHoy()
    expect(await screen.findByText('CUÁDRICEPS (DOMINGO)')).toBeInTheDocument()
    expect(screen.getByText(/Pendiente del domingo/)).toBeInTheDocument()
  })
})
