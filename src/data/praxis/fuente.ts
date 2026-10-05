import { loQuePraxisVe, type LoQuePraxisVe } from '../../domain/praxis/plan/listaBlanca'
import type { Db } from '../repos'

/**
 * Lo que Praxis lee de la persona con sesión.
 *
 * Sale del almacén local, que la app ya hidrató con el JWT de esa persona: aquí no hay
 * ninguna consulta nueva ni ninguna clave de servicio. Todo pasa por la lista blanca del
 * dominio (`loQuePraxisVe`) ANTES de salir de esta función: la pantalla de Praxis no recibe
 * nunca el microciclo crudo, y por eso no puede enseñar un plan `propuesto` ni una nota del
 * staff aunque estén en el almacén.
 *
 * SOLO LECTURA. Este archivo no llama a ningún método que escriba en `db`.
 */
export function leerLoQuePraxisVe(db: Db, usuarioId: string, hoy: string): LoQuePraxisVe {
  return loQuePraxisVe(
    {
      usuarioId,
      microciclos: db.microciclos.byUsuario(usuarioId),
      perfil: db.perfiles.byUsuario(usuarioId),
      checkins: db.bienestar.byUsuario(usuarioId),
      planNutricional: db.nutricion.planByUsuario(usuarioId),
      visibilidad: db.visibilidad.byUsuario(usuarioId),
      adherencias: db.nutricion.adherenciasByUsuario(usuarioId),
      hidratacionHoyMl: db.nutricion.hidratacionDe(usuarioId, hoy),
    },
    hoy,
  )
}
