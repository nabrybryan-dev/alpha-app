import { esAlFallo } from '../../../../domain/objetivoDeIntensidad'
import type { EjercicioPrescrito } from '../../../../domain/types'

/**
 * LAS CUATRO ESTACIONES: la prescripción deja de estar colgada de la pared y pasa a
 * rodear al sujeto.
 *
 * ## Por qué esto no usa el proyector de los cuadros
 *
 * Un cuadro de pared se coloca con `proyectarCuadro`, que lo pasa por la MISMA cámara que
 * dibuja la sala. Tiene que ser así: un cuadro está clavado en un muro y si su cámara y la
 * de la escena discreparan medio grado, flotaría.
 *
 * Una estación no está en ningún muro. Está alrededor del cuerpo, y eso tiene una
 * consecuencia medida el 2026-09-04: la ventana horizontal del salón son **12,18°**, así
 * que un cartel colocado a 45° de azimut en el espacio de la sala cae en **x = 523 de una
 * pantalla de 390**, en cualquier radio entre 1,0 y 3,2 m. En corro, con la cámara de la
 * sala, las cuatro se salen. No es un ajuste: es la geometría de una rendija de 12°.
 *
 * Así que las estaciones viven en el espacio del SUJETO, no en el de los muros: su sitio
 * sale del centro del cuerpo y un radio en píxeles, y lo que las ata a la sala es el
 * AZIMUT —giran con la cámara, se apagan las de la espalda, las de atrás se encogen—. Es
 * lo que hace que orbitar las mueva como objetos y no como una interfaz pegada al cristal.
 *
 * ## Las cifras entran, se leen y se retiran
 *
 * Y eso no es una animación bonita: **es el mecanismo que mantiene el salón despejado.**
 * La prescripción se lee una vez, al llegar al ejercicio; el resto del tiempo lo que queda
 * es el poste con su base, que no tapa nada. Un número permanente alrededor del cuerpo
 * sería otra vez el dashboard con un muñeco dentro.
 *
 * Tocar una estación la deja fija: es la única forma de volver a mirar un dato sin esperar
 * a que el ciclo lo repita.
 */

/**
 * Los cuatro ángulos, repartidos en cruz alrededor del cuerpo.
 *
 * Y los tres del cardio, que son los MISMOS sitios con otro contenido: un día de cardio
 * tiene sujeto desde el 2026-09-07 y su prescripción vive donde vive siempre, alrededor del
 * cuerpo. Van aquí y no en `estacionesDelCardio.ts` para que exista un único mapa de dónde
 * se planta un poste: dos listas de ángulos se separan al primer ajuste y el salón acabaría
 * con estaciones en cinco sitios.
 */
export const ANGULOS = {
  series: 45,
  reps: 135,
  descanso: 225,
  rir: 315,
  minutos: 45,
  tramos: 135,
  intensidad: 315,
} as const

export type ClaveDeEstacion = keyof typeof ANGULOS

export interface EstacionDeLaSerie {
  clave: ClaveDeEstacion
  /** Grados de esta estación alrededor del sujeto. */
  angulo: number
  rotulo: string
  /** La cifra sola. Sin unidad y sin rango: los dos parten la línea. */
  cifra: string
  /** La línea de contexto de debajo. */
  pie: string
}

/**
 * LO QUE DICE CADA ESTACIÓN, sacado del ejercicio.
 *
 * La de series cambia de texto en cuanto hay algo registrado: pasa de decir lo PAUTADO a
 * decir lo HECHO sobre lo pautado. Es la única de las cuatro que se mueve durante el
 * ejercicio, y por eso es la que acusa que se guardó una serie.
 */
export function estacionesDeLaSerie(
  ejercicio: EjercicioPrescrito | undefined,
): EstacionDeLaSerie[] {
  if (!ejercicio) return []
  const hechas = ejercicio.series.length
  const objetivo = ejercicio.rirObjetivo
  const alFallo = esAlFallo(objetivo)
  const rango = ejercicio.rango?.trim()

  return [
    {
      clave: 'series',
      angulo: ANGULOS.series,
      rotulo: 'Series',
      cifra: hechas > 0 ? `${hechas}/${ejercicio.sets}` : String(ejercicio.sets),
      pie: hechas > 0 ? `registradas de ${ejercicio.sets}` : 'bloques de trabajo',
    },
    {
      clave: 'reps',
      angulo: ANGULOS.reps,
      rotulo: 'Repeticiones',
      cifra: String(ejercicio.repsDiana),
      pie: rango ? `por serie, dentro de ${rango}` : 'por serie',
    },
    {
      clave: 'descanso',
      angulo: ANGULOS.descanso,
      rotulo: 'Descanso',
      cifra: String(ejercicio.descansoMin).replace('.', ','),
      pie: 'minutos, cronometrados',
    },
    {
      clave: 'rir',
      angulo: ANGULOS.rir,
      // `FALLO` no es un RIR y no se rotula como tal: es la instrucción de meterse en la
      // repetición que se queda a medias, y `RIR 0` es justo la anterior.
      rotulo: alFallo ? 'Intensidad' : 'RIR',
      cifra: alFallo ? 'FALLO' : String(objetivo),
      pie: alFallo ? 'hasta que no salga entera' : 'repeticiones que te guardas',
    },
  ]
}

