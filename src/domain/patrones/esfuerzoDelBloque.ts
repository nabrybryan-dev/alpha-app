import type { Patron } from './catalogo'
import type { Pose } from './esqueleto'

/**
 * A QUÉ RITMO SE HACE ESTE CARDIO, Y CÓMO SE VE ESO EN EL CUERPO.
 *
 * Hasta hoy un trote suave de zona 2 y un intervalo a RPE 8 se veían EXACTAMENTE IGUAL: la
 * misma zancada, a la misma cadencia, con la misma amplitud. La única diferencia estaba en
 * una cifra del muro. Bryan, 2026-09-10: «que se vea cuándo corre lento o intenso o camina».
 *
 * ## El esfuerzo sale de lo que el coach escribió, y si no escribió nada no se inventa
 *
 * `undefined` significa «no dijo», y entonces la ficha se anima tal cual está escrita. No
 * hay un esfuerzo por defecto escondido: un trote sin ritmo escrito no puede parecer suave
 * ni fuerte, porque nadie lo dijo.
 *
 * ## Qué se mueve con el esfuerzo, y de dónde salen los números
 *
 * De medidas publicadas de carrera a distintas velocidades, no de ajustar a ojo:
 *
 * - **la cadencia** sube con la velocidad, y es lo primero que se nota de lejos;
 * - **la rodilla de la pierna que recoge** es el cambio más grande y más visible: su flexión
 *   máxima crece unos 15° entre correr despacio y correr rápido (62,6° → 77,1° medidos);
 * - **la cadera de la pierna de atrás** extiende unos 4,5° más en la fase de vuelo entre el
 *   85 % y el 130 % de la velocidad libre;
 * - **la cadera de la pierna que llega** casi no cambia: alrededor de 1° por escalón de
 *   velocidad. Así que se mueve poco, y por eso el número es pequeño.
 *
 * Fuentes en `docs/specs/2026-09-10-el-ritmo-se-ve-en-el-cuerpo.md`.
 *
 * ## En una máquina se mueve la cadencia y NADA MÁS
 *
 * Y esto es lo que hace que no sea un efecto: en una bicicleta, una elíptica o una
 * escaladora **el recorrido lo fija el aparato**. Pedalear fuerte es pedalear más rápido y
 * apretar más, no describir un círculo más grande: el pedal no se sale de su eje. Estirar
 * las amplitudes ahí sería dibujar una máquina que no existe. Correr y caminar son lo
 * contrario: la pierna está libre y la amplitud es justo lo que cambia.
 */

/** 0 es lo más suave que se prescribe y 1 lo más fuerte. `0,5` es la ficha tal como está escrita. */
export type Esfuerzo = number

/** El RPE o la zona escritos, de 1 a 10 y de 1 a 5. */
const RPE = /\brpe\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?/i
const ZONA = /\bzona\s*([1-5])\b|\bz([1-5])\b/i

/**
 * Palabras que dicen el ritmo cuando no hay número.
 *
 * Van de más suave a más fuerte y se quedan con la ÚLTIMA que aparece, no con la primera:
 * «10 × 1 min fuerte / 1 min suave» habla de las dos mitades del intervalo, y lo que define
 * el bloque es su parte dura — es un bloque de intervalos, no un paseo.
 */
const PALABRAS: readonly { patron: RegExp; esfuerzo: Esfuerzo }[] = [
  { patron: /muy suave|regenerativ|recuperaci[oó]n activa/, esfuerzo: 0.1 },
  { patron: /suave|conversacional|puedas hablar|estado estable|continuo/, esfuerzo: 0.3 },
  { patron: /sostenid|constante|moderad/, esfuerzo: 0.5 },
  { patron: /fuerte|intervalo|r[aá]pido|intens/, esfuerzo: 0.8 },
  { patron: /a tope|m[aá]ximo|sprint|todo lo que/, esfuerzo: 1 },
]

const acotar = (v: number) => Math.max(0, Math.min(1, v))

/**
 * El esfuerzo escrito en un texto, o `undefined` si no dice nada.
 *
 * El número manda sobre la palabra: «zona 2, a ritmo fuerte al final» es una zona 2. Y de un
 * rango («RPE 7-8») se queda con el techo, que es el que marca el bloque.
 */
