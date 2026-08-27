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
  desvio_sin_disco: COPY.desvio_sin_disco,
}

export function textoDeMotivo(motivo: MotivoEncuadre): string {
  return TEXTO[motivo] ?? motivo
}

/**
 * Aquí NO hay una puerta propia de la pantalla, y la ausencia sigue siendo
 * deliberada — pero ya no por lo mismo.
 *
 * **Hasta el 2026-08-26** el núcleo solo miraba desvío > 30°, así que 22°
 * devolvían `buena` con un 14,7 % de error sin corregir. La pantalla no lo
 * tapaba (enseña el par de errores en los tres estados) pero tampoco lo
 * impedía, y la puerta estaba sin decidir.
 *
 * **Ya está decidida, y vive donde tiene que vivir**: en `calificarEncuadre`,
 * con sus casos en `pruebas-encuadre.mjs`. Son dos topes y no uno, porque el
 * escorzo se puede deshacer cuando se ve un disco de 450 mm —φ sale de lo
 * aplastada que está su elipse— y no se puede cuando no lo hay:
 *
 *   · con disco   → hasta 30°, y lo que queda es 0,7 %
 *   · sin disco   → `buena` hasta 12°, `dudosa` hasta 20°, y descartada pasando
 *
 * Lo que esta pantalla aporta es el dato que el núcleo no puede adivinar: si el
 * ejercicio lleva barra. Por eso el interruptor, y por eso su valor por defecto
 * es «no»: dar por hecho que hay disco sería dar por hecho la corrección.
 */
