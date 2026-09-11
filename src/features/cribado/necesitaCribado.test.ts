/**
 * A quién le tiene que salir la pantalla de salud.
 *
 * MEDIDO EN PRODUCCIÓN el 2026-09-11, y por eso existe este archivo: de 26 asesorados,
 * **8 ya tienen ficha de cribado** (volcada del wiki por el coach) y **25 no han dicho
 * qué días pueden entrenar**. Con la regla vieja —«hace falta la pantalla solo si no hay
 * ninguna ficha»— a esos 8 **no les sale nada**: ven una línea de texto pequeña que dice
 * «¿Ha cambiado algo en tu salud? Cuéntanoslo» y tienen que darse cuenta y tocarla.
 *
 * Eso rompe dos cosas a la vez:
 *
 *  1. **El mensaje que se les manda miente.** Dice «al abrir la app te va a aparecer una
 *     pantalla»; a 7 de ellos no les aparece. Una de las 8 (la única con días el día de
 *     la medida) los dio precisamente por esa puerta discreta, lo que demuestra que
 *     funciona — y también que depende de que la persona la vea.
 *  2. **La cadena se sigue parando.** Los días son el dato que I-38 impide inventar: sin
 *     ellos el ① se detiene y hay que pagar una corrida por persona. La pantalla existe
 *     justo para no pagarlas.
 *
 * La ficha del wiki, además, NO es el dato completo: la mejor de las 8 tiene 7 de los 9
 * campos, y ninguna la dijo la persona con sus palabras. Volver a preguntar no es
 * molestar por gusto: sube la fuente de `wiki` a `app` y desde la 0062 la respuesta se
 * guarda al lado de la del coach, con su fecha, sin borrar nada.
 */
import { describe, expect, it } from 'vitest'
import type { Db } from '../../data/repos'
import type { DiaSemana } from '../../domain/calendario'
import type { Cribado, Perfil, Usuario } from '../../domain/types'
import { necesitaPantallaDeSalud } from './necesitaCribado'

const asesorado = { id: 'u1', nombre: 'Valentina Cruz', rol: 'asesorado' } as Usuario
const coach = { id: 'c1', nombre: 'Coach', rol: 'coach' } as Usuario

function db(opciones: { cribado?: boolean; dias?: DiaSemana[] }): Db {
  return {
    cribado: {
      byUsuario: () => (opciones.cribado ? ({ usuarioId: 'u1' } as unknown as Cribado) : undefined),
    },
    perfiles: {
      byUsuario: () =>
        ({ usuarioId: 'u1', diasDisponibles: opciones.dias } as unknown as Perfil),
    },
  } as unknown as Db
}

describe('a quién le sale la pantalla de salud', () => {
  it('a quien no tiene ficha ninguna, como siempre', () => {
    expect(necesitaPantallaDeSalud(db({}), asesorado)).toBe(true)
  })

  it('a quien SÍ tiene ficha pero nunca dijo sus días — los 8 del volcado del wiki', () => {
    expect(necesitaPantallaDeSalud(db({ cribado: true }), asesorado)).toBe(true)
  })

  it('a quien ya tiene las dos cosas, no: se le deja en paz', () => {
    expect(necesitaPantallaDeSalud(db({ cribado: true, dias: ['MARTES'] }), asesorado)).toBe(false)
  })

  it('unos días vacíos no cuentan como dichos', () => {
    // `[]` es lo que deja un guardado a medias o un borrado; no es «no puedo ningún día»
    // —eso no existe— así que hay que volver a preguntar.
    expect(necesitaPantallaDeSalud(db({ cribado: true, dias: [] }), asesorado)).toBe(true)
  })

  it('al staff nunca, ni sin ficha ni sin días', () => {
    // Un PAR-Q en la pantalla del coach no es un adorno molesto: es pedirle datos
    // clínicos a quien no los tiene que dar, y crearía una fila de salud de alguien
    // que no es asesorado.
    expect(necesitaPantallaDeSalud(db({}), coach)).toBe(false)
    expect(necesitaPantallaDeSalud(db({ cribado: true }), coach)).toBe(false)
  })

  it('aguanta que el perfil todavía no haya bajado', () => {
    const sinPerfil = {
      cribado: { byUsuario: () => ({ usuarioId: 'u1' }) as unknown as Cribado },
      perfiles: { byUsuario: () => undefined },
    } as unknown as Db
    // Sin perfil no se sabe si dijo sus días. Se pregunta: equivocarse aquí de más
    // cuesta una pantalla que se cierra, y de menos cuesta una corrida parada.
    expect(necesitaPantallaDeSalud(sinPerfil, asesorado)).toBe(true)
  })
})
