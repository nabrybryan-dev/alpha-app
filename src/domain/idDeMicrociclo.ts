import type { Microciclo } from './types'

/**
 * EL ID DE UN MICROCICLO NUEVO: `m-<slug>-<numero>`.
 *
 * Decisión de Bryan del 2026-09-15 («regla nueva + orden por fecha»):
 *
 *   · no se renombra ningún id que ya exista;
 *   · los nuevos dicen de quién son y cuál son, y nada más — ni `-prop`, ni `-mN`,
 *     ni la historia de por dónde pasó la propuesta;
 *   · el slug es UNO POR PERSONA y lo guarda la base (`usuarios_app.slug`, migración
 *     0081). Aquí no se deriva del nombre: derivarlo en cada sitio es justo lo que
 *     le cambió el prefijo a tres personas de una semana a otra.
 *
 * La base lo exige con un trigger BEFORE INSERT. Esta función es la mitad de la app.
 *
 * SIN SLUG SE QUEDA EL ID DE SIEMPRE. La app se despliega ANTES de aplicar la
 * migración: mientras la columna no exista nadie tiene slug, y la app tiene que seguir
 * generando propuestas como hasta ahora. Con la migración aplicada, todo el mundo lo
 * tiene (la migración aborta si no puede dárselo a alguien).
 */

/** Lo que la base admite en `usuarios_app.slug` (el `check` de la 0081). */
const FORMA_DEL_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

export interface DatosDelIdNuevo {
  /** `usuarios_app.slug` de la persona, tal como llega de la base. */
  slug: string | undefined
  /** El `numero` del microciclo que se va a crear. */
  numero: number
  /** El id del microciclo del que se parte. Solo se usa sin slug. */
  origenId: string
  /** Los microciclos de la persona que la app ya conoce. */
  existentes: readonly Microciclo[]
}

export function idDeMicrocicloNuevo({ slug, numero, origenId, existentes }: DatosDelIdNuevo): string {
  const limpio = slug?.trim()
  if (!limpio) return `${origenId}-prop${numero}`

  // Un slug a medias no se arregla aquí: la base lo rechazaría igual, y desde un
  // teléfono ese rechazo acaba en la cola de descartes sin que nadie lo vea.
  if (!FORMA_DEL_SLUG.test(limpio)) {
    throw new Error(
      `El slug «${slug}» no tiene la forma que exige la base (minúsculas, números y guiones): ` +
        'no se puede construir el id del microciclo.',
    )
  }

  const id = `m-${limpio}-${numero}`

  // LA NUMERACIÓN SE REINICIA AL CAMBIAR DE BLOQUE. El M9 del bloque nuevo tendría el
  // mismo id que el M9 del viejo, y la subida es un upsert por id: la propuesta se
  // escribiría encima de una semana ya entrenada, sin error. Una propuesta guardada
  // del mismo número sí se reemplaza: es lo que hace «Generar» dos veces.
  const ocupado = existentes.find((m) => m.id === id && m.estado !== 'propuesto')
  if (ocupado) {
    throw new Error(
      `Ya existe el microciclo ${id} (M${ocupado.numero}, ${ocupado.estado}). ` +
        'La numeración de esta persona se reinició y guardar la propuesta lo sobrescribiría: ' +
        'hay que decidir el número antes de generar.',
    )
  }
  return id
}
