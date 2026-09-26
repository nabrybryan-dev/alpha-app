import { useSesionOpcional } from '../../../app/SessionProvider'
import { corridasDeTodaLaCartera, type CadenaCorrida } from '../../../data/consola/cadenaCorridas'
import { planVigente, type PlanEstrategico } from '../../../data/consola/planesEstrategicos'
import { db, hoyIso, useDbVersion } from '../../../data/dbInstance'
import type { Microciclo, Rol } from '../../../domain/types'
import { useDatoConsola, type EstadoDato } from './datoConsola'

/**
 * Todo lo que la consola sabe de UNA persona, de un solo sitio.
 *
 * Lo síncrono sale del almacén local (`db`, lo que ya bajó la hidratación del staff); lo
 * asíncrono —historial completo de microciclos, plan estratégico vigente, corridas de la
 * cadena— pasa por `useDatoConsola`, que lo comparte entre la cabecera y las pestañas.
 *
 * `rolQueMira` existe por la RLS: `perfiles` y `cribado` solo los lee el COACH
 * (`perfiles_leer`, `cribado_lee_lo_suyo`); el staff con capacidad `leer_entrenamiento`
 * (Manuela) no los recibe. Así la pantalla puede decir «tu permiso no alcanza» en vez de
 * «esta persona no tiene ficha», que sería falso.
 */
export function usePersona(usuarioId: string) {
  useDbVersion()
  const sesion = useSesionOpcional()
  const rolQueMira: Rol | undefined = sesion?.usuario.rol

  const usuario = db.usuarios.byId(usuarioId)
  const perfil = db.perfiles.byUsuario(usuarioId)
  const perfilNutricion = db.perfilNutricion.byUsuario(usuarioId)
  const cribado = db.cribado.byUsuario(usuarioId)
  const checkins = db.bienestar.byUsuario(usuarioId)
  const adherencias = db.nutricion.adherenciasByUsuario(usuarioId)
  const planNutricional = db.nutricion.planByUsuario(usuarioId)
  const locales = db.microciclos.byUsuario(usuarioId)
  const activo = locales.find((m) => m.estado === 'activo')

  const historial: EstadoDato<Microciclo[]> = useDatoConsola(`historial:${usuarioId}`, () =>
    // La hidratación del staff no baja los cerrados ajenos (son el 78 % del peso): el
    // historial se pide a demanda. Si falla, lo local es mejor que nada.
    db.microciclos.historialDe(usuarioId).catch(() => db.microciclos.byUsuario(usuarioId)),
  )
  const plan: EstadoDato<PlanEstrategico | null> = useDatoConsola(`plan:${usuarioId}`, () => planVigente(usuarioId))
  const corridas: EstadoDato<CadenaCorrida[]> = useDatoConsola('corridas', corridasDeTodaLaCartera)

  return {
    hoy: hoyIso(),
    rolQueMira,
    /** true si quien mira no es coach: `perfiles` y `cribado` ajenos no le llegan por RLS. */
    lecturaRecortada: rolQueMira !== undefined && rolQueMira !== 'coach',
    usuario,
    perfil,
    perfilNutricion,
    cribado,
    checkins,
    adherencias,
    planNutricional,
    activo,
    historial,
    plan,
    corridas,
  }
}

export type DatosPersona = ReturnType<typeof usePersona>
