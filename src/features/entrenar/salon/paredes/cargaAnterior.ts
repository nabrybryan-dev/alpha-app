import type { EjercicioPrescrito, Microciclo } from '../../../../domain/types'

/**
 * CON CUÁNTO LEVANTÓ ESTE EJERCICIO LA ÚLTIMA VEZ.
 *
 * El muro enseña dos kilos juntos —«carga a usar» y «la semana pasada»— y el segundo
 * **no se calcula: se recuerda**. Es la diferencia entre una recomendación y un hecho, y
 * es lo único que convierte la cifra de hoy en una decisión: 80 no dice nada; 80 debajo de
 * 77,5 dice que subes.
 *
 * ## Por qué sale del microciclo ANTERIOR y no del de hoy
 *
 * Dentro del microciclo en curso el mismo ejercicio puede repetirse, y su última serie
 * registrada es de HOY, no de la semana pasada. Enseñar eso bajo el rótulo «la semana
 * pasada» sería mentir con un dato verdadero.
 *
 * ## Por qué se busca por NOMBRE
 *
 * Los `id` de ejercicio se generan por microciclo: el mismo press de banca tiene un id
 * distinto cada semana, así que cruzarlos por id no encuentra nunca nada. El nombre es lo
 * que se conserva de una programación a la siguiente, y por eso se compara normalizado
 * —sin acentos, sin mayúsculas y sin espacios de más—: «Press Militar» y «press militar»
 * son el mismo ejercicio y un cambio de mayúsculas del coach no puede borrar el histórico.
 *
 * ## Y por qué la ÚLTIMA serie y no la máxima
 *
 * Porque lo que se compara es el punto de partida de la próxima serie, y una sesión que
 * bajó de carga al final bajó por algo. La máxima del día contaría la mejor serie; la
 * última cuenta cómo terminó, que es de donde se sigue.
 *
 * Devuelve `undefined` cuando no hay con qué comparar —primer microciclo, ejercicio nuevo,
 * o una semana que no se llegó a registrar—. **Ausente no es cero**: quien lo pinte no
 * pinta la línea, en vez de escribir un 0 kg que nadie levantó.
 */
export function cargaAnterior(
  previo: Microciclo | undefined,
  ejercicio: EjercicioPrescrito | undefined,
): number | undefined {
  if (!previo || !ejercicio) return undefined
  const buscado = normalizar(ejercicio.nombre)
  if (!buscado) return undefined

  for (const sesion of previo.sesiones) {
    for (const otro of sesion.ejercicios) {
      if (normalizar(otro.nombre) !== buscado) continue
      // La última por `orden`, no la última del array: el array llega en el orden en que
      // se escribió y una serie corregida se reescribe en su sitio.
      const ultima = [...otro.series].sort((a, b) => a.orden - b.orden).at(-1)
      if (ultima) return ultima.cargaKg
    }
  }
  return undefined
}

/** Sin acentos, sin mayúsculas y sin espacios de más. */
function normalizar(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}