export function esfuerzoDeTexto(texto: string): Esfuerzo | undefined {
  const rpe = RPE.exec(texto)
  if (rpe) {
    const alto = Number(rpe[2] ?? rpe[1])
    // RPE 5 es «podrías hablar» y RPE 10 es no poder más. Por debajo de 4 el trabajo no se
    // prescribe casi nunca, así que la escala útil va de 4 a 10 y se estira a 0..1.
    return acotar((alto - 4) / 6)
  }
  const zona = ZONA.exec(texto)
  if (zona) {
    const z = Number(zona[1] ?? zona[2])
    // Las cinco zonas aeróbicas clásicas. La 2 —la de andar hablando— cae en 0,25.
    return acotar((z - 1) / 4)
  }
  let encontrado: Esfuerzo | undefined
  for (const p of PALABRAS) if (p.patron.test(texto)) encontrado = p.esfuerzo
  return encontrado
}

/** Cuánto se acelera o se frena la cadencia entre lo más suave y lo más fuerte. */
const CADENCIA = 0.28

/** Grados que gana la flexión de la rodilla que recoge, de suave a fuerte. */
const RODILLA = 30

/** Grados que gana la extensión de la cadera de atrás, de suave a fuerte. */
const CADERA_ATRAS = 9

/** Grados que gana la flexión de la cadera que llega. Es pequeño, y así está medido. */
const CADERA_DELANTE = 4

/** Por debajo de esto una flexión de rodilla no es la pierna que recoge, sino la que apoya. */
const RECOGE_DESDE = 55

function conAmplitud(pose: Pose, d: number): Pose {
  const salida: Pose = { ...pose }
  for (const [clave, valor] of Object.entries(pose)) {
    if (typeof valor !== 'number') continue
    if (clave.startsWith('rodillaFlex')) {
      // Solo la pierna que RECOGE. La que apoya está casi estirada y estirarla más la
      // rompería hacia atrás; encogerla haría cojear.
      salida[clave as keyof Pose] = valor >= RECOGE_DESDE ? valor + d * RODILLA : valor
    } else if (clave.startsWith('caderaFlex')) {
      // Negativo es cadera extendida —la pierna de atrás—, positivo es la que llega.
      salida[clave as keyof Pose] = valor < 0 ? valor - d * CADERA_ATRAS : valor + d * CADERA_DELANTE
    }
  }
  return salida
}

/**
 * La ficha, animada al ritmo que el coach escribió.
 *
 * Devuelve el MISMO objeto cuando no hay nada que cambiar —sin esfuerzo escrito, o sin
 * ciclo—, y eso importa: el visor monta su escena WebGL con la ficha como dependencia, así
 * que devolver una copia nueva en cada llamada recrearía el contexto entero.
 *
 * @param esfuerzo 0 lo más suave, 1 lo más fuerte, 0,5 la ficha tal como está escrita.
 */
export function patronConEsfuerzo(patron: Patron, esfuerzo: Esfuerzo | undefined): Patron {
  if (esfuerzo === undefined || !patron.ciclo || patron.ciclo.periodoSeg <= 0) return patron
  const d = acotar(esfuerzo) - 0.5
  if (d === 0) return patron

  const periodoSeg = patron.ciclo.periodoSeg * (1 - d * CADENCIA)
  const ciclo = { ...patron.ciclo, periodoSeg }
  if (patron.ciclo.empujeSeg) ciclo.empujeSeg = patron.ciclo.empujeSeg * (periodoSeg / patron.ciclo.periodoSeg)

  // En una máquina el recorrido lo fija el aparato: solo cambia la cadencia.
  if (!laPiernaVaLibre(patron)) return { ...patron, ciclo }

  return { ...patron, ciclo, inicio: conAmplitud(patron.inicio, d), fin: conAmplitud(patron.fin, d) }
}

/** Correr y caminar tienen la pierna libre; una bici, una elíptica o un remo, no. */
function laPiernaVaLibre(patron: Patron): boolean {
  return patron.id.startsWith('carrera') || patron.id.startsWith('caminata')
}
