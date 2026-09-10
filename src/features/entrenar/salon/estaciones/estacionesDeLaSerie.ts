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

/** Los cuatro ángulos, repartidos en cruz alrededor del cuerpo. */
export const ANGULOS = { series: 45, reps: 135, descanso: 225, rir: 315 } as const

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
