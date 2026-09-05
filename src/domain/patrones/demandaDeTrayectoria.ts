import { esqueletoEnFase } from './escena'
import { PATRON_POR_ID, type Patron } from './catalogo'
import { puntoDeCarga } from '../biomecanica/brazosDeMomento'
import { puntoDeHueso } from './esqueleto'
import { implementoDe, IMPLEMENTOS, type Implemento } from '../biomecanica/implementos'
import type { Vec3 } from './algebra'

/**
 * QUÉ LE PIDE LA CARGA A LA TRAYECTORIA, y cómo se comprueba que el patrón lo cumple.
 *
 * Nace el 2026-09-05, de mirar el peso muerto en el salón: la carga que llevan las manos
 * recorría **19 cm hacia abajo y 35 hacia los lados**. Con peso libre eso no puede pasar —la
 * gravedad tira en una sola dirección—, y el motivo de que pasara es que **nadie comprobaba
 * el recorrido contra el implemento**: el arco ámbar es la punta de un hueso que el patrón
 * declara seguir, y va donde lo lleve la animación.
 *
 * ## La demanda no se inventa: ya estaba escrita
 *
 * Cada patrón lista sus `ejemplos` («Peso muerto rumano con mancuernas»), `implementoDe`
 * los clasifica, y el perfil del implemento **ya declara** si la distancia horizontal cuenta
 * (`distanciaHorizontalVale`) — que es justo decir «esto tira vertical y el atleta decide
 * dónde poner la carga». Y cada patrón declara su `cadena`. De esos dos datos sale la ley,
 * sin números nuevos:
 *
 * - **Cadena CERRADA con peso libre** (peso muerto, elevación de talones, press de banca):
 *   los pies o la espalda están apoyados y **el cuerpo se mueve alrededor de la carga**. La
 *   carga baja recta, porque si se fuera de lado el conjunto se caería. Se mide la deriva
 *   horizontal contra el recorrido vertical.
 * - **Cadena ABIERTA con peso libre** (curl, elevación lateral, apertura): aquí **todavía no
 *   se comprueba nada, y se dice por qué**. El extremo proximal está fijo y el segmento gira,
 *   así que la carga describe un arco y eso es correcto. La ley que parecía servir —que el
 *   arco mantenga su radio— se midió el 2026-09-05 y NO se sostiene: en un remo el radio de
 *   la mano al hombro va de 34 a 56 cm con toda la razón, porque el codo dobla a la vez. Y
 *   medirlo contra el hueso de al lado es tautológico —el rig calcula la mano DESDE el codo,
 *   así que sale constante siempre— y el guardián nacería verde. La ley verdadera sería que
 *   el eje que gira no se traslade (que el codo no viaje en un curl), y eso pide un margen
 *   por ejercicio que aún no está medido. Antes que un número inventado, un hueco declarado.
 * - **Polea y máquina**: la línea la fija el cable o el riel, no la gravedad. Aquí no se
 *   comprueba ninguna de las dos: comprobarlo sería exigirle a una polea que se comporte
 *   como una barra.
 */
export type Demanda =
  | 'gravedad-cadena-cerrada'
  | 'gravedad-cadena-abierta'
  | 'linea-de-cable'
  | 'riel-de-maquina'
  | 'sin-peso-en-las-manos'

/** Los implementos que son una masa colgando de la gravedad, en las manos. */
const PESO_LIBRE: Implemento[] = ['barra', 'disco', 'mancuernas']
const CABLE: Implemento[] = ['polea', 'polea-tobillera']
const RIEL: Implemento[] = ['maquina', 'guiado-vertical', 'guiado-inclinado']

/** Los ejemplos que el patrón declara, ya clasificados por implemento. */
export function implementosDelPatron(patron: Patron): Implemento[] {
  return String(patron.ejemplos)
    .split('·')
    .map((e) => implementoDe(e.trim()))
    .filter((i): i is Implemento => Boolean(i))
}

/**
 * La demanda manda el implemento MÁS exigente de los ejemplos, no el primero: un patrón
 * tiene una sola animación y la comparten todos sus ejemplos, así que si uno de ellos se
 * hace con barra, la animación tiene que valer para la barra.
 */
export function demandaDe(patron: Patron): Demanda {
  const implementos = implementosDelPatron(patron)
  const libre = implementos.filter((i) => PESO_LIBRE.includes(i) && IMPLEMENTOS[i].distanciaHorizontalVale)
  if (libre.length) {
    return patron.cadena === 'cerrada' ? 'gravedad-cadena-cerrada' : 'gravedad-cadena-abierta'
  }
  if (implementos.some((i) => CABLE.includes(i))) return 'linea-de-cable'
  if (implementos.some((i) => RIEL.includes(i))) return 'riel-de-maquina'
  return 'sin-peso-en-las-manos'
}

