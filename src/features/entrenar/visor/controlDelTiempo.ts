import {
  DURACION_CICLO,
  duracionDelCiclo,
  faseDeTiempo as faseDelCiclo,
  type FaseDelCiclo,
  type TempoDeRepeticion,
} from '../../../domain/patrones/escena'
import type { Patron } from '../../../domain/patrones/catalogo'

/**
 * EL TIEMPO DE LA DEMOSTRACIÓN: en qué punto del gesto está el sujeto ahora mismo, y
 * quién manda sobre eso.
 *
 * Es la única puerta por la que el visor pregunta la hora. Hasta el 2026-09-08 preguntaba
 * directamente a `domain/patrones/escena`, y por eso no había ningún sitio donde pausar la
 * repetición ni llevarla a una fase: el reloj del gesto vivía dentro del bucle de dibujo,
 * que solo se puede tocar montando WebGL.
 *
 * Aquí no hay aritmética del ciclo: cuánto dura cada tramo, cómo se suaviza la subida y el
 * asentamiento siguen siendo del dominio. Lo que este módulo añade es un MANDO —pausar, ir
 * a una fase, cambiar la velocidad— y un sitio donde ese mando vive.
 *
 * ## Esto no es el reloj de la pared
 *
 * El salón tiene otro reloj —el del muro— que cuenta la sesión y el descanso
 * (`salon/mando/relojDelMuro.ts`). Son dos tiempos distintos y no se tocan: el descanso
 * cuenta minutos de una serie a otra y esto cuenta segundos DENTRO de una repetición.
 * Pausar la demostración no para el descanso, y el descanso no para la demostración.
 *
 * ## Por qué el estado es de módulo y no de React
 *
 * Quien lo escribe es un manejador de puntero y quien lo lee es un bucle de
 * `requestAnimationFrame` dentro de un efecto que crea el contexto WebGL: ahí no hay
 * estado de React que valga —un `setState` por cada `pointermove` re-renderiza el salón
 * entero mientras el dedo se mueve—. Es el mismo almacén de tres líneas que ya usa
 * `piezas.ts` para anunciar la sala de Blender, y por el mismo motivo.
 */

export { DURACION_CICLO, duracionDelCiclo, type FaseDelCiclo, type TempoDeRepeticion }

/** Cuántos puntos se prueban al buscar el tiempo de una fase. Ver `tiempoDeLaFase`. */
const MUESTRAS_DE_BUSQUEDA = 480

interface MandoDelTiempo {
  /** La demostración está parada: el sujeto se queda en el fotograma en el que estaba. */
  pausada: boolean
  /** La fase que manda el dedo mientras recorre. `undefined` = no la manda nadie. */
  fase: number | undefined
  /** Hacia dónde iba la última fase mandada: +1 subiendo, −1 bajando. */
  sentido: number
  /** Multiplicador del reloj del gesto. 1 = el tempo prescrito. */
  velocidad: number
  /** Segundos que se le suman al reloj del visor para que reanudar no dé un salto. */
  desfase: number
  /** El instante del visor con el que se preguntó la última vez, en segundos. */
  ultimoT: number
  /** Dónde se quedó el reloj del gesto al pausar. */
  congelado: number
  /** El último patrón y tempo con los que se preguntó: el mando no los conoce de otra. */
  patron: Patron | undefined
  tempo: TempoDeRepeticion | undefined
}

const mando: MandoDelTiempo = {
  pausada: false,
  fase: undefined,
  sentido: 1,
  velocidad: 1,
  desfase: 0,
  ultimoT: 0,
  congelado: 0,
  patron: undefined,
  tempo: undefined,
}

/** El reloj del gesto en este instante del visor, con la velocidad y el desfase puestos. */
const relojDelGesto = (t: number) => mando.desfase + t * mando.velocidad

/**
 * EN QUÉ FASE ESTÁ EL GESTO en el instante `t` del visor.
 *
 * Sin nadie tocando el mando es exactamente la función del dominio: mismo ciclo, misma
 * curva, mismo asentamiento. Con el mando puesto manda el mando, y esa es toda la
 * diferencia.
 */
export function faseDeTiempo(t: number, patron?: Patron, tempo?: TempoDeRepeticion): FaseDelCiclo {
  mando.ultimoT = t
  mando.patron = patron
  mando.tempo = tempo
  // Recorriendo a dedo: el sentido es hacia dónde va el DEDO, no dónde está el reloj. De
  // eso dependen los músculos que se pintan trabajando, así que no puede quedar fijo.
  if (mando.fase !== undefined) return { fase: mando.fase, sentido: mando.sentido }
  if (mando.pausada) return faseDelCiclo(mando.congelado, patron, tempo)
  return faseDelCiclo(relojDelGesto(t), patron, tempo)
}

/**
 * PAUSAR LA DEMOSTRACIÓN, dejándola en el fotograma en el que está.
 *
 * Se guarda el RELOJ y no la fase: la fase sola no dice si el sujeto iba subiendo o
 * bajando, y al reanudar habría que adivinarlo. Con el reloj congelado, reanudar es
 * mover el desfase y seguir por donde iba.
 */
