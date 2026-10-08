/**
 * A023 (devolución de la auditoría al PR #308): `microcicloVigente` puede devolver
 * un único microciclo activo que NO cubre hoy —futuro o vencido, ver su comentario
 * en `domain/rutaEntrenamiento.ts`—. Eso, por sí solo, no resuelve el incidente
 * («la persona ve una semana que no le toca»): hace falta que LA PANTALLA lo diga.
 *
 * Este archivo es esa evidencia para Hoy: los dos carteles ya existían en el JSX
 * (`HoyPage.tsx`, el de «empieza el…» desde el 11-sep y el de «terminó el…» añadido
 * ahora mismo para A023), pero ninguno tenía un test de pantalla que lo demostrara.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { db } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import type { Microciclo } from '../../domain/types'
import HoyPage from './HoyPage'

/** Jueves de control, sin relación con ningún microciclo real del seed. */
const HOY = new Date('2026-09-10T08:00:00')

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

/**
 * DEja a la asesorada con UN ÚNICO microciclo activo, con las fechas que pida el
 * test. Pasa por `guardarPropuesta` + `activarPropuesta` a propósito: es el mismo
 * camino que usa la app de verdad (cierra el anterior, deja exactamente uno).
 */
function conUnSoloMicrociclo(cambios: Partial<Microciclo>): void {
  const base = activo()
  const propuesta: Microciclo = {
    ...base,
    id: 'm-aviso-test',
    numero: base.numero + 1,
    estado: 'propuesto',
    ...cambios,
  }
  db.microciclos.guardarPropuesta(propuesta)
  db.microciclos.activarPropuesta(propuesta.id)
}

describe('HoyPage — el aviso cuando el único microciclo no cubre hoy (A023)', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(HOY)
  })

  afterEach(() => vi.useRealTimers())

  it('un único microciclo FUTURO: se ve el cartel «tu microciclo empieza el…»', async () => {
    // Arranca el lunes que viene (14-sep); hoy es jueves 10-sep.
    conUnSoloMicrociclo({ fechaInicio: '2026-09-14', cadenciaDias: 7 })

    renderizarHoy()

    expect(await screen.findByText(/Tu microciclo empieza el 2026-09-14/)).toBeInTheDocument()
    // Y NO dice «terminó»: son avisos mutuamente excluyentes para el mismo microciclo.
    expect(screen.queryByText(/terminó el/)).not.toBeInTheDocument()
  })

  it('un único microciclo VENCIDO: se ve el cartel «terminó el…»', async () => {
    // Cadencia 7 desde el 10-ago cubre hasta el 16-ago; hoy es 10-sep, muy vencido.
    conUnSoloMicrociclo({ fechaInicio: '2026-08-10', cadenciaDias: 7 })

    renderizarHoy()

    expect(await screen.findByText(/terminó el 2026-08-16/)).toBeInTheDocument()
    expect(screen.getByText(/Tu coach está preparando el siguiente/)).toBeInTheDocument()
    // Y NO dice «empieza»: no está adelantado, está vencido — son cosas distintas.
    expect(screen.queryByText(/Tu microciclo empieza el/)).not.toBeInTheDocument()
  })

  it('control: un único microciclo que SÍ cubre hoy, no enseña ninguno de los dos carteles', async () => {
    conUnSoloMicrociclo({ fechaInicio: '2026-09-07', cadenciaDias: 7 }) // cubre 07..13-sep

    renderizarHoy()

    // Se espera a que la pantalla termine de montar (el saludo siempre sale)
    // antes de afirmar que los dos avisos NO están.
    expect(await screen.findByText(/Hola,/)).toBeInTheDocument()
    expect(screen.queryByText(/Tu microciclo empieza el/)).not.toBeInTheDocument()
    expect(screen.queryByText(/terminó el/)).not.toBeInTheDocument()
  })
})
