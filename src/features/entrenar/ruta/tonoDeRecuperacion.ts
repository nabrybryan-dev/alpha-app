/**
 * CÓMO SE LLAMA Y DE QUÉ COLOR VA UN ÍNDICE DE RECUPERACIÓN.
 *
 * Vivía dentro de `ComoLlegas.tsx` y salió de allí el 2026-09-03, cuando la cifra del
 * índice subió al rótulo de su tramo en la hoja del salón: el color tiene que subir con
 * ella —un 88 en plata mientras el texto de abajo dice «Recuperado» en verde son dos
 * afirmaciones distintas sobre el mismo dato—, así que el panel también la necesita.
 *
 * Y vive en un archivo propio, no exportada desde el componente, porque un archivo que
 * exporta un componente **y** una función deja de poder recargarse en caliente y ESLint lo
 * avisa (`react-refresh/only-export-components`). En este repo esa cuenta es un delta, no
 * un presupuesto: exportarla desde `ComoLlegas.tsx` dejaba un aviso más de los que había.
 */

/** Los tres tramos del índice, con su nombre y sus dos clases de color. */
export interface TonoDeRecuperacion {
  /** Cómo se llama el estado en la frase de abajo. */
  texto: string
  /** La clase del color del texto y de la cifra. */
  clase: string
  /** La clase del relleno de la barra. */
  barra: string
}

/**
 * Los cortes son 70 y 50 sobre el índice de Hooper adaptado, y no se tocan aquí: son la
 * misma escala con la que el coach lee los check-ins.
 */
export function tonoDeRecuperacion(indice: number): TonoDeRecuperacion {
  if (indice >= 70) return { texto: 'Recuperado', clase: 'text-accion', barra: 'bg-accion' }
  if (indice >= 50) return { texto: 'En trabajo', clase: 'text-silver-200', barra: 'bg-silver-200' }
  return { texto: 'Fatiga acumulada', clase: 'text-ambar', barra: 'bg-ambar' }
}
