/**
 * Qué decide que se vean los ejercicios de una sesión.
 *
 * ROJO A PROPÓSITO contra el código anterior al 2026-08-25. Lo decidía la
 * ETIQUETA `tipo`: la sección entera colgaba de `tipo !== 'metabolica'`, así que
 * una sesión marcada `metabolica` con ejercicios dentro no los pintaba **ni
 * dejaba registrarlos**. No era hipotético — el barrido de ese día encontró dos
 * en producción, con 7 y 6 ejercicios prescritos que nadie podía ver.
 *
 * Y la inversa: la Zona 2 de una asesorada venía marcada `fuerza` con cero
 * ejercicios, y se llevaba la cabecera «Ejercicio 1 de 0» sobre un salón, una
 * barra y una lista vacíos.
 *
 * Ahora lo decide **haber ejercicios**. `tipo` sigue eligiendo el fondo y el
 * panel de ritmo, que es lo que de verdad describe, pero ya no esconde nada.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { db } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import type { Microciclo, Sesion } from '../../domain/types'
import SesionPage from './SesionPage'

function activo(): Microciclo {
  const m = db.microciclos.byUsuario('u-valentina').find((x) => x.estado === 'activo')
  if (!m) throw new Error('el seed no trae microciclo activo')
  return m
}

/** Deja a la asesorada con UNA sesión, sin nada registrado, y la abre. */
function abrir(sesion: Sesion) {
  const base = activo()
  const propuesta: Microciclo = {
    ...base,
    id: 'm-visibles-test',
    numero: base.numero + 1,
    estado: 'propuesto',
    fechaInicio: '2026-08-25',
    sesiones: [sesion],
  }
  db.microciclos.guardarPropuesta(propuesta)
  db.microciclos.activarPropuesta(propuesta.id)

  return render(
    <ThemeProvider>
      <SessionProvider>
        <MemoryRouter initialEntries={[`/entrenar/sesion/${sesion.id}`]}>
          <Routes>
            <Route path="/entrenar/sesion/:sesionId" element={<SesionPage />} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>
    </ThemeProvider>,
  )
}

/** Una sesión del seed, limpia de ejecución, con el tipo y los ejercicios que se pidan. */
function sesion(id: string, tipo: Sesion['tipo'], conEjercicios: boolean): Sesion {
  const base = activo().sesiones.find((s) => s.ejercicios.length > 0)
  if (!base) throw new Error('el seed no trae sesión con ejercicios')
  return {
    ...base,
    id,
    orden: 1,
    tipo,
    testPost: undefined,
    preparacion: base.preparacion?.map((p) => ({ ...p, hechoEn: undefined })),
    bloquesCardio: base.bloquesCardio?.map((b) => ({ ...b, hechoEn: undefined })),
    ejercicios: conEjercicios ? base.ejercicios.map((e) => ({ ...e, series: [] })) : [],
  }
}

describe('SesionPage — los ejercicios se ven si los hay, no según la etiqueta', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
  })

  it('una sesión marcada `metabolica` CON ejercicios los muestra — el caso que estaba roto', () => {
    const s = sesion('s-metabolica-con-ejercicios', 'metabolica', true)
    abrir(s)
    // `getAllByText`: la cuenta sale en la cabecera y también dentro de la
    // tarjeta del ejercicio. Lo que se comprueba es que APAREZCA, no cuántas veces.
    expect(screen.getAllByText(/Ejercicio 1 de \d+/i).length).toBeGreaterThan(0)
  })

  it('una sesión de fuerza SIN ejercicios no pinta la cabecera vacía', () => {
    abrir(sesion('s-fuerza-sin-ejercicios', 'fuerza', false))
    expect(screen.queryByText(/Ejercicio 1 de/i)).not.toBeInTheDocument()
    // Y en particular, nunca el «1 de 0» que veía la asesorada.
    expect(screen.queryByText(/Ejercicio 1 de 0/i)).not.toBeInTheDocument()
  })

  it('una sesión de fuerza CON ejercicios sigue funcionando igual', () => {
    abrir(sesion('s-fuerza-normal', 'fuerza', true))
    // `getAllByText`: la cuenta sale en la cabecera y también dentro de la
    // tarjeta del ejercicio. Lo que se comprueba es que APAREZCA, no cuántas veces.
    expect(screen.getAllByText(/Ejercicio 1 de \d+/i).length).toBeGreaterThan(0)
  })

  it('una sesión metabólica SIN ejercicios sigue sin pintar la sección', () => {
    abrir(sesion('s-metabolica-vacia', 'metabolica', false))
    expect(screen.queryByText(/Ejercicio 1 de/i)).not.toBeInTheDocument()
  })
})
