import type { SexoDeFicha } from './types'

/**
 * EL SEXO DE LA FICHA: lo que el coach puede indicar, y nada más.
 *
 * Es el vocabulario de `Perfil.sexo` y el mismo que fija el `check` de la
 * columna `perfiles.sexo` (migración 0056); `perfilEnNube.test.ts` comprueba
 * que las dos listas coinciden leyendo el SQL. En el orden en que se ofrecen.
 *
 * NO es el `genero` de la encuesta de nutrición (`'M'`/`'H'`): aquello lo
 * contesta el asesorado para la composición corporal; esto lo rellena el coach
 * para el sujeto 3D. Por eso `esSexoDeFicha('M')` es falso a propósito.
 */
export const SEXOS_DE_FICHA: readonly SexoDeFicha[] = ['hombre', 'mujer']

/** Lo que baja de la nube es `unknown` hasta que se demuestre lo contrario. */
export function esSexoDeFicha(valor: unknown): valor is SexoDeFicha {
  return typeof valor === 'string' && (SEXOS_DE_FICHA as readonly string[]).includes(valor)
}
