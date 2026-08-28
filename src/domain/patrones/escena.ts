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
import { activacionDe, PORCIONES, trazadoDeFasciculo } from './musculos'
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
  { duracion: 1.2, desde: 0, hasta: 1, suave: true, subiendo: true },
  { duracion: 0.35, desde: 1, hasta: 1, suave: false, asienta: true },
  { duracion: 1.9, desde: 1, hasta: 0, suave: true },
  { duracion: 0.3, desde: 0, hasta: 0, suave: false },
]

/**
 * La región de estancamiento de la concéntrica.
 *
 * Un levantamiento real no sube a velocidad de interpolación. Pasado el
 * arranque hay un tramo donde el brazo de momento empeora y la barra se
 * enlentece; en la sentadilla está descrito y medido, y cualquiera que entrene
 * lo reconoce sin que se lo expliquen. Sin esto la subida se lee como una
 * animación, que es justo lo que delata a un maniquí por muy correctos que sean
 * los ángulos.
 *
 * `freno` resta avance en forma de campana, así que la velocidad cae ahí y se
 * recupera después. Es pequeño a propósito: tiene que frenar, nunca retroceder
 * —eso sería fallar la repetición, que no es lo que se enseña.
 */
const ESTANCAMIENTO = { centro: 0.42, ancho: 0.17, freno: 0.62 }

/**
 * Cuánto acomoda el cuerpo al llegar arriba, y en cuánto se apaga.
 *
 * Follow-through: nada llega a su tope y se congela de golpe. El tejido y la
 * carga siguen un instante y se asientan. Va siempre hacia abajo —el cuerpo
 * cede y vuelve, no se pasa de largo— porque pasarse del bloqueo sería
 * hiperextender, y por debajo del 2 % para que no se lea como una repetición
 * fallada.
 */
const ASENTAMIENTO = { amplitud: 0.015, ciclos: 2.2, apagado: 6.5 }

/**
 * La curva de la subida, tabulada por punto de atasco.
 *
 * El frenado hay que definirlo sobre la VELOCIDAD y después integrar. Restarle
 * una campana a la posición no sirve: lo que frena en la primera mitad lo
 * acelera en la segunda, y queda un ritmo raro en vez de un valle. Como la
 * integral de una gaussiana no es elemental, se tabula.
 *
 * Se guarda una tabla por cada punto distinto —hoy son cuatro contando el valor
 * por defecto— porque el atasco no cae en el mismo sitio en cada ejercicio.
 */
const MUESTRAS_SUBIDA = 128
const TABLAS = new Map<number, number[]>()

function curvaDeSubida(centro: number): number[] {
  const guardada = TABLAS.get(centro)
  if (guardada) return guardada
  // Velocidad base: la de un `suavizar`, que arranca y termina parada.
  const velocidad = (k: number): number => {
    const base = 6 * k * (1 - k)
    const x = (k - centro) / ESTANCAMIENTO.ancho
    return base * (1 - ESTANCAMIENTO.freno * Math.exp(-x * x))
  }
  const tabla = [0]
  let suma = 0
  for (let i = 1; i <= MUESTRAS_SUBIDA; i++) {
    // Trapecio: con 128 tramos el error es despreciable para lo que se ve.
    const a = (i - 1) / MUESTRAS_SUBIDA
    const b = i / MUESTRAS_SUBIDA
    suma += ((velocidad(a) + velocidad(b)) / 2) * (b - a)
    tabla.push(suma)
  }
  // Se normaliza para que el tramo termine exactamente en 1: si no, el cambio
  // de fase daría un salto justo al llegar arriba.
  const normalizada = tabla.map((v) => v / suma)
  TABLAS.set(centro, normalizada)
  return normalizada
}

/** Avance de la subida en su fase local, interpolando la tabla. */
function avanceDeSubida(k: number, centro: number): number {
  const tabla = curvaDeSubida(centro)
  const x = limitar(k, 0, 1) * MUESTRAS_SUBIDA
  const i = Math.min(Math.floor(x), MUESTRAS_SUBIDA - 1)
  return tabla[i] + (tabla[i + 1] - tabla[i]) * (x - i)
}

export const DURACION_CICLO = CICLO.reduce((s, f) => s + f.duracion, 0)

export interface FaseDelCiclo {
  fase: number
  /** +1 en la fase concéntrica, −1 en la excéntrica. */
  sentido: number
}