/**
 * DÓNDE SE APOYA LA CARGA cuando NO va en las manos.
 *
 * Por defecto la carga externa está en las manos —es lo que asume `puntoDeCarga`—, y para
 * casi todo vale. No para el empuje de cadera: ahí la barra descansa sobre la pelvis y las
 * manos solo la sujetan de lado, así que seguir las manos medía un recorrido que no es el de
 * la carga (2,17 de razón en las manos contra 0,96 en la cadera, medido el 2026-09-05).
 * Medir el sitio equivocado no da un número malo: da uno falso que parece un resultado.
 */
const CARGA_SOBRE_EL_HUESO: Record<string, string> = { extension_cadera: 'pelvis' }

/** Cuántos puntos del recorrido se miran. Impar, para que el medio caiga en una muestra. */
const MUESTRAS = 21

export interface RecorridoDeCarga {
  /** Cuánto sube y baja la carga, en metros. */
  vertical: number
  /** La mayor distancia horizontal entre dos puntos del recorrido, en metros. */
  deriva: number
  puntos: Vec3[]
}

export function recorridoDeCarga(patron: Patron): RecorridoDeCarga | undefined {
  const hueso = CARGA_SOBRE_EL_HUESO[patron.id]
  const puntos: Vec3[] = []
  for (let i = 0; i < MUESTRAS; i++) {
    const esq = esqueletoEnFase(patron, i / (MUESTRAS - 1))
    const carga = hueso ? puntoDeHueso(esq, hueso, 0) : puntoDeCarga(esq)
    if (carga) puntos.push(carga)
  }
  if (puntos.length < 2) return undefined
  let yMin = Infinity
  let yMax = -Infinity
  for (const p of puntos) {
    if (p[1] < yMin) yMin = p[1]
    if (p[1] > yMax) yMax = p[1]
  }
  let deriva = 0
  for (const a of puntos) {
    for (const b of puntos) {
      const d = Math.hypot(a[0] - b[0], a[2] - b[2])
      if (d > deriva) deriva = d
    }
  }
  return {
    vertical: yMax - yMin,
    deriva,
    puntos,
  }
}

/**
 * EL TOPE.
 *
 * `DERIVA_MAXIMA` es cuánto puede irse de lado la carga en cadena cerrada, en tanto por uno
 * de lo que recorre en vertical. Medido sobre el catálogo el 2026-09-05: los patrones que se
 * ven bien se quedan por debajo de 0,30 y los que Bryan señaló estaban en 1,83 (peso muerto)
 * y 1,06 (press inclinado). 0,40 deja sitio al empuje de cadera, donde la barra sí describe
 * un arco de verdad porque el tronco pivota sobre el banco.
 */
export const DERIVA_MAXIMA = 0.4
/** Por debajo de esto no hay recorrido que juzgar: una isometría no traza nada. */
const RECORRIDO_MINIMO = 0.03

export interface Veredicto {
  patron: string
  demanda: Demanda
  cumple: boolean
  /** Qué se midió, en las unidades de su demanda. */
  medida: string
  motivo: string
}

export function juzgarTrayectoria(patron: Patron): Veredicto {
  const demanda = demandaDe(patron)
  const base = { patron: patron.id, demanda }
  const r = recorridoDeCarga(patron)
  if (!r) return { ...base, cumple: true, medida: 'sin carga en las manos', motivo: 'no hay nada que seguir' }

  if (demanda === 'gravedad-cadena-cerrada') {
    if (r.vertical < RECORRIDO_MINIMO) {
      return { ...base, cumple: true, medida: `vertical ${(r.vertical * 100).toFixed(0)} cm`, motivo: 'isometría' }
    }
    const razon = r.deriva / r.vertical
    return {
      ...base,
      cumple: razon <= DERIVA_MAXIMA,
      medida: `v=${(r.vertical * 100).toFixed(0)}cm h=${(r.deriva * 100).toFixed(0)}cm razón=${razon.toFixed(2)}`,
      motivo:
        razon <= DERIVA_MAXIMA
          ? 'la carga baja recta'
          : 'con peso libre y cadena cerrada la carga no puede irse de lado: la gravedad tira en una sola dirección',
    }
  }

  if (demanda === 'gravedad-cadena-abierta') {
    return {
      ...base,
      cumple: true,
      medida: `v=${(r.vertical * 100).toFixed(0)}cm h=${(r.deriva * 100).toFixed(0)}cm`,
      motivo: 'el arco es legítimo; la ley que lo acotaría no está medida todavía',
    }
  }

  return { ...base, cumple: true, medida: 'no se comprueba', motivo: 'la línea la fija el cable o el riel, no la gravedad' }
}

/** Todos los patrones del catálogo, juzgados. */
export function juzgarCatalogo(): Veredicto[] {
  return Object.values(PATRON_POR_ID).map(juzgarTrayectoria)
}
