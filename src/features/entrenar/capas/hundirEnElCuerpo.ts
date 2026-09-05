import type { NivelW } from '../salon/huecos'

/**
 * HUNDIR EL DEDO EN EL CUERPO: la presión atraviesa las capas.
 *
 * ## De dónde sale
 *
 * Las cinco capas del eje W se recorrían con un arrastre vertical y, además, con una
 * escalera de cinco botones pegada al borde derecho. Bryan quitó la escalera el
 * 2026-09-04 con el criterio de toda esa tanda —la interacción se hace tocando el salón,
 * no pulsando controles puestos encima— y describió el gesto que la sustituye: «hundiéndole
 * completamente con el dedo al sujeto para que se puedan ver las diferentes capas».
 *
 * Así que la presión sostenida es lo que entra. Es el gesto correcto para lo que hace: el
 * eje W no rodea el cuerpo, lo ATRAVIESA, y hundir el dedo es exactamente eso. Un arrastre
 * dice «muévete»; una presión dice «métete».
 *
 * ## Por qué la aritmética vive aquí
 *
 * Porque los umbrales de un gesto escritos dentro de un manejador de puntero solo se
 * pueden probar montando el componente y falsificando un dedo. Es la misma regla que ya
 * cumplen `gestoVertical.ts`, `rumboDelJoystick.ts` y `fisicaDelTambor.ts`.
 *
 * ## Los dos números, y qué protege cada uno
 *
 * - **La espera** es lo que separa TOCAR de HUNDIR. Sin ella, cualquier roce sobre el
 *   cuerpo empezaría a atravesarlo, y el sujeto es también la superficie por la que se
 *   orbita: el salón cambiaría de capa cada vez que alguien empieza a girar la cámara.
 * - **El escalón** es lo que hace que hundirse se LEA. Instantáneo saltaría de la piel al
 *   hueso sin enseñar lo de en medio, que es justo lo que se quiere ver.
 */

/** Cuánto hay que aguantar antes de empezar a entrar, en milisegundos. */
export const ESPERA = 320

/** Cuánto tarda en pasarse a la capa siguiente mientras se aguanta. */
export const ESCALON_MS = 450

/** El escalón más profundo: el hueso. */
export const MAS_ADENTRO: NivelW = 4

/**
 * LA CAPA A LA QUE SE HA LLEGADO tras aguantar `apretado` milisegundos.
 *
 * Cuenta desde la capa en la que estaba el dedo al bajar, no desde la piel: quien ya está
 * en el músculo y vuelve a apretar sigue hacia dentro, no empieza otra vez.
 *
 * **Se para en el hueso y no da la vuelta.** Volver a la piel al pasarse sería un ciclo, y
 * un ciclo convierte «me he metido demasiado» en «he perdido el sitio»: para salir se
 * arrastra hacia arriba, que es el gesto contrario y el que ya existe.
 */
export function capaTrasHundir(apretadoMs: number, capaAlBajar: NivelW): NivelW {
  if (apretadoMs < ESPERA) return capaAlBajar
  const escalones = Math.floor((apretadoMs - ESPERA) / ESCALON_MS) + 1
  return Math.min(MAS_ADENTRO, capaAlBajar + escalones) as NivelW
}

/**
 * SI EL DEDO SE HA MOVIDO DEMASIADO PARA SEGUIR SIENDO UNA PRESIÓN.
 *
 * Ocho píxeles. Un dedo apoyado nunca está completamente quieto —y menos con el teléfono
 * en la mano en un gimnasio—, así que exigir cero cancelaría el gesto siempre. Pasados los
 * ocho ya no es alguien apoyando: es alguien arrastrando, y el arrastre es de la órbita o
 * del eje W según su dirección.
 */
export const TOLERANCIA = 8

export function siguePresionando(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) <= TOLERANCIA
}