export function faseDeTiempo(t: number, patron?: Patron): FaseDelCiclo {
  const centro = patron?.estancamiento ?? ESTANCAMIENTO.centro
  let u = ((t % DURACION_CICLO) + DURACION_CICLO) % DURACION_CICLO
  for (const f of CICLO) {
    if (u < f.duracion) {
      const k = f.duracion > 0 ? u / f.duracion : 0
      const avance = f.subiendo ? avanceDeSubida(k, centro) : f.suave ? suavizar(k) : k
      let fase = f.desde + (f.hasta - f.desde) * avance
      if (f.asienta) {
        // Siempre resta: el cuerpo cede y vuelve. Se apaga sola dentro de la
        // pausa, así que al empezar a bajar ya está quieta.
        fase -=
          ASENTAMIENTO.amplitud *
          Math.exp(-ASENTAMIENTO.apagado * k) *
          Math.abs(Math.sin(k * ASENTAMIENTO.ciclos * Math.PI))
      }
      return { fase, sentido: f.hasta >= f.desde ? 1 : -1 }
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

/**
 * El campo visual de la cámara, y por qué es estrecho.
 *
 * Un campo ancho exagera lo que está cerca del objetivo: la mano que se
 * adelanta en un press sale enorme y la figura se lee deformada. En cine la
 * figura humana se mira con el equivalente a un 85 mm, que ronda los 22-25°;
 * esto estaba en 34°, más cerca de un gran angular.
 *
 * Estrecharlo no recorta nada, porque la distancia de la cámara se calcula con
 * este mismo valor: el sujeto ocupa lo mismo en pantalla y lo único que cambia
 * es la perspectiva. Lo lee también `VisorPatron` para construir la proyección;
 * estuvo escrito dos veces, y dos copias de un número así divergen solas.
 */
export const CAMPO_VISUAL = grados(26)

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
/**
 * Cuántas veces el segmento móvil cabe en el cuadro cuando se estudia una
 * articulación. Con 1 el antebrazo tocaría los bordes; el margen deja ver a la
 * vez el hueso de arriba, que es contra el que se mueve.
 */
const HOLGURA_DEL_FOCO = 1.12

export function encuadrar(patron: Patron): Encuadre {
  const cuerpo: Vec3[] = []
  const activo: Vec3[] = []
  // Se encuadra la PORCIÓN que trabaja, no el músculo entero: en un curl manda
  // el bíceps, pero en un press militar mandan la cabeza lateral y la medial
  // del tríceps y no la larga, que ahí solo acompaña.
  const agonistas = PORCIONES.filter(({ musculo, porcion }) =>
    (['D', 'I'] as Lado[]).some(
      (lado) => activacionDe(patron.activacion, musculo.id, porcion.id, lado) >= 0.7,
    ),
  )

  for (const fase of [0, 0.25, 0.5, 0.75, 1]) {
    const esq = esqueletoEnFase(patron, fase)
    for (const h of ESQUELETO) {
      for (const t of [0, 0.5, 1]) cuerpo.push(puntoDeHueso(esq, h.nombre, t))
    }
    for (const { musculo, porcion } of agonistas) {
      for (const lado of ['D', 'I'] as Lado[]) {
        // En un patrón unilateral solo cuenta el lado que de verdad trabaja.
        if (activacionDe(patron.activacion, musculo.id, porcion.id, lado) < 0.7) continue
        for (const p of trazadoDeFasciculo(esq, porcion, lado, 0)) activo.push(p)
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

  // Estudio de una articulación: se encuadra la articulación misma, no lo que
  // la mueve. Se toman el hueso que gira y el que le hace de base, a lo largo
  // de toda la repetición, para que el segmento no se salga al final del
  // recorrido.
  // Un nombre de hueso que no existe se ignora en vez de mandar la cámara al
  // infinito: `puntoDeHueso` de un hueso desconocido devuelve NaN, y un NaN
  // dentro de la caja envenena el centro y la distancia sin lanzar nada.
  if (patron.foco !== undefined && INDICE_HUESO[patron.foco] !== undefined) {
    const padre = ESQUELETO.find((h) => h.nombre === patron.foco)?.padre
    const enFoco: Vec3[] = []
    for (const fase of [0, 0.25, 0.5, 0.75, 1]) {
      const esq = esqueletoEnFase(patron, fase)
      for (const hueso of [patron.foco, padre]) {
        if (hueso === undefined || hueso === null) continue
        for (const t of [0, 0.5, 1]) enFoco.push(puntoDeHueso(esq, hueso, t))
      }
    }
    // Un nombre de hueso que no existe no deja puntos: se cae al encuadre de
    // siempre en vez de mandar la cámara al infinito.
    if (enFoco.length) {
      const zonaFoco = caja(enFoco)
      const radioFoco = limitar(zonaFoco.radio * HOLGURA_DEL_FOCO, 0.2, todo.radio)
      return {
        centro: zonaFoco.centro,
        distancia: (radioFoco / Math.tan(CAMPO_VISUAL / 2)) * 1.06 + 0.22,
      }
    }
  }

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
