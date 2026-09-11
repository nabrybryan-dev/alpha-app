import { M4, grados, type Vec3 } from '../../../domain/patrones/algebra'
import { CAMPO_VISUAL, esqueletoEnFase } from '../../../domain/patrones/escena'
import { puntoDeHueso } from '../../../domain/patrones/esqueleto'
import type { Patron } from '../../../domain/patrones/catalogo'
import { ENCUADRE_SALA, elevacionDelSalon } from './sala'

/**
 * EL CUADRO DEL SALÓN SE CALCULA CONTRA EL CUERPO QUE HAY QUE ENCUADRAR.
 *
 * Hasta el 2026-09-05 la cámara del salón miraba SIEMPRE al mismo punto —`ENCUADRE_SALA`:
 * 4,6 m de distancia, mirando a [0, 1,2, 0]— porque ese punto encuadra bien a una persona
 * DE PIE. Y el catálogo no son solo personas de pie. Bryan lo vio en la demo: en el press
 * de pecho en máquina solo asomaban las manos arriba y los pies abajo.
 *
 * Medido con la cámara real del salón sobre los 31 patrones, proyectando el esqueleto en
 * tres fases a una pantalla de 390×844: **se salían del cuadro los 31**, entre 21 px el
 * mejor y 750 px el peor (la flexión de rodilla tumbado). No era «el press está roto»: era
 * que nadie comprobaba el encuadre contra el cuerpo.
 *
 * ## Lo que se sale es SIEMPRE por los lados
 *
 * También medido, y explica el resto: el cuadro es alto y estrecho. Con 26° de campo
 * VERTICAL en una pantalla de 390×844, el campo horizontal son 12,2°, que a 4,6 m es menos
 * de un metro de ancho. Un cuerpo tumbado mide 1,8. Ninguno de los 31 se salía por arriba
 * ni por abajo: los 31 se salían de lado.
 *
 * ## Las tres palancas, de menos a más invasiva
 *
 * 1. **Mirar al centro del cuerpo** en vez de a un punto fijo que da por hecho que hay
 *    alguien de pie. Es gratis y no cambia nada de lo que se ve.
 * 2. **Retirarse lo justo**, y nunca más de 6,3 m: la sala tiene 7 m de radio y una cámara
 *    más atrás estaría fuera de la habitación, mirando su pared por detrás.
 * 3. **Ensanchar el objetivo**, y solo lo que falte. Como sobra sitio por arriba y por
 *    abajo y falta por los lados, un campo más ancho da anchura a costa de un cuerpo más
 *    pequeño, que es el canje bueno aquí. No mueve la cámara, así que no puede sacarla de
 *    la sala ni meterla donde el mobiliario tape al sujeto.
 *
 * ## Girar está DESCARTADO, y por una foto
 *
 * La cuarta palanca evidente era girar el azimut, y los números decían que funcionaba: el
 * press pasaba de 316 px fuera a 17. **La foto decía otra cosa.** Girar −35° pone la cámara
 * casi de frente, y ahí la máquina se planta delante de la persona: en la captura solo
 * asomaban los brazos por detrás de una plancha gris. Ya estaba avisado —«la estación se
 * representa, no se enseña», 2026-09-03— y el número no lo veía, porque medir que el cuerpo
 * CABE en el cuadro no es medir que se VE. Girar hacia el otro lado no arregla el press
 * (107 → 103 px) y a 76°–104° entra la estación de grabación. Así que no se gira: lo que se
 * enseña del ejercicio no lo decide el encuadre.
 *
 * Lo que tampoco se toca: la elevación (la manda `elevacionDelSalon`, y subirla se lleva el
 * muro por delante) y el ángulo y la distancia de la estación de grabación, que son el
 * contrato de medida del encoder.
 *
 * Resultado medido: **los 31 caben**. Diecisiete conservan el objetivo de 26° y solo se
 * miran mejor; los tumbados llegan a 37°–45°, que es un gran angular de sala, y ahí el
 * cuerpo se ve más pequeño —154 px de alto en el peor—: es lo que cuesta meter a alguien
 * tumbado, que mide 1,8 m de ancho, en un cuadro que da para 1,35.
 */

/** El ancho y el alto contra los que se encuadra. Es el teléfono de referencia del salón. */
export const ANCHO = 390
export const ALTO = 844

/**
 * Cuánto respira el cuerpo contra el borde, en píxeles.
 *
 * Dieciséis: por debajo, un codo en el extremo del recorrido roza el canto de la pantalla
 * y se lee como recortado aunque esté entero.
 */
const MARGEN = 16

/**
 * Lo más lejos que se puede ir la cámara, en metros.
 *
 * La sala tiene 7 m de radio. A 6,3 quedan setenta centímetros hasta la pared: pasado eso
 * la cámara sale de la habitación y el salón deja de verse desde dentro, que es justo lo
 * que hace que se lea como un sitio y no como un fondo.
 */
const DISTANCIA_MAXIMA = 6.3

/** A cuánto se acerca cada paso mientras se busca la distancia, en metros. */
const PASO = 0.1

/**
 * Lo más que se puede abrir el objetivo, en radianes.
 *
 * Cuarenta y cinco grados. Con eso entran los 31 —el que más pide es la flexión de rodilla
 * tumbada, que se queda a un grado del tope—; pasado eso el gran angular empieza a curvar
 * la sala y el cuerpo baja de 150 px de alto, que es donde deja de leerse el gesto, y el
 * salón está para ver el gesto.
 */
const CAMPO_MAXIMO = grados(45)

/** Cuánto se abre el objetivo en cada paso de la búsqueda, en radianes. */
const PASO_DE_CAMPO = grados(1)

