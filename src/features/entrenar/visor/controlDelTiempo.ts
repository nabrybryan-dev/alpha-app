import { DURACION_CICLO, duracionDelCiclo, faseDeTiempo, type FaseDelCiclo, type TempoDeRepeticion } from '../../../domain/patrones/escena'

/**
 * EL TIEMPO DE LA DEMOSTRACIÓN: en qué punto del gesto está el sujeto ahora mismo.
 *
 * Es la única puerta por la que el visor pregunta la hora. Hasta el 2026-09-08 preguntaba
 * directamente a `domain/patrones/escena`, y por eso no había ningún sitio donde pausar la
 * repetición ni llevarla a una fase: el reloj del gesto vivía dentro del bucle de dibujo,
 * que solo se puede tocar montando WebGL.
 *
 * Aquí no hay aritmética nueva: la curva del ciclo —cuánto dura cada tramo, cómo se
 * suaviza la subida, el asentamiento— sigue siendo del dominio y se reexporta tal cual.
 * Lo que este módulo aporta es un SITIO: el mando del salón manda sobre estas funciones
 * (ver `salon/mando/`), y el visor no se entera de que existe un mando.
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

export { faseDeTiempo }
