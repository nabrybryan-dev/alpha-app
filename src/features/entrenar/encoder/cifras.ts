import type { NivelCalidad } from './nucleo/analisis'

/**
 * Si una toma con este veredicto puede enseñar cifras de velocidad.
 *
 * ## Por qué esto es una función y no un `if` en cada pantalla
 *
 * `descartada` **no significa «poco fiable»: significa que el número que salió es
 * falso.** El caso que lo define es real y está en los datos de ejemplo — un 0,94
 * m/s perfectamente creíble, salido de una escala que se calculó ajustando el
 * círculo a una pila de discos en vez de a uno—. Un número así no se atenúa ni se
 * pone en gris pequeñito: si asoma, alguien lo apunta.
 *
 * La regla vivía solo en `ResultadoSerie.tsx`, con su test. Las otras dos vistas
 * —la hoja de medición y el laboratorio— pintaban `vPrimera`, `vUltima` y `pvPct`
 * sin mirar el nivel, y la hoja es justamente donde se decide si guardar la
 * medición. Tenerla escrita en un sitio es lo que impide que la próxima pantalla
 * la vuelva a olvidar.
 *
 * El %PV no es una excepción: es un cociente y sobrevive a una escala mala, pero
 * no sobrevive a un seguimiento que perdió el disco, que es lo que dice
 * `marcador_perdido`.
 */
export function seOcultanLasCifras(nivel: NivelCalidad): boolean {
  return nivel === 'descartada'
}
