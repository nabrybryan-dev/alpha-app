import type { HuellaDeRepeticion } from '../../../domain/patrones/huella'
import { esPistaDePose, huellaDePista } from '../../../domain/patrones/huellaArticular'

/**
 * Leer una pista de pose —la salida de `articulaciones.py`— y sacar su huella articular.
 *
 * Es la puerta hermana de `importarMedida.ts` y sigue su misma regla: **se pasan datos,
 * no código**. La pista entra tal cual la escribe la herramienta, sin exportador
 * intermedio: no hay nada que exportar, la app sabe leer los puntos.
 *
 * `esPista` distingue dos fallos que se dicen distinto: «esto no es una pista» (probará
 * con el importador de medidas) y «es una pista pero no da para una repetición» (que se
 * le dice a la persona, porque repetir la toma sí lo arregla).
 */
export type ImportacionDePista =
  | { ok: true; huella: HuellaDeRepeticion; video?: string; fotogramas: number }
  | { ok: false; esPista: boolean; problema: string }

export function importarPista(texto: string): ImportacionDePista {
  let crudo: unknown
  try {
    crudo = JSON.parse(texto)
  } catch {
    return { ok: false, esPista: false, problema: 'Eso no es un archivo JSON.' }
  }
  if (!esPistaDePose(crudo)) return { ok: false, esPista: false, problema: 'El archivo no es una pista de pose.' }
  const huella = huellaDePista(crudo)
  if (!huella) {
    return {
      ok: false,
      esPista: true,
      problema:
        'La pista no da para una repetición: hacen falta cadera y rodilla visibles durante una bajada y una subida. Repetir la toma de perfil suele arreglarlo.',
    }
  }
  return { ok: true, huella, video: crudo.video, fotogramas: crudo.fotogramas.length }
}
