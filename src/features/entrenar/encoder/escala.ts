/**
 * ¿La escala en milímetros es la del disco que hay puesto?
 *
 * Es el error que más daño hace de todos, y el único que no deja rastro. Todo lo
 * demás falla de forma visible: el marcador se pierde, los fps bajan, la
 * referencia sale torcida, y la puerta de calidad lo dice. Elegir «olímpico
 * 15 kg» con un bumper de 450 mm puesto no rompe nada — **desvía TODAS las
 * velocidades por el mismo 12,5 %**, la serie sale limpia, la calidad sale
 * buena, y el número entra en el historial siendo mentira.
 *
 * Y el %PV sobrevive a ese error, porque es un cociente entre dos velocidades
 * medidas con la misma regla equivocada. Eso, que en el §4 del plan es una
 * virtud, aquí es la trampa: la métrica que más se mira es justo la que no se
 * entera. Lo único que chirría es el RECORRIDO — una sentadilla de 1,40 m no
 * existe— y esa comprobación estaba escrita en `nucleo/disco.js` desde el
 * principio, con su tabla por ejercicio, y no la llamaba nadie.
 *
 * Tercera función del núcleo escrita, tipada en el `.d.ts` y sin usar. Las otras
 * dos fueron `centroideEnVentana` y la predicción con velocidad de
 * `detectarDisco`, y las dos costaban medidas mal.
 */

import type { ResultadoSerie } from './nucleo/analisis'
import { romPlausible } from './nucleo/disco.js'
import { mediana } from './tanda.ts'

export interface RevisionDeEscala {
  ok: boolean
  /** El recorrido mediano de la serie, en metros. */
  romM: number
  /** Qué entrada de la tabla se usó: `sentadilla`, `generico`… */
  clave?: string
  motivo?: string
}

/**
 * Revisa el recorrido contra lo que ese ejercicio puede dar de sí.
 *
 * Devuelve `null` cuando no hay nada que juzgar: sin escala el recorrido está en
 * píxeles y compararlo con metros no significa nada. Un `null` es «no lo sé», y
 * es importante que no se confunda con «está bien» — por eso no se devuelve
 * `{ ok: true }` en ese caso.
 *
 * La MEDIANA de los recorridos, no el de la primera repetición: la primera suele
 * ser corta —se coloca, tantea— y la última bajo fatiga también. Una de las dos
 * puntas no puede decidir que el disco está mal elegido.
 */
export function revisarEscala(datos: ResultadoSerie, ejercicio: string): RevisionDeEscala | null {
  if (!datos.ok || !datos.hayEscala) return null
  const roms = datos.reps.map((r) => r.rom).filter((x) => Number.isFinite(x) && x > 0)
  const romM = mediana(roms)
  if (romM === undefined) return null
  const veredicto = romPlausible(romM, ejercicio)
  return { ok: veredicto.ok, romM, clave: veredicto.clave, motivo: veredicto.motivo }
}

/**
 * El aviso para la pantalla, con el número y con qué hacer.
 *
 * Dice el recorrido medido y no solo que «algo no cuadra»: sin el número no se
 * puede decidir si lo que está mal es el disco elegido o el ejercicio escrito, y
 * son dos arreglos distintos. Es la misma lección de `avisoDisco.ts`.
 */
export function avisoDeEscala(revision: RevisionDeEscala | null): string | null {
  if (!revision || revision.ok) return null
  return (
    `El recorrido medido es de ${(revision.romM * 100).toFixed(0)} cm, y para ${revision.clave} ` +
    'eso no existe. Casi siempre significa que el disco elegido no es el que hay puesto: ' +
    'con el diámetro equivocado TODAS las velocidades salen desviadas por el mismo factor y ' +
    'la serie parece perfecta. Comprueba el disco antes de guardar — y si el ejercicio no es ' +
    'el que pone arriba, corrígelo, que la tabla de recorridos va por ejercicio.'
  )
}
