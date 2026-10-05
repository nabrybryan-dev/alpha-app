import { describe, expect, it } from 'vitest'
import { S, cancelar, renovarSesion } from './sesion'

/**
 * El turno vigente (`S.tok`) es lo que apaga un bucle viejo: cada `await` del motor acaba en
 * un `vigilar(tok)`. Si dos sesiones pudieran tener el mismo número, el bucle de una
 * seguiría vivo en la pantalla de la otra.
 *
 * Pasó: con el contador empezando en 0 en cada sesión, la conversación de un montaje
 * anterior siguió corriendo sobre el siguiente y dejó una «pregunta en espera» por la
 * conexión de otra persona.
 */
describe('el turno vigente no se repite entre sesiones', () => {
  it('un turno de la sesión anterior nunca coincide con uno de la nueva', () => {
    cancelar()
    const viejo = S.tok
    renovarSesion()
    cancelar()
    expect(S.tok).not.toBe(viejo)
  })

  it('cancelar siempre cambia el turno', () => {
    const antes = S.tok
    cancelar()
    expect(S.tok).not.toBe(antes)
  })

  it('diez sesiones seguidas: diez turnos distintos', () => {
    const vistos = new Set<number>()
    for (let i = 0; i < 10; i++) { renovarSesion(); cancelar(); vistos.add(S.tok) }
    expect(vistos.size).toBe(10)
  })
})
