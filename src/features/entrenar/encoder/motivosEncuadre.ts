import { COPY } from './copys'
import type { MotivoEncuadre } from './nucleo/encuadre'

/**
 * El puente entre lo que el núcleo dice y lo que la persona lee.
 *
 * Existe por una razón concreta: `encuadre.js` emite `disco_pequeño` **con ñ** y
 * la clave del copy es `disco_pequeno` **sin ella**. El núcleo es de solo lectura
 * aquí (`nucleo/ORIGEN.md`) y las claves de copy vienen del entregable de diseño,
 * así que ninguno de los dos lados se puede tocar — y si cada pantalla salvara esa
 * distancia por su cuenta, la que se olvidara pintaría la clave cruda en pantalla
 * en lugar del texto, y solo en el caso menos frecuente de los cuatro.
 */

const TEXTO: Record<MotivoEncuadre, string> = {
  no_es_lateral: COPY.no_es_lateral,
  disco_pequeño: COPY.disco_pequeno,
  camara_baja: COPY.camara_baja,
  no_cabe: COPY.no_cabe,
}

export function textoDeMotivo(motivo: MotivoEncuadre): string {
  return TEXTO[motivo] ?? motivo
}

/**
 * Aquí NO hay una puerta propia de la pantalla, y la ausencia es deliberada.
 *
 * El entregable de diseño da por hecho que 22° de desvío salen `dudosa` «sin
 * motivo», y el núcleo no lo hace: `calificarEncuadre` solo mira desvío > 30°, así
 * que **devuelve `buena` con un 14,7 % de error sin corregir**. Inventar aquí un
 * umbral para tapar esa distancia sería peor que la distancia: pondría el criterio
 * de qué evidencia se acepta en una pantalla, lejos de `encuadre.js` y de las
 * pruebas que lo cubren, y encima duplicado.
 *
 * Mientras esa puerta se decide, la pantalla no oculta nada: enseña el par de
 * errores en TODOS los estados, así que el 14,7 % se ve aunque el sello diga que
 * la colocación es buena.
 */
