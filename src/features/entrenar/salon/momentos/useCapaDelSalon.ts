import { useMemo } from 'react'
import type { CapaDeMomentos } from '../../../../domain/sujeto/capaDeMomentos'
import { banderaDeMomentos, capaDelSalon } from './capaDelSalon'

/**
 * La capa de momentos del salón, memorizada. La dirección (`busqueda`) es DEPENDENCIA del cálculo: antes
 * el `useMemo` leía `window.location.search` sin tenerla en cuenta, y un cambio de `?momentos=` sin
 * remontar el salón dejaba la capa vieja. Quien llama pasa `window.location.search` en cada
 * renderizado; la capa solo se recalcula si cambia algo de verdad.
 */
export function useCapaDelSalon(
  busqueda: string,
  categoria: string | undefined,
  nombre: string | undefined,
): CapaDeMomentos {
  return useMemo(() => capaDelSalon(banderaDeMomentos(busqueda), categoria, nombre), [busqueda, categoria, nombre])
}
