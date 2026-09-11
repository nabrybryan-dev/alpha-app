/**
 * EL FANTASMA: la repetición que se HIZO, superpuesta a la que había que hacer.
 *
 * ## Qué es una huella
 *
 * Una repetición real, reducida a lo que el encoder sí mide: DÓNDE estaba la barra en
 * cada instante. Normalizada de 0 (abajo) a 1 (arriba) y muestreada a intervalos iguales
 * a lo largo de una repetición de `duracionSeg` segundos. Con eso, el sujeto fantasma
 * recorre el MISMO gesto que el sujeto de la prescripción, pero al ritmo que de verdad se
 * hizo: si se frenó en el estancamiento, se ve frenar; si la bajada fue de un segundo en
 * vez de tres, se ve caer.
 *
 * ## Lo que NO es
 *
 * No es la pose articular de la persona: la pista de articulaciones del encoder no cruza
 * hoy la aduana hacia la app. Este fantasma tiene el ESQUELETO del patrón y el TIEMPO de
 * la persona. Es lo honesto con los datos que llegan, y es lo que ya enseña lo que
 * importa —dónde se frena y cuánto tarda—. El día que la pista articular llegue, lo que
 * cambia es de dónde sale la fase de cada articulación, no este contrato.
 *
 * ## Por qué la fase se interpola y no se busca la muestra más cercana
 *
 * Porque el bucle pinta a 60 Hz y la huella va a 10 o 20: buscar la más cercana da un
 * fantasma que avanza a saltos, y un fantasma a saltos se lee como un fallo de la
 * pantalla, no como una repetición.
 */

import type { HuellaDeRepeticion } from '../../../domain/patrones/huella'
import type { Pose } from '../../../domain/patrones/esqueleto'

/**
 * El tipo vive en `domain/patrones/huella.ts`, junto a cómo se calcula desde el encoder:
 * la huella viaja en la serie registrada, y `domain/types.ts` no puede importar de
 * `features/`. Aquí se reexporta para que quien pinta no tenga que saber dónde nace.
 */
export type { HuellaDeRepeticion }

/**
 * La fase del fantasma en el instante `t`, en bucle.
 *
 * Devuelve `undefined` si la huella no da para una trayectoria —menos de dos muestras o
 * duración nula—, y quien pinte no pinta fantasma. Un fantasma quieto en 0 sería un
 * cuerpo agachado para siempre, que se leería como una persona más en la sala.
 */
export function faseDeHuella(huella: HuellaDeRepeticion, t: number): number | undefined {
  const n = huella.fase.length
  if (n < 2 || !(huella.duracionSeg > 0) || !Number.isFinite(t)) return undefined
  const d = huella.duracionSeg
  const u = ((t % d) + d) % d
  const x = (u / d) * (n - 1)
  const i = Math.min(Math.floor(x), n - 2)
  const k = x - i
  const a = huella.fase[i]
  const b = huella.fase[i + 1]
  return limitar01(a + (b - a) * k)
}

/** El sentido del gesto en `t`: +1 subiendo, −1 bajando. Sale de la pendiente de la huella. */
export function sentidoDeHuella(huella: HuellaDeRepeticion, t: number): number {
  const eps = Math.max(1e-3, huella.duracionSeg / 200)
  const antes = faseDeHuella(huella, t - eps)
  const despues = faseDeHuella(huella, t + eps)
  if (antes === undefined || despues === undefined) return 1
  return despues >= antes ? 1 : -1
}

const limitar01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * LA POSE MEDIDA del fantasma en el instante `t`: los canales articulares de la huella,
 * interpolados igual que la fase. `undefined` cuando la huella es solo de barra —entonces
 * el fantasma posa con la técnica del patrón a la fase medida, que es lo que había.
 *
 * Los canales salen sin sufijo de lado; `esqueletoEnFase()` los sobrepone a los del
 * patrón quitando también los de cada lado, para que un `rodillaFlexD` del patrón no le
 * gane a la rodilla que de verdad se midió.
 */
export function poseDeHuella(huella: HuellaDeRepeticion, t: number): Pose | undefined {
  const canales = huella.articular
  if (!canales || !(huella.duracionSeg > 0) || !Number.isFinite(t)) return undefined
  const pose: Pose = {}
  let alguno = false
  for (const [canal, valores] of Object.entries(canales)) {
    const v = muestraEn(valores, huella.duracionSeg, t)
    if (v === undefined) continue
    pose[canal] = v
    alguno = true
  }
  return alguno ? pose : undefined
}

/** Un canal muestreado a intervalos iguales, leído en `t` con bucle e interpolación lineal. */
function muestraEn(valores: number[], duracionSeg: number, t: number): number | undefined {
  const n = valores.length
  if (n < 2) return undefined
  const u = ((t % duracionSeg) + duracionSeg) % duracionSeg
  const x = (u / duracionSeg) * (n - 1)
  const i = Math.min(Math.floor(x), n - 2)
  const k = x - i
  return valores[i] + (valores[i + 1] - valores[i]) * k
}