/** Cómo se ve una estación desde donde está la cámara ahora mismo. */
export interface AspectoDeEstacion {
  /** Desplazamiento horizontal respecto al centro del sujeto, en píxeles. */
  x: number
  /** Cuánto se levanta sobre su base, en píxeles. Las de atrás flotan por encima. */
  alza: number
  /** 0,32 de espaldas, 1 de frente. */
  opacidad: number
  /** 0,68 de espaldas, 1 de frente. */
  escala: number
  /** Cuánto de frente está: 1 delante, −1 detrás. Ordena la profundidad. */
  frente: number
}

/**
 * DÓNDE Y CÓMO CAE UNA ESTACIÓN, dado el azimut de la cámara.
 *
 * Los tres valores que cambian por fotograma salen del mismo coseno, y cada uno resuelve
 * un problema distinto:
 *
 * - **la opacidad** apaga las de la espalda, que si no competirían con las de delante;
 * - **la escala** las encoge, que es lo que las manda al fondo sin dibujar perspectiva;
 * - **el alza** las levanta por encima de las de delante. Sin ella, la de atrás y la de
 *   delante caen en el mismo punto de la pantalla cuando el azimut las alinea, y se
 *   escriben una encima de la otra.
 *
 * @param radio Cuántos píxeles separan la estación del eje del cuerpo.
 */
export function aspectoDeEstacion(
  angulo: number,
  azimutDeCamara: number,
  radio: number,
): AspectoDeEstacion {
  const radianes = ((angulo + azimutDeCamara) * Math.PI) / 180
  const frente = Math.cos(radianes)
  return {
    x: Math.sin(radianes) * radio,
    alza: frente < 0 ? -frente * 110 : 0,
    opacidad: 0.32 + (0.68 * (frente + 1)) / 2,
    escala: 0.68 + (0.32 * (frente + 1)) / 2,
    frente,
  }
}

/** Lo ancho que es la zona sensible de un poste: un dedo. El poste dibujado son 2 px. */
export const ANCHO_TOCABLE_DEL_POSTE = 56

/**
 * LO ALTO QUE ES ESA ZONA, y por qué son 52 px y no el poste entero.
 *
 * Desde el 2026-09-11 el poste ES el botón: la cifra se retira sola y el poste es lo que
 * queda para traerla de vuelta. Eso convirtió en un fallo algo que antes solo era un
 * dibujo: **los cuatro postes están en cruz alrededor del cuerpo, así que la cámara los
 * alinea de dos en dos cuatro veces por vuelta**, y dos zonas sensibles en el mismo sitio
 * son una sola —la de delante se come el toque de la de atrás, que se queda inalcanzable
 * aunque se vea, porque la de atrás nunca baja del 32 % de opacidad—. Medido en el salón el
 * 2026-09-11 con `elementFromPoint` en el centro exacto de cada poste: en **6 de las 13
 * posiciones de cámara** al menos un poste no recibía su propio toque, y en tres de ellas
 * eran dos de los cuatro.
 *
 * El remedio ya existía y no le había llegado: **el alza**, que levanta las estaciones de
 * la espalda por encima de las de delante y que hasta ahora solo movía el cartel. Aplicada
 * al poste entero —poste, base y cartel suben juntos, que es además la perspectiva
 * correcta: lo que está más lejos se dibuja más arriba—, dos postes que comparten columna
 * quedan siempre separados en vertical.
 *
 * Cuánto, exactamente: barriendo la vuelta entera, **cuando dos postes están a menos de 56
 * px en horizontal el alza los separa como mínimo 52,3 px en vertical**. Así que con la
 * zona sensible a 56 × 52 no pueden solaparse NUNCA — no es que no se haya visto pasar, es
 * que no cabe—. Sigue por encima de los 44 × 44 que pide cualquier guía de táctil.
 *
 * Por eso la zona no es el poste entero (148 px): a lo alto del poste no le sobra sitio.
 * Se queda con el pie —la base y el arranque—, que es la parte que se lee como plantada en
 * el suelo y donde va el pulgar.
 */
export const ALTO_TOCABLE_DEL_POSTE = 52

/** Cuánto baja la zona sensible por debajo del punto donde el poste toca el suelo. */
const VUELO_DEL_POSTE = 14

/**
 * DÓNDE SE PUEDE TOCAR UN POSTE, en píxeles y respecto al eje del cuerpo a ras de suelo.
 *
 * Vive aquí, junto a `aspectoDeEstacion`, y no en el componente, porque es la única forma
 * de que una prueba pueda barrer la vuelta entera y comprobar que dos postes no comparten
 * zona. Medir esto en el DOM no vale: en jsdom todos los rectángulos son cero.
 *
 * `y` crece hacia abajo y el suelo es el cero, igual que en la pantalla.
 */
export function cajaTocableDelPoste(
  angulo: number,
  azimutDeCamara: number,
  radio: number,
): { x0: number; x1: number; y0: number; y1: number } {
  const { x, alza } = aspectoDeEstacion(angulo, azimutDeCamara, radio)
  const abajo = VUELO_DEL_POSTE - alza
  return {
    x0: x - ANCHO_TOCABLE_DEL_POSTE / 2,
    x1: x + ANCHO_TOCABLE_DEL_POSTE / 2,
    y0: abajo - ALTO_TOCABLE_DEL_POSTE,
    y1: abajo,
  }
}
