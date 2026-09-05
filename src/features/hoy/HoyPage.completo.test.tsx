/**
 * «Microciclo completo» solo cuando de verdad está completo.
 *
 * ROJO A PROPÓSITO (2026-08-30). Visto en producción con un perfil de prueba:
 * la app le decía «Microciclo completo 💪 · Registraste todas las sesiones» a un
 * plan recién cargado, con cero series y todos los ejercicios sin tocar.
 *
 * El mecanismo: desde el PR #101 `armarSemana` acota por abajo con `fechaInicio`
 * —no reparte ningún día anterior al arranque—, así que un microciclo que empieza
 * la semana que viene deja los siete días en blanco y `sesionDestacada` devuelve
 * `undefined`. La condición del cartel era `microciclo && !siguienteSesion`: no
 * miraba ni una serie registrada. «No tengo nada que ofrecerte todavía» y «ya lo
 * hiciste todo» salían por la misma rama.
 *
 * No es un artefacto del perfil de prueba: `GenerarMicrocicloSheet` ofrece
 * «arranca la próxima semana» como opción normal del coach.
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

/** Lunes 24. La semana natural que se pinta va del 24 al 30. */
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

/** Copia de una sesión del seed, con día en el nombre y sin NADA registrado. */
function sesionSinTocar(base: Sesion, id: string, nombre: string, orden: number): Sesion {
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

/** Activa un microciclo con estas sesiones y esta fecha de arranque. */
function conPlan(fechaInicio: string, sesiones: Sesion[]): void {
  const base = activo()
  const propuesta: Microciclo = {
    ...base,
    id: 'm-completo-test',
    numero: base.numero + 1,
    estado: 'propuesto',
    fechaInicio,
    sesiones,
  }
  db.microciclos.guardarPropuesta(propuesta)
  db.microciclos.activarPropuesta(propuesta.id)
}

describe('HoyPage — el cartel de microciclo completo', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(LUNES)
  })

  afterEach(() => vi.useRealTimers())

  it('NO dice «Microciclo completo» a un plan que todavía no ha empezado', () => {
    const base = activo().sesiones[0]
    // Arranca el lunes 31: la semana en curso (24→30) queda entera por delante
    // del arranque, así que `armarSemana` no reparte ni un día.
    conPlan('2026-08-31', [
      sesionSinTocar(base, 's-lunes', 'FULL BODY A (LUNES)', 1),
      sesionSinTocar(base, 's-miercoles', 'FULL BODY B (MIÉRCOLES)', 2),
    ])

    renderizarHoy()

    expect(screen.queryByText(/Microciclo completo/i)).toBeNull()
    expect(screen.queryByText(/Registraste todas las sesiones/i)).toBeNull()
  })

  it('dice cuándo empieza, en vez de callarse', () => {
    const base = activo().sesiones[0]
    conPlan('2026-08-31', [sesionSinTocar(base, 's-lunes', 'FULL BODY A (LUNES)', 1)])

    renderizarHoy()

    expect(screen.getByText(/empieza el/i)).toBeTruthy()
  })

  it('sigue diciéndolo cuando el microciclo SÍ está completo', () => {
    const base = activo().sesiones[0]
    // Arranca el mismo lunes y su única sesión queda registrada: aquí el cartel
    // es verdadero y tiene que seguir saliendo.
    const hecha: Sesion = {
      ...sesionSinTocar(base, 's-lunes', 'FULL BODY A (LUNES)', 1),
      ejercicios: base.ejercicios.map((e) => ({
        ...e,
        series: Array.from({ length: e.sets }, (_, i) => ({ orden: i + 1, cargaKg: 20, reps: 10, rir: 2 })),
      })),
    }
    conPlan('2026-08-24', [hecha])

    renderizarHoy()

    expect(screen.getByText(/Microciclo completo/i)).toBeTruthy()
  })
})
