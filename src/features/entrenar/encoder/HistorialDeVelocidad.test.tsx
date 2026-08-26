import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HistorialDeVelocidad } from './HistorialDeVelocidad'
import { db } from '../../../data/dbInstance'

/* Aquí se prueba SOLO lo que depende de la integración con la base: que la
 * sección no aparezca mientras nadie haya grabado. Lo demás —qué entra en la
 * tendencia, cómo se derivan las fechas, que el aviso de hora no se invente— vive
 * en `historial.test.ts` y `historialDeMicrociclos.test.ts`, donde se prueba con
 * datos explícitos en vez de amasando el seed.
 *
 * No se escriben microciclos de prueba a propósito: `microciclos.guardar()` entra
 * siempre con `estado: 'propuesto'`, así que un test que guardara para leer
 * después estaría probando contra un estado que la pantalla real nunca ve. */

describe('cuando nadie ha grabado', () => {
  it('no pinta absolutamente nada, ni un hueco', () => {
    // Una tarjeta vacía en una pantalla que se abre cada semana es ruido
    // permanente: ocupa sitio, enseña un agujero y desde aquí no se puede hacer
    // nada al respecto. El seed no trae mediciones, que es el estado de hoy.
    const usuario = db.usuarios.list()[0]
    const { container } = render(<HistorialDeVelocidad usuarioId={usuario.id} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('y tampoco con un usuario que no existe', () => {
    const { container } = render(<HistorialDeVelocidad usuarioId="no-existe" />)
    expect(container).toBeEmptyDOMElement()
  })
})
