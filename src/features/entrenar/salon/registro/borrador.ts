import { rirDeTabla } from '../../../../domain/objetivoDeIntensidad'
import { seriePrescrita } from '../../../../domain/ondulacion'
import { cargaSugerida } from '../../../../domain/prescripcion'
import type { EjercicioPrescrito, VelocidadDeSerie } from '../../../../domain/types'
import { escribirJSON, leerJSON } from '../../../../lib/persistencia'

/**
 * EL BORRADOR DE LA SERIE EN CURSO: una clave, un origen, y nadie más que los escriba.
 *
 * Lo que se lleva escrito de la serie —carga, repeticiones y RIR antes de guardar— lo
 * necesitan ahora tres sitios del salón: el registro del suelo, que es quien lo teclea; la
 * barra colapsada, que lo resume sin abrir nada; y el módulo de la cámara, que se lo pasa
 * a la hoja de medición para que la toma quede etiquetada con lo que de verdad se estaba
 * levantando.
 *
 * Antes la clave y los valores de partida vivían dentro del registro. Tres sitios leyendo
 * la misma clave, cada uno con su plantilla escrita a mano, es la forma más silenciosa de
 * que se separen: basta con que alguien cambie el orden de los guiones en uno de ellos
 * para que el borrador se guarde en un sitio y se lea de otro, sin que nada se ponga rojo
 * — el campo simplemente aparece vacío.
 *
 * La clave es la misma que ya se usaba, letra por letra: un borrador empezado en la
 * pantalla de sesión sigue apareciendo a medio llenar en el salón y al revés.
 */

/** Lo que se lleva escrito de una serie antes de guardarla. */
export interface BorradorDeSerie {
  cargaKg: number
  reps: number
  rir: number
  /**
   * La medición del encoder de ESTA serie, si se grabó antes de guardarla.
   *
   * Vive en el borrador porque la cámara se usa ANTES de anotar la serie: la hoja de
   * medición cierra, la persona se sienta, y guarda cuando guarda. El borrador es lo único
   * que sobrevive a ese hueco, y es lo que `guardar()` lee para que la serie registrada
   * viaje con su medida.
   */
  velocidad?: VelocidadDeSerie
}

/** Cuando no hay nada de dónde deducir la carga, el borrador arranca aquí. */
export const CARGA_POR_DEFECTO_KG = 20

/** Dónde se guarda el borrador de una serie concreta. */
export function claveDeBorrador(microcicloId: string, ejercicioId: string, orden: number): string {
  return `alpha-serie-${microcicloId}-${ejercicioId}-${orden}`
}

/**
 * Los valores con los que arranca una serie que aún no se ha tocado.
 *
 * Salen del dominio y de ningún otro sitio: `seriePrescrita()` sabe de la ondulación del
 * microciclo, `cargaSugerida()` de la progresión y `rirDeTabla()` de que **`FALLO` no es
 * `RIR 0`** —con el objetivo en fallo el mando arranca en 0, porque la parte contada de una
 * serie al fallo termina en la última repetición completa—.
 */
export function borradorDePartida(ejercicio: EjercicioPrescrito, orden: number): BorradorDeSerie {
  const prescrita = seriePrescrita(ejercicio, orden)
  return {
    cargaKg: cargaSugerida(ejercicio, prescrita) ?? CARGA_POR_DEFECTO_KG,
    reps: prescrita?.reps ?? ejercicio.repsDiana,
    rir: prescrita?.rir ?? rirDeTabla(ejercicio.rirObjetivo),
  }
}

/** El borrador guardado de una serie, o el de partida si aún no se ha tocado. */
export function leerBorrador(
  microcicloId: string,
  ejercicio: EjercicioPrescrito,
  orden: number,
): BorradorDeSerie {
  return leerJSON<BorradorDeSerie>(
    claveDeBorrador(microcicloId, ejercicio.id, orden),
    borradorDePartida(ejercicio, orden),
  )
}

/**
 * ANOTAR LA MEDIDA EN EL BORRADOR de una serie que todavía no se ha guardado.
 *
 * Lee lo que haya, le suma la medición y lo vuelve a escribir en la MISMA clave que usa el
 * registro: cuando `guardar()` la lea, la serie sale con su `velocidad`. Se escribe aquí y
 * no en el estado del registro porque la cámara y el registro son componentes hermanos,
 * y el borrador persistido es lo único que los dos ven.
 */
export function anotarVelocidadEnBorrador(
  microcicloId: string,
  ejercicio: EjercicioPrescrito,
  orden: number,
  velocidad: VelocidadDeSerie,
): void {
  const clave = claveDeBorrador(microcicloId, ejercicio.id, orden)
  escribirJSON(clave, { ...leerBorrador(microcicloId, ejercicio, orden), velocidad })
}
