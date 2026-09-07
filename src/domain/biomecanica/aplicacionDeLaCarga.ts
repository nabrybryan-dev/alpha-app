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
  /**
   * Categorías del catálogo de patrones, tal como las escribe `catalogo.ts`. Vacío si la
   * excepción se reconoce solo por el nombre.
   */
  categorias: readonly string[]
  /**
   * O el NOMBRE del ejercicio, que es donde esta casa escribe la prescripción. Hace falta
   * porque la categoría no siempre distingue: en la taxonomía antigua un hip thrust y un
   * peso muerto rumano son los dos «DOMINANTE DE CADERA» —uno la apoya en la pelvis y el
   * otro la lleva en las manos—, y «buenos días» y «peso muerto» son los dos bisagra.
   * Medido el 2026-09-06 sobre el seed: 16 de 25 ejercicios llevan categoría antigua, así
   * que una excepción que solo mire la categoría no dispara nunca para ellos.
   */
  nombres?: RegExp
  implementos: readonly Implemento[]
  aplicacion: Aplicacion
  porQue: string
}

/** Sin tildes ni mayúsculas, como `implementoDe`: el nombre se escribe de muchas formas. */
const normalizar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()

const EXCEPCIONES: readonly Excepcion[] = [
  {
    // Por el nombre y no por la categoría: en la taxonomía antigua comparte categoría con
    // el peso muerto rumano, que la lleva en las manos.
    categorias: [],
    nombres: /HIP THRUST|EMPUJE DE CADERA|PUENTE DE GLUTEO|ELEVACION DE CADERA/,
    implementos: SE_APOYAN,
    aplicacion: 'pelvis',
    porQue:
      'En un empuje de cadera la barra —o la mancuerna, o el disco— descansa sobre el ' +
      'pliegue de la cadera. Se reconoce por el nombre porque su categoría antigua, ' +
      '«dominante de cadera», es la misma que la del peso muerto rumano.',
  },
  {
    categorias: [],
    nombres: /SENTADILLA|SQUAT|BULGARA|ZANCADA|LUNGE|SPLIT SQUAT|BUENOS DIAS|GOOD MORNING/,
    implementos: ['barra', 'guiado-vertical'],
    aplicacion: 'hombros',
    porQue:
      'Sentadillas, zancadas, búlgaras y buenos días con barra —libre o en Smith— llevan la ' +
      'barra sobre el trapecio. Por el nombre, porque la categoría antigua «dominante de ' +
      'rodilla» no llega al modelo, y un buenos días comparte categoría con el peso muerto.',
  },
  {
    categorias: [],
    nombres: /(GEMELO|TALON|TALONES|PANTORRILLA|CALF).*(DE PIE|PARAD)|(DE PIE|PARAD).*(GEMELO|TALON|TALONES|PANTORRILLA|CALF)/,
    implementos: ['barra', 'guiado-vertical', 'maquina'],
    aplicacion: 'hombros',
    porQue:
      'La elevación de gemelo de pie carga sobre los hombros: la barra en el trapecio o las ' +
      'hombreras de la máquina. Sentado no entra aquí, ahí el acolchado va sobre las rodillas.',
  },
  {
    categorias: [],
    nombres: /PLANCHA|PLANK/,
    implementos: ['disco', 'mancuernas', 'barra'],
    aplicacion: 'espalda',
    porQue:
      'Una plancha con carga lleva el disco sobre la espalda: no hay mano libre que lo ' +
      'sostenga. Las manos están en el suelo.',
  },
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
    // EL RODILLO VA EN EL TOBILLO, y esto lo destapó una foto de Bryan del 2026-09-06: el
    // curl femoral tumbado salía con el brazo de la máquina llegando a las MANOS, o sea un
    // listón diagonal que atravesaba el cuerpo por la cadera. Es la aplicación por defecto
    // —`manos`— aplicada a un ejercicio donde las manos solo se agarran a los asideros.
    //
    // Va por nombre además de por categoría porque el curl femoral llega casi siempre con
    // categoría `AISLAMIENTO`, que no dice nada.
    categorias: ['FLEXIÓN DE RODILLA', 'EXTENSIÓN DE RODILLA'],
    nombres:
      /CURL FEMORAL|LEG CURL|FLEXION (DE )?RODILLA|EXTENSION (DE )?RODILLA|LEG EXTENSION|CUADRICEPS EN MAQUINA|PATADA DE GLUTEO|KICKBACK/,
    implementos: ['maquina', 'polea', 'polea-tobillera', 'guiado-vertical'],
    aplicacion: 'tobillo',
    porQue:
      'En un curl femoral o una extensión de rodilla el acolchado de la máquina empuja el ' +
      'TOBILLO: es el extremo de la palanca que gira, y por eso el brazo de la máquina se ' +
      'dibuja de la rodilla al tobillo. Las manos solo se agarran a los asideros para no ' +
      'despegar la cadera del apoyo.',
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
/** La excepción que aplica, si alguna: por nombre primero, por categoría después. */
function excepcionDe(categoria: string, implemento: Implemento, nombre: string): Excepcion | undefined {
  // La categoría llega a veces en su forma vieja —`DOMINANTE DE CADERA`— y a veces con
  // tildes o en minúsculas. Se compara por la canónica, como el resto de la casa.
  const canonica = categoriaCanonica(categoria) ?? categoria.toUpperCase().trim()
  const n = normalizar(nombre)
  return EXCEPCIONES.find((e) => {
    if (!e.implementos.includes(implemento)) return false
    if (e.nombres && n && e.nombres.test(n)) return true
    return e.categorias.some((c) => (categoriaCanonica(c) ?? c) === canonica)
  })
}

export function aplicacionDeLaCarga(
  categoria: string,
  implemento: Implemento | undefined,
  perfil: PerfilDeImplemento | undefined,
  nombre = '',
): Aplicacion {
  const porDefecto = perfil?.aplicacion ?? 'manos'
  if (!implemento) return porDefecto
  return excepcionDe(categoria, implemento, nombre)?.aplicacion ?? porDefecto
}

/** Por qué la carga de este ejercicio entra por ahí, si es una excepción. Para el aviso. */
export function porQueSeApoya(
  categoria: string,
  implemento: Implemento | undefined,
  nombre = '',
): string | undefined {
  if (!implemento) return undefined
  return excepcionDe(categoria, implemento, nombre)?.porQue
}