export interface EncuadreDelSalon {
  centro: [number, number, number]
  distancia: number
  /** El campo visual VERTICAL con el que se proyecta, en radianes. */
  campo: number
  /** Cuántos píxeles se queda el cuerpo fuera del cuadro, si es que se queda. */
  fuera: number
}

/** Los puntos del esqueleto en las tres fases, que es lo que hay que meter en el cuadro. */
function puntosDelCuerpo(patron: Patron): Vec3[] {
  const puntos: Vec3[] = []
  for (const fase of [0, 0.5, 1]) {
    const esq = esqueletoEnFase(patron, fase)
    for (const hueso of Object.keys(esq.mundo)) {
      for (const t of [0, 1]) puntos.push(puntoDeHueso(esq, hueso, t))
    }
  }
  return puntos
}

export function ojoDe(azimut: number, elevacion: number, distancia: number, centro: Vec3): Vec3 {
  const a = grados(azimut)
  const e = grados(elevacion)
  return [
    centro[0] + Math.sin(a) * Math.cos(e) * distancia,
    centro[1] + Math.sin(e) * distancia,
    centro[2] + Math.cos(a) * Math.cos(e) * distancia,
  ]
}

/** Un punto del mundo en la pantalla de referencia, y a qué distancia de la cámara. */
export function proyectar(vista: number[], proy: number[], p: Vec3): { x: number; y: number; z: number } | null {
  const v = M4.transformarPunto(vista, p)
  const w = -v[2]
  if (w <= 0.01) return null
  return {
    x: ((proy[0] * v[0]) / w) * 0.5 * ANCHO + ANCHO / 2,
    y: ALTO / 2 - ((proy[5] * v[1]) / w) * 0.5 * ALTO,
    z: w,
  }
}

/** La cámara del salón para un patrón, ya encuadrado: la vista y la proyección. */
export function camaraDelSalon(patron: Patron): { vista: number[]; proy: number[] } {
  const e = encuadreDelSalon(patron)
  const elevacion = elevacionDelSalon(patron.camara.elevacion)
  return {
    vista: M4.mirarDesde(ojoDe(patron.camara.azimut, elevacion, e.distancia, e.centro), e.centro, [0, 1, 0]),
    proy: M4.perspectiva(e.campo, ANCHO / ALTO, 0.05, 40),
  }
}

/**
 * Cuántos píxeles se sale el cuerpo del cuadro con esta cámara. Cero es que cabe.
 *
 * Un punto que cae DETRÁS de la cámara devuelve infinito: no es que se salga un poco, es
 * que esa cámara no vale.
 */
export function fueraDelCuadro(
  puntos: readonly Vec3[],
  azimut: number,
  elevacion: number,
  distancia: number,
  centro: Vec3,
  campo: number = CAMPO_VISUAL,
): number {
  const vista = M4.mirarDesde(ojoDe(azimut, elevacion, distancia, centro), centro, [0, 1, 0])
  const proy = M4.perspectiva(campo, ANCHO / ALTO, 0.05, 40)
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const p of puntos) {
    const v = M4.transformarPunto(vista, p)
    const w = -v[2]
    if (w <= 0.01) return Infinity
    const x = ((proy[0] * v[0]) / w) * 0.5 * ANCHO + ANCHO / 2
    const y = ALTO / 2 - ((proy[5] * v[1]) / w) * 0.5 * ALTO
    x0 = Math.min(x0, x)
    x1 = Math.max(x1, x)
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }
  return Math.max(0, MARGEN - x0, x1 - (ANCHO - MARGEN), MARGEN - y0, y1 - (ALTO - MARGEN))
}

/** El centro de la caja que ocupa el cuerpo en todo el recorrido. */
function centroDelCuerpo(puntos: readonly Vec3[]): [number, number, number] {
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const p of puntos) {
    for (let k = 0; k < 3; k++) {
      if (p[k] < min[k]) min[k] = p[k]
      if (p[k] > max[k]) max[k] = p[k]
    }
  }
  return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
}

/** No depende de la fase ni de nada que cambie: se calcula una vez por patrón. */
const memoria = new Map<string, EncuadreDelSalon>()

export function encuadreDelSalon(patron: Patron): EncuadreDelSalon {
  const guardado = memoria.get(patron.id)
  if (guardado) return guardado

  const puntos = puntosDelCuerpo(patron)
  const centro = centroDelCuerpo(puntos)
  const elevacion = elevacionDelSalon(patron.camara.elevacion)
  const azimutDeclarado = patron.camara.azimut

  // 2. Retirarse lo justo, sin salir de la sala.
  let distancia: number = ENCUADRE_SALA.distancia
  while (
    fueraDelCuadro(puntos, azimutDeclarado, elevacion, distancia, centro) > 0 &&
    distancia < DISTANCIA_MAXIMA
  ) {
    distancia = Math.min(DISTANCIA_MAXIMA, distancia + PASO)
  }

  // 3. Y si aún no cabe, abrir el objetivo lo justo. Nunca se gira: ver el punto 3 de
  //    arriba, que eso lo descartó una foto y no un número.
  let campo: number = CAMPO_VISUAL
  while (
    fueraDelCuadro(puntos, azimutDeclarado, elevacion, distancia, centro, campo) > 0 &&
    campo < CAMPO_MAXIMO
  ) {
    campo = Math.min(CAMPO_MAXIMO, campo + PASO_DE_CAMPO)
  }

  const fuera = fueraDelCuadro(puntos, azimutDeclarado, elevacion, distancia, centro, campo)

  const encuadre: EncuadreDelSalon = { centro, distancia, campo, fuera }
  memoria.set(patron.id, encuadre)
  return encuadre
}
