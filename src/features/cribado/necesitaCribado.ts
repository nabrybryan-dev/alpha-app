import type { Db } from '../../data/repos'
import type { Usuario } from '../../domain/types'

/**
 * Si a esta persona hay que pedirle el cribado de salud.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SE LEE DE LOCAL, SIEMPRE. NO SE ESPERA AL SERVIDOR.
 * ────────────────────────────────────────────────────────────────────────────
 * La persona abre la app en el gimnasio, con la conexión que haya. Si esta
 * pregunta dependiera de que la hidratación termine, en modo avión diría «falta»
 * sobre una fila que está arriba desde hace una semana, y le pediría otra vez un
 * cuestionario clínico de doce preguntas antes de dejarla entrenar.
 *
 * `db` ya resuelve eso: la app lee del almacén local y la capa de sincronización
 * lo sube y lo baja por detrás. Aquí solo hay que no estropearlo — nada de
 * `await`, nada de mirar si hubo red.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SOLO A LOS ASESORADOS
 * ────────────────────────────────────────────────────────────────────────────
 * `HoyPage` la abren también el coach y la nutricionista. Un PAR-Q en la pantalla
 * del staff no es un adorno molesto: es una pantalla pidiendo datos clínicos a
 * quien no los tiene que dar, y —si alguna vez los diera— una fila de salud de
 * alguien que no es asesorado.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LO QUE ESTA FUNCIÓN NO DECIDE
 * ────────────────────────────────────────────────────────────────────────────
 * No decide si un cribado sin contestar **impide entrenar**. Esa regla no está
 * escrita —es del coach, no del código— y las dos opciones son defendibles:
 * bloquear la pantalla del día, o solo bloquear que se le cargue el siguiente
 * microciclo. Mientras no esté escrita, esto devuelve un booleano y quien lo use
 * decide cuánto peso le da; hoy `HoyPage` lo usa para poner una tarjeta arriba
 * del todo, no para cerrar la puerta.
 *
 * Riesgo 6 de `docs/riesgos/RIESGOS-preguntas-y-cribado.md`.
 */
export function necesitaCribado(db: Db, usuario: Usuario): boolean {
  if (usuario.rol !== 'asesorado') return false
  return db.cribado.byUsuario(usuario.id) === undefined
}
