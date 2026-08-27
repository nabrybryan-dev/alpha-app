/**
 * Puesta en escena de un patrón: tempo de la repetición, encuadre de cámara y
 * las guías que se dibujan encima —el arco del movimiento y la esfera de giro.
 *
 * Sigue siendo lógica pura: devuelve números y mallas, no toca la GPU.
 */

import { grados, limitar, suavizar, V, type Vec3 } from './algebra'
import type { Patron } from './catalogo'
import { ESQUELETO, INDICE_HUESO, puntoDeHueso, resolverConApoyo, type EsqueletoResuelto, type Lado } from './esqueleto'
import { flecha, Malla, tuboDiscontinuo, type Color } from './malla'
import { MUSCULOS, trazadoDeFasciculo } from './musculos'
import { poseAnimada } from './movimiento'

export const AMBAR: Color = [0.91, 0.698, 0.235]
export const AMBAR_APAGADO: Color = [0.47, 0.4, 0.23]
export const ARO: Color = [0.4, 0.47, 0.545]

/**
 * Tempo real de una repetición bien ejecutada: sube en 1,2 s, pausa arriba,
 * baja frenando en 1,9 s y pausa abajo.
 *
 * Ver el tempo correcto es parte de lo que hay que enseñar. Una interpolación
 * lineal enseñaría un tempo que nadie debería copiar.
 */
const CICLO = [
  { duracion: 1.2, desde: 0, hasta: 1, suave: true },
  { duracion: 0.35, desde: 1, hasta: 1, suave: false },
  { duracion: 1.9, desde: 1, hasta: 0, suave: true },
  { duracion: 0.3, desde: 0, hasta: 0, suave: false },
]

export const DURACION_CICLO = CICLO.reduce((s, f) => s + f.duracion, 0)

export interface FaseDelCiclo {
  fase: number
  /** +1 en la fase concéntrica, −1 en la excéntrica. */
  sentido: number
}

export function faseDeTiempo(t: number): FaseDelCiclo {
  let u = ((t % DURACION_CICLO) + DURACION_CICLO) % DURACION_CICLO
  for (const f of CICLO) {
    if (u < f.duracion) {
      const k = f.duracion > 0 ? u / f.duracion : 0
      return {
        fase: f.desde + (f.hasta - f.desde) * (f.suave ? suavizar(k) : k),
        sentido: f.hasta >= f.desde ? 1 : -1,
      }
    }
    u -= f.duracion
  }
  return { fase: 0, sentido: 1 }
}

const piesDe = (p: Patron): Lado[] => p.pies ?? (p.apoyo === 'suelo' ? ['D', 'I'] : [])

/** Resuelve el esqueleto de un patrón en una fase concreta. */
export function esqueletoEnFase(
  patron: Patron,
  fase: number,
  sentido = 1,
  reloj = 0,
): EsqueletoResuelto {
  const { pose, desplazamiento, giroRaiz } = poseAnimada(patron, fase, sentido, reloj)
  return resolverConApoyo(
    pose,
    desplazamiento,
    giroRaiz,
    patron.apoyo,
    patron.alturaApoyo,
    piesDe(patron),
  )
}

export interface Encuadre {
  centro: Vec3
  distancia: number
}

const CAMPO_VISUAL = grados(34)

/**
 * Encuadre automático.
 *
 * Se apoya en la musculatura que trabaja, no en el cuerpo entero: encuadrar
 * siempre la figura completa dejaba la pantorrilla o el bíceps del tamaño de
 * una uña. Y se mide a lo largo de TODA la repetición, no en la pose inicial,
 * porque si no una sentadilla se sale del marco justo cuando el sujeto baja.
 *
 * Que el plano recorte es correcto: los primeros planos son la forma de mirar
 * una articulación.
 */
