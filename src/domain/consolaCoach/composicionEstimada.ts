import type { MedidaCorporal, SexoDeFicha } from '../types'
import { HOMBRE, MUJER, masaMagraKg as masaMagraNavy, type Genero } from '../nutricion/composicion'

/**
 * MASA MAGRA ESTIMADA DE UNA MEDIDA DE LA FICHA, PARA EL P-RATIO.
 *
 * `SeccionPRatio` (consola) necesita `pesoKg` y `masaMagraKg` en dos medidas para calcular
 * el P-ratio (`pRatio.ts`). Hasta el 2026-09-27 `masaMagraKg` solo llegaba si alguien la
 * medía aparte (bioimpedancia) — la ficha no preguntaba cuello, así que la fórmula US Navy
 * (`domain/nutricion/composicion.ts`, la misma que ya usa el formulario de nutrición) nunca
 * tenía sus tres perímetros completos y el P-ratio quedaba "no interpretable" casi siempre.
 *
 * Esta función NO sustituye una masa magra ya medida: si `medida.masaMagraKg` viene puesta
 * (bioimpedancia, o cualquier otra vía), esa gana — es un dato medido, y esto es una
 * estimación por perímetros. Solo cuando falta intenta derivarla de `medida.cuerpo`
 * (cintura, caderas y cuello, las tres de `domain/medidas.ts`) más `pesoKg`, `alturaCm` y el
 * sexo de la ficha.
 *
 * Devuelve `undefined` — nunca un número inventado — cuando falta cualquier dato que la
 * fórmula necesite, exactamente igual que `masaMagraNavy` (que ya distingue None de un
 * porcentaje fuera de rango).
 */
export function masaMagraEstimada(medida: MedidaCorporal, sexo: SexoDeFicha | undefined): number | undefined {
  if (medida.masaMagraKg !== undefined) return medida.masaMagraKg

  const genero = aGenero(sexo)
  if (genero === undefined) return undefined
  if (medida.pesoKg === undefined) return undefined

  const cuerpo = medida.cuerpo
  const cinturaCm = cuerpo?.cinturaCm
  const cuelloCm = cuerpo?.cuelloCm
  if (cinturaCm === undefined || cuelloCm === undefined) return undefined

  const estimada = masaMagraNavy({
    pesoKg: medida.pesoKg,
    alturaCm: medida.alturaCm,
    cuelloCm,
    cinturaCm,
    genero,
    // La cadera solo la exige la fórmula femenina (`faltantes` en composicion.ts); en
    // hombres pasarla o no da igual porque no entra en la cuenta.
    caderaCm: cuerpo?.caderasCm,
  })
  return estimada ?? undefined
}

/** `SexoDeFicha` ('hombre'/'mujer', el que indica el coach) al `Genero` ('H'/'M') que pide
 *  la fórmula Navy. `undefined` cuando la ficha no lo ha dicho: sin sexo no hay fórmula. */
function aGenero(sexo: SexoDeFicha | undefined): Genero | undefined {
  if (sexo === 'hombre') return HOMBRE
  if (sexo === 'mujer') return MUJER
  return undefined
}
