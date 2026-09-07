/**
 * DE QUIÉN ES EL DEDO: del cuerpo o de la cámara.
 *
 * Bryan, 2026-09-06: «no me deja hacer el giro de 360 grados y desplazarme por todo el
 * salón». Medido con toques emulados: en el salón un dedo NUNCA orbitaba —era del eje W y
 * del cambio de ejercicio— y la cámara vivía en dos dedos, que además se peleaban con el
 * barrido: cada tirón de dos dedos giraba la sala Y cambiaba de ejercicio, y la vista saltaba
 * al ángulo de estudio del siguiente. Eso es «se pierde el diseño y se va para otro lado».
 *
 * La regla nueva es la de la maqueta del kit («el arrastre de cámara ignora los eventos que
 * nacen en el sujeto»), leída al revés: **el dedo que nace SOBRE EL CUERPO es del cuerpo**
 * —mantener para hundirse, vertical para atravesar capas, horizontal para cambiar de
 * ejercicio— y **el dedo que nace FUERA del cuerpo es de la cámara**: orbita, como en
 * cualquier visor 3D. Dos dedos siguen siendo cámara (pellizco y giro) y le quitan el gesto
 * al de uno.
 *
 * Función pura: el cuadro del cuerpo en píxeles de pantalla lo calcula el visor con la
 * cámara de cada fotograma; aquí solo se decide, y por eso se puede probar sin navegador.
 */
import type { ModoDeArrastre } from '../../capas/gestoHorizontal'

export interface CuadroEnPantalla {
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * Cuánto se ensancha el cuerpo para el dedo, en píxeles CSS. Un pulgar no acierta al
 * milímetro, y un cuerpo de perfil es estrecho: sin holgura, hundirse en un press de banca
 * exigiría dar en una franja de dos dedos de ancho.
 */
export const HOLGURA_DEL_DEDO = 28

/**
 * Lo que puede hacer el dedo con la cámara según dónde nace: fuera del cuerpo, todo; sobre
 * el cuerpo, solo girar en horizontal (lo vertical es del eje W).
 */
export function modoDelDedo(cuadro: CuadroEnPantalla | undefined, x: number, y: number): ModoDeArrastre {
  return dedoEnElCuerpo(cuadro, x, y) ? 'solo-azimut' : 'todo'
}

export function dedoEnElCuerpo(cuadro: CuadroEnPantalla | undefined, x: number, y: number): boolean {
  // Sin cuadro todavía —el primer fotograma, o un visor sin cuerpo— el dedo es del cuerpo,
  // que es lo que era hasta hoy: mejor un giro que no arranca que un hundido que no arranca.
  if (!cuadro) return true
  return (
    x >= cuadro.x0 - HOLGURA_DEL_DEDO &&
    x <= cuadro.x1 + HOLGURA_DEL_DEDO &&
    y >= cuadro.y0 - HOLGURA_DEL_DEDO &&
    y <= cuadro.y1 + HOLGURA_DEL_DEDO
  )
}