export function encuadrar(patron: Patron): Encuadre {
  const cuerpo: Vec3[] = []
  const activo: Vec3[] = []
  const agonistas = MUSCULOS.filter((m) => {
    const a = Math.max(
      patron.activacion[m.id] ?? 0,
      patron.activacion[m.id + ':D'] ?? 0,
      patron.activacion[m.id + ':I'] ?? 0,
    )
    return a >= 0.7
  })

  for (const fase of [0, 0.25, 0.5, 0.75, 1]) {
    const esq = esqueletoEnFase(patron, fase)
    for (const h of ESQUELETO) {
      for (const t of [0, 0.5, 1]) cuerpo.push(puntoDeHueso(esq, h.nombre, t))
    }
    for (const m of agonistas) {
      for (const lado of ['D', 'I'] as Lado[]) {
        const propio = patron.activacion[m.id + ':' + lado]
        // En un patrón unilateral solo cuenta el lado que de verdad trabaja.
        if (propio === undefined && patron.activacion[m.id] === undefined) continue
        if (propio !== undefined && propio < 0.7) continue
        for (const p of trazadoDeFasciculo(esq, m, lado, 0)) activo.push(p)
      }
    }
  }

  const caja = (puntos: Vec3[]): { centro: Vec3; radio: number } => {
    const min: Vec3 = [Infinity, Infinity, Infinity]
    const max: Vec3 = [-Infinity, -Infinity, -Infinity]
    for (const p of puntos) {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], p[i])
        max[i] = Math.max(max[i], p[i])
      }
    }
    const centro: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
    let radio = 0
    for (const p of puntos) radio = Math.max(radio, V.largo(V.restar(p, centro)))
    return { centro, radio }
  }

  const todo = caja(cuerpo)
  const zona = activo.length ? caja(activo) : todo
  const centro = V.entre(zona.centro, todo.centro, 0.34)
  const radio = limitar(zona.radio * 2.0, 0.42, todo.radio * 1.05)
  return { centro, distancia: (radio / Math.tan(CAMPO_VISUAL / 2)) * 1.06 + 0.22 }
}

/**
 * Trayectoria del punto que define el patrón.
 *
 * No depende de la fase —solo cambia qué tramo está encendido—, así que se
 * calcula una vez por patrón. Recalcularla en cada cuadro costaba cincuenta y
 * dos resoluciones del esqueleto por cuadro y dejaba la página sin responder.
 */
export function trazaDelPatron(patron: Patron): Vec3[] | null {
  if (!patron.seguimiento) return null
  const [hueso, t, desvio] = patron.seguimiento
  const nombre = INDICE_HUESO[hueso + 'D'] ? hueso + 'D' : hueso
  const N = 26
  const puntos: Vec3[] = []
  for (let i = 0; i < N; i++) {
    puntos.push(puntoDeHueso(esqueletoEnFase(patron, i / (N - 1)), nombre, t, desvio))
  }
  return puntos
}

/**
 * Guías: el arco ámbar del movimiento y, mientras se gira, la esfera que indica
 * que la figura se puede orbitar.
 */
export function guias(
  traza: Vec3[] | null,
  fase: number,
  centroOrbita: Vec3,
  mostrarEsfera: boolean,
): Malla {
  const m = new Malla()
  if (traza && traza.length >= 2) {
    tuboDiscontinuo(m, traza, 0.0075, AMBAR, AMBAR_APAGADO, fase, 0.032, 0.022)
    flecha(m, traza[traza.length - 2], traza[traza.length - 1], 0.0075, AMBAR)
  }
  if (mostrarEsfera) {
    const R = 0.92
    for (const eje of [0, 1, 2]) {
      const N = 64
      const puntos: Vec3[] = []
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2
        const x = Math.cos(a) * R
        const y = Math.sin(a) * R
        const d: Vec3 = eje === 0 ? [x, 0, y] : eje === 1 ? [x, y, 0] : [0, y, x]
        puntos.push(V.sumar(centroOrbita, d))
      }
      tuboDiscontinuo(m, puntos, 0.0032, ARO, ARO, 1, 0.055, 0.045)
    }
  }
  return m
}
