/**
 * La capa de momentos para `medir-fotograma-salon.mjs` (`?capa=1`): la decisión del dominio se toma
 * UNA vez (como el `useMemo` del salón) y las mallas se construyen en cada fotograma.
 *
 * Mide el PEOR CASO: desde C-3 el salón real solo dibuja los arcos cerca de la pose del cálculo, así que
 * aquí la pose del cálculo se pone en la del fotograma (`mallasDelPeorCaso`) y los arcos se construyen
 * en todos. Es una cota superior del coste, no el coste típico.
 */
import { mallasDelPeorCaso } from './medir-fotograma-guarda.mjs'


let capa = null
let dibujar = null
let poseDe = null

/** Carga los módulos y decide la capa UNA vez, antes de medir. */
export async function preparar() {
  const [d, f] = await Promise.all([
    import('/src/domain/sujeto/capaDeMomentos.ts'),
    import('/src/features/entrenar/escena/dibujarMomentos.ts'),
  ])
  capa = d.capaDeMomentos(
    d.SUJETO_DE_EJEMPLO,
    d.INCERTIDUMBRE_DE_EJEMPLO,
    { categoria: 'SENTADILLA', nombre: 'Sentadilla con barra', sujetoDeEjemplo: true },
    { muestras: 500 },
  )
  dibujar = f.mallasDeMomentos
  poseDe = f.poseDelEsqueleto
}

/** Lo que se construye en cada fotograma: las dos mallas de los momentos. */
export function extras(esq) {
  return mallasDelPeorCaso(capa, dibujar, poseDe, esq)
}