export function pausarLaRepeticion(): void {
  if (mando.pausada) return
  mando.congelado = relojDelGesto(mando.ultimoT)
  mando.pausada = true
}

/**
 * LLEVAR LA DEMOSTRACIÓN A UNA FASE, de 0 (arriba) a 1 (abajo del recorrido).
 *
 * Pausa si no lo estaba: recorrer y reproducir a la vez es enseñar dos gestos.
 */
export function irALaFase(fase: number): void {
  if (!Number.isFinite(fase)) return
  pausarLaRepeticion()
  const nueva = Math.min(1, Math.max(0, fase))
  if (mando.fase !== undefined && nueva !== mando.fase) mando.sentido = nueva > mando.fase ? 1 : -1
  mando.fase = nueva
}

/**
 * SEGUIR, desde donde el dedo la dejó y sin dar un salto.
 *
 * Del tiempo del ciclo que corresponde a la fase que se mandó se resta el reloj del visor:
 * lo que queda es el desfase con el que el gesto continúa desde ahí.
 */
export function reanudarLaRepeticion(): void {
  if (mando.fase !== undefined) {
    mando.congelado = tiempoDeLaFase(mando.fase, mando.patron, mando.tempo)
    mando.fase = undefined
  }
  if (mando.pausada) {
    mando.desfase = mando.congelado - mando.ultimoT * mando.velocidad
    mando.pausada = false
  }
}

/** Si la demostración está parada ahora mismo. */
export function repeticionPausada(): boolean {
  return mando.pausada
}

/** La fase que manda el dedo, o `undefined` si no la manda nadie. */
export function faseDelMando(): number | undefined {
  return mando.fase
}

/**
 * EN QUÉ FASE ESTÁ LA DEMOSTRACIÓN AHORA MISMO, sin preguntarle al bucle de dibujo.
 *
 * La usa el mando para empezar a recorrer DONDE ESTÁ el sujeto: sin esto, el primer píxel
 * de dedo lo teletransportaría al principio del gesto. Se calcula con el último instante
 * con el que el visor preguntó la hora; si nadie ha preguntado nunca —no hay WebGL, o el
 * salón acaba de abrir— sale la fase de arranque, que es donde está el sujeto.
 */
export function faseAhora(): number {
  if (mando.fase !== undefined) return mando.fase
  const reloj = mando.pausada ? mando.congelado : relojDelGesto(mando.ultimoT)
  return faseDelCiclo(reloj, mando.patron, mando.tempo).fase
}

/**
 * A QUÉ VELOCIDAD CORRE LA DEMOSTRACIÓN. 1 es el tempo prescrito; 0,5, la mitad.
 *
 * El cambio no da un salto: se recoloca el desfase para que el instante actual siga
 * cayendo en la misma fase y a partir de ahí el reloj corra a la nueva velocidad.
 */
export function ponerLaVelocidad(velocidad: number): void {
  if (!Number.isFinite(velocidad) || velocidad <= 0) return
  const ahora = relojDelGesto(mando.ultimoT)
  mando.velocidad = velocidad
  mando.desfase = ahora - mando.ultimoT * velocidad
}

/** La velocidad puesta. */
export function laVelocidad(): number {
  return mando.velocidad
}

/**
 * Devuelve el mando a su sitio: reproduciendo, a velocidad 1 y sin fase mandada.
 *
 * Existe para las pruebas y para cuando el salón se cierra: el mando es de módulo, así que
 * lo que uno deje puesto se lo encuentra el siguiente.
 */
export function soltarElTiempo(): void {
  mando.pausada = false
  mando.fase = undefined
  mando.sentido = 1
  mando.velocidad = 1
  mando.desfase = 0
  mando.congelado = 0
}

/**
 * EL TIEMPO DEL CICLO EN EL QUE EL GESTO ESTÁ EN ESA FASE.
 *
 * Es la vuelta de `faseDeTiempo`, y se resuelve probando: la curva del ciclo no es
 * invertible a mano —lleva una tabla de avance, un suavizado y un asentamiento amortiguado
 * (`domain/patrones/escena.ts`)— y escribir su inversa sería escribirla dos veces, que es
 * como se separan. Con 480 muestras sobre un ciclo de unos cuatro segundos, cada paso son
 * ocho milisegundos: por debajo de lo que se ve.
 */
export function tiempoDeLaFase(fase: number, patron?: Patron, tempo?: TempoDeRepeticion): number {
  const duracion = duracionDelCiclo(tempo)
  let mejorT = 0
  let mejorError = Infinity
  for (let i = 0; i < MUESTRAS_DE_BUSQUEDA; i++) {
    const t = (i / MUESTRAS_DE_BUSQUEDA) * duracion
    const error = Math.abs(faseDelCiclo(t, patron, tempo).fase - fase)
    if (error < mejorError) {
      mejorError = error
      mejorT = t
    }
  }
  return mejorT
}
