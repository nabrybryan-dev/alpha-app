/**
 * Qué postura deja fijar la escala, medido — y cuál no la deja de ninguna manera.
 *
 * Un brazo de momento sale en milímetros, y para pasar de píxeles a milímetros
 * hay que anclar la imagen en algo de longitud conocida: la estatura, repartida
 * por los segmentos que se ven (`escalaPorEstatura`, en `coherencia.mjs`). Si
 * los segmentos no se ven **en su longitud real**, ese ancla no existe y los
 * milímetros son un número inventado con cara de medida.
 *
 * ## Lo que se midió, y lo que corrigió
 *
 * El 2026-08-26 se pasaron **61 vídeos** por `coherencia.mjs`. El resultado
 * corrige lo que parecía obvio: **la compresión de WhatsApp NO es el cuello de
 * botella**. Tres vídeos con el mismo bitrate (10 Mbps) dieron 18, 43 y 44 %, y
 * los únicos que funcionaron son los de MENOR resolución de todos (480×854).
 *
 * Lo que manda es cuánto del cuerpo se ve en su longitud real. Y la dispersión
 * **no depende de la estatura que se asuma** —sale idéntica con 160, 174 y
 * 190 cm—, así que mide geometría y no el ancla.
 *
 * ## Por qué vive en el dominio y no en un documento
 *
 * Estuvo en `SIN-GIMNASIO.md` y en la cabeza de quien grabó. Un documento no
 * puede negarse: la cadena de medida cogía igual un press de banca, gastaba el
 * minuto de CPU y devolvía milímetros que ningún guardián posterior podía
 * distinguir de los buenos —porque el fallo no está en el vídeo, está en que
 * ese ejercicio no se puede medir así con ninguna cámara—.
 */

/**
 * Por encima de esto la escala no vale.
 *
 * No es un criterio nuevo: es **el mismo 0,15 que aplica `coherencia.mjs`** al
 * decidir `fiable`, y de ahí lo hereda `brazo-por-fotograma.mjs`. Está aquí
 * escrito para poder contrastar la tabla de abajo contra él, no para decidirlo
 * por segunda vez. Si allí cambia, esto miente.
 */
export const UMBRAL_DISPERSION_FIABLE = 0.15

export type Postura = 'de-pie-de-lado' | 'de-pie-escorzo' | 'apoyado-a-media-altura' | 'tumbado'

export interface MedidaDePostura {
  /** Cómo se ve en el vídeo, en las palabras de quien graba. */
  descripcion: string
  /** Dispersión de la escala entre segmentos, medida el 2026-08-26. */
  dispersion: number
  /** El caso del corpus del que salió el número. */
  ejemplo: string
}

/**
 * La tabla medida. Cuatro filas y ni una más: son las cuatro posturas que
 * aparecieron en los 61 vídeos, con su número. Añadir una que nadie ha medido
 * sería devolverle a esto la autoridad de una opinión.
 */
export const MEDIDO_EN_EL_CORPUS: Readonly<Record<Postura, MedidaDePostura>> = {
  'de-pie-de-lado': {
    descripcion: 'de pie, de lado y con el cuerpo entero en cuadro',
    dispersion: 0.15,
    ejemplo: 'remo con barra — el único vídeo fiable de los 61, y la primera medida limpia del proyecto',
  },
  'de-pie-escorzo': {
    descripcion: 'de pie, pero girado respecto a la cámara',
    dispersion: 0.3,
    ejemplo: 'los que salieron entre 29 y 31 %: de pie con escorzo parcial',
  },
  'apoyado-a-media-altura': {
    descripcion: 'sentado o apoyado en una máquina, con el cuerpo a media altura',
    dispersion: 0.45,
    ejemplo: 'máquinas del corpus, con parte de la pierna fuera de cuadro o tapada',
  },
  tumbado: {
    descripcion: 'tumbado en un banco',
    dispersion: 5.41,
    ejemplo: 'press de banca y press inclinado: los segmentos apuntan a la cámara y no hay longitud que medir',
  },
}

/** Las cuatro, para ofrecerlas y para comprobar lo que llega de fuera. */
export const POSTURAS = Object.keys(MEDIDO_EN_EL_CORPUS) as readonly Postura[]

/**
 * `true` si ese texto es una de las cuatro posturas medidas.
 *
 * Existe porque la postura llega escrita a mano en una línea de comandos, y una
 * postura mal escrita no puede caer en la fila buena: `--postura tumbada` con
 * una `a` de más tiene que parar la medida, no colarse como «no declarada» y
 * dejar pasar el press de banca que este módulo existe para frenar.
 */
export function esPostura(texto: string | undefined): texto is Postura {
  return texto !== undefined && texto in MEDIDO_EN_EL_CORPUS
}

export type NivelDeEscala = 'fiable' | 'orientativa' | 'imposible'

/**
 * Por encima de esta dispersión no es que la medida salga mal: es que no sale.
 *
 * El corte está donde el número deja de tener nada que ver con el cuerpo. Un
 * 45 % es una medida mala que aún ordena —sirve para comparar la misma persona
 * consigo misma—; un 541 % es que el ancla no existe.
 */
const DISPERSION_IMPOSIBLE = 1

export interface VeredictoDeEscala {
  nivel: NivelDeEscala
  /** La frase que se le dice a quien va a grabar, antes de que grabe. */
  porQue: string
}

/** Qué se puede esperar de la escala en esa postura, y por qué. */
export function fiabilidadDeEscala(postura: Postura): VeredictoDeEscala {
  const { descripcion, dispersion, ejemplo } = MEDIDO_EN_EL_CORPUS[postura]
  const pct = `${Math.round(dispersion * 100)} %`

  if (dispersion >= DISPERSION_IMPOSIBLE) {
    return {
      nivel: 'imposible',
      porQue:
        `Grabado ${descripcion}, la escala dispersó un ${pct} en el corpus (${ejemplo}). ` +
        'No es un vídeo malo: es que este método no puede medir ahí con ninguna cámara. ' +
        `Lo que sí se puede: ${COMO_GRABAR}`,
    }
  }

  if (dispersion > UMBRAL_DISPERSION_FIABLE) {
    return {
      nivel: 'orientativa',
      porQue:
        `Grabado ${descripcion}, la escala dispersó un ${pct} en el corpus, por encima del ` +
        `${Math.round(UMBRAL_DISPERSION_FIABLE * 100)} % que la da por fiable. Los milímetros ` +
        'sirven para comparar esta persona consigo misma, no para dar una cifra. ' +
        `Lo que sí se puede: ${COMO_GRABAR}`,
    }
  }

  return {
    nivel: 'fiable',
    porQue: `Grabado ${descripcion}, la escala se sostuvo (${pct} de dispersión).`,
  }
}

/**
 * La regla de grabar, en una frase.
 *
 * Sale de la única fila que se sostuvo. Los patrones que la admiten son los de
 * pie: peso muerto, remo, sentadilla, hip thrust. Y si hay un disco de 450 mm a
 * la vista, mejor todavía: `disco.js` corrige la perspectiva con un diámetro
 * conocido en vez de anclar en la estatura.
 */
export const COMO_GRABAR = 'de pie, de lado y con el cuerpo entero en cuadro.'
