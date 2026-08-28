/**
 * De la luz que calcula el shader al color que sale por pantalla.
 *
 * Faltaban los dos últimos pasos, y son los que deciden el aspecto de toda la
 * imagen:
 *
 * 1. **Tonemapping.** La iluminación se calcula sin techo, así que un brillo
 *    puede pasar de 1 y al escribirlo se recorta: las zonas claras se quedan
 *    planas y sin color. Una curva filmica comprime esos valores en vez de
 *    cortarlos, que es lo que hace una película fotográfica.
 * 2. **Codificación sRGB.** Una pantalla no es lineal. Escribir el valor
 *    calculado tal cual deja los medios tonos por debajo de donde deberían y la
 *    imagen se ve apagada y lechosa.
 *
 * El orden importa: primero se comprime el rango y después se codifica. Al
 * revés se comprimiría un valor ya deformado.
 *
 * Los coeficientes viven aquí una sola vez y el GLSL se genera con ellos, para
 * que la versión que se puede probar y la que corre en la tarjeta no puedan
 * divergir.
 */

/**
 * Ajuste de la curva ACES de Narkowicz (2015).
 *
 * Es la aproximación que se usa en tiempo real: satura un poco de más en los
 * claros comparada con el ajuste largo, y cuesta cinco multiplicaciones.
 */
export const ACES = { a: 2.51, b: 0.03, c: 2.43, d: 0.59, e: 0.14 } as const

/** La curva, canal a canal. Entra luz sin techo y sale de 0 a 1. */
export function tonemap(x: number): number {
  const v = Math.max(0, x)
  const { a, b, c, d, e } = ACES
  return Math.min(1, Math.max(0, (v * (a * v + b)) / (v * (c * v + d) + e)))
}

/** Exponente de codificación. 2.2 es la aproximación de siempre a sRGB. */
export const GAMMA = 2.2

/** Del valor lineal al que hay que escribir para que la pantalla lo muestre bien. */
export function aPantalla(x: number): number {
  return Math.pow(Math.max(0, Math.min(1, x)), 1 / GAMMA)
}

/**
 * Del color tal como se eligió mirando la pantalla al valor con el que se puede
 * calcular luz.
 *
 * Es el paso que faltaba al principio de la cadena. Los colores del hueso y del
 * músculo se ajustaron a ojo, así que ya venían codificados; iluminarlos tal
 * cual y codificar otra vez al final los corregía dos veces y la imagen salía
 * lavada, con los músculos en rosa pálido.
 */
export function aLineal(x: number): number {
  return Math.pow(Math.max(0, Math.min(1, x)), GAMMA)
}

/** Los dos pasos, en orden. */
export function acabado(x: number): number {
  return aPantalla(tonemap(x))
}

/**
 * El mismo cálculo en GLSL, generado con los coeficientes de arriba.
 *
 * Se inyecta en el fragmento del shader. Si alguien toca `ACES` o `GAMMA`, la
 * tarjeta y los tests cambian a la vez.
 */
export const GLSL_ACABADO = `
vec3 aLineal(vec3 x) {
  return pow(max(x, 0.0), vec3(${GAMMA}));
}
vec3 acabado(vec3 x) {
  x = max(x, 0.0);
  vec3 comprimido = clamp(
    (x * (${ACES.a} * x + ${ACES.b})) / (x * (${ACES.c} * x + ${ACES.d}) + ${ACES.e}),
    0.0, 1.0);
  return pow(comprimido, vec3(${(1 / GAMMA).toFixed(6)}));
}`
