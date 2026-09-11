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

/**
 * Qué pone en la columna del ángulo y qué pone debajo.
 *
 * Existen separados por un fallo que se vio en un móvil de verdad: el consejo iba
 * DENTRO del valor —«81° incl. ✕ endereza · 124° giro ⚠ endereza la diana»— y en una
 * fila de lecturas cortas eso desborda, se parte en cuatro líneas y empuja a fps y
 * marcas fuera de su sitio. La barra que decide si la toma sirve dejaba de leerse justo
 * con la cámara abierta y el teléfono en el trípode.
 *
 * La regla, y por eso es una función y no dos plantillas sueltas: **en la columna solo
 * cabe una cifra**. Todo lo que sea una frase baja. Ninguna información se pierde.
 */
export function lecturaDeAngulo(entrada: {
  inclinacionGrados: number
  giroGrados: number
  escorzoDescarta: boolean
  escorzoAvisa: boolean
  giroAvisa: boolean
}): { valor: string; consejo: string } {
  const avisos: string[] = []
  if (entrada.escorzoDescarta) avisos.push('✕ endereza la cámara')
  else if (entrada.escorzoAvisa) avisos.push('⚠ se descartará por escorzo')
  if (entrada.giroAvisa) avisos.push('⚠ endereza la diana')
  return {
    valor: `${entrada.inclinacionGrados.toFixed(0)}° · ${Math.abs(entrada.giroGrados).toFixed(0)}°`,
    consejo: avisos.join(' · '),
  }
}
