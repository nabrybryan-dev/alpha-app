import { categoriaCanonica } from '../taxonomia'
import type { Implemento, PerfilDeImplemento } from './implementos'

/**
 * DÓNDE ENTRA LA CARGA EN EL CUERPO — y por qué no lo decide el implemento solo.
 *
 * `IMPLEMENTOS` declara una `aplicacion` por implemento, y para tres de ellos basta: una
 * polea con tobillera tira SIEMPRE del tobillo, una prensa empuja SIEMPRE con los pies, el
 * peso corporal entra SIEMPRE por el cuerpo. Para la barra no basta, y ahí estaba el fallo:
 *
 *     press de banca con barra   la barra va en las MANOS
 *     sentadilla con barra       la barra va sobre el TRAPECIO
 *     empuje de cadera con barra la barra va sobre la PELVIS
 *
 * Mismo implemento, tres sitios distintos. Lo que decide no es con qué se hace: es QUÉ
 * ejercicio se hace. Con `aplicacion` colgando solo del implemento, la barra caía siempre
 * en las manos y una sentadilla salía con la barra colgando a la altura de las caderas —lo
 * vio Bryan el 2026-09-05 navegando por el salón, y tenía razón—.
 *
 * ## Qué hay aquí y qué no
 *
 * Solo las EXCEPCIONES: los pares (patrón, implemento) en los que la carga se apoya en el
 * cuerpo en vez de llevarse en la mano. Todo lo demás sigue saliendo del implemento, que es
 * donde estaba bien. La lista es corta a propósito: cada línea es una afirmación sobre cómo
 * se hace un ejercicio, y esas las firma el coach, no el código.
 *
 * ## De dónde sale cada línea
 *
 * De los `ejemplos` del propio catálogo de patrones, que es la fuente que ya usa la casa:
 * `EXTENSIÓN DE CADERA` se ejemplifica con «Empuje de cadera con barra», y en un empuje de
 * cadera la barra descansa sobre la pelvis — no hay otra forma de hacerlo. `SENTADILLA` y
 * `SENTADILLA UNILATERAL` con barra o en Smith llevan la barra sobre el trapecio, delante o
 * detrás del cuello, y en las dos la carga se APOYA: nadie sujeta una sentadilla con las
 * manos.
 */

export type Aplicacion = PerfilDeImplemento['aplicacion']

/**
 * Los implementos que en estos patrones se APOYAN en el cuerpo en vez de llevarse en la
 * mano. Un cable y una tobillera no: tiran desde fuera, y su sitio ya lo dice su perfil.
 */
const SE_APOYAN: readonly Implemento[] = ['barra', 'mancuernas', 'disco', 'guiado-vertical', 'maquina']

interface Excepcion {
  /** Categorías del catálogo de patrones, tal como las escribe `catalogo.ts`. */
  categorias: readonly string[]
  implementos: readonly Implemento[]
  aplicacion: Aplicacion
  porQue: string
}

const EXCEPCIONES: readonly Excepcion[] = [
  {
    categorias: ['SENTADILLA', 'SENTADILLA UNILATERAL'],
    // La barra libre y la del Smith se apoyan igual. Una goblet con disco o unas
    // mancuernas en una búlgara SÍ van en las manos, así que no entran aquí.
    implementos: ['barra', 'guiado-vertical'],
    aplicacion: 'hombros',
    porQue:
      'En una sentadilla con barra —libre o en Smith— la carga descansa sobre el trapecio, ' +
      'detrás o delante del cuello. Las manos solo la estabilizan: no la sostienen. Con la ' +
      'carga en las manos el modelo la pone a la altura de la cadera, que es donde no está.',
  },
  {
    categorias: ['EXTENSIÓN DE CADERA'],
    implementos: SE_APOYAN,
    aplicacion: 'pelvis',
    porQue:
      'El empuje de cadera es el ejemplo del propio catálogo, y ahí la barra —o la mancuerna, ' +
      'o el acolchado de la máquina— descansa sobre el pliegue de la cadera. La patada de ' +
      'glúteo en polea no entra: su perfil ya dice que tira del tobillo.',
  },
]

/**
 * Dónde entra la carga de este ejercicio.
 *
 * `categoria` es la del patrón; `implemento` el declarado en el nombre. Sin implemento no
 * hay carga que colocar y se devuelve el defecto —`manos`—, pero quien llama no debería
 * dibujar nada: un nombre que no dice con qué se hace no autoriza a suponerlo.
 */
export function aplicacionDeLaCarga(
  categoria: string,
  implemento: Implemento | undefined,
  perfil: PerfilDeImplemento | undefined,
): Aplicacion {
  const porDefecto = perfil?.aplicacion ?? 'manos'
  if (!implemento) return porDefecto
  // La categoría llega a veces en su forma vieja —`DOMINANTE DE CADERA`— y a veces con
  // tildes o en minúsculas. Se compara por la canónica, como el resto de la casa.
  const canonica = categoriaCanonica(categoria) ?? categoria.toUpperCase().trim()
  for (const e of EXCEPCIONES) {
    const coincide = e.categorias.some((c) => (categoriaCanonica(c) ?? c) === canonica)
    if (coincide && e.implementos.includes(implemento)) return e.aplicacion
  }
  return porDefecto
}

/** Por qué la carga de este ejercicio entra por ahí, si es una excepción. Para el aviso. */
export function porQueSeApoya(categoria: string, implemento: Implemento | undefined): string | undefined {
  if (!implemento) return undefined
  const canonica = categoriaCanonica(categoria) ?? categoria.toUpperCase().trim()
  return EXCEPCIONES.find(
    (e) =>
      e.categorias.some((c) => (categoriaCanonica(c) ?? c) === canonica) && e.implementos.includes(implemento),
  )?.porQue
}
