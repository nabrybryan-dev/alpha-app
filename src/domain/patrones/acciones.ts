/**
 * Qué hace cada articulación en cada ejercicio.
 *
 * Un press militar no es «un empuje»: es flexión de hombro, extensión de codo,
 * rotación de la escápula hacia arriba, y una muñeca que no se mueve pero
 * aguanta. Esa lista es lo que el asesorado necesita para entender el gesto sin
 * tecnicismos, y es lo que separa saber ejecutar de repetir.
 *
 * **Se calcula, no se escribe.** Sale de comparar la pose inicial con la final
 * y de mirar qué músculos cruzan cada articulación. Escribirlo a mano en las
 * diecinueve fichas garantizaría que un día alguien cambie un ángulo y la lista
 * siga diciendo lo de antes.
 */

import { ARTICULACIONES, type Articulacion, type EjeArticular } from './articulaciones'
import type { Patron } from './catalogo'
import { apoyarPies, ESQUELETO, type Lado, type Pose } from './esqueleto'
import { activacionDe, PORCIONES, type PorcionLocalizada } from './musculos'
import { poseAnimada } from './movimiento'

/**
 * Papel de una articulación en el patrón.
 *
 * `motor` la mueve, `estabilizador` la sujeta quieta contra una carga, y
 * `libre` es la que ni se mueve ni tiene que aguantar nada.
 */
export type Rol = 'motor' | 'estabilizador' | 'libre'

export const NOMBRE_DE_ROL: Record<Rol, string> = {
  motor: 'Mueve',
  estabilizador: 'Sujeta',
  libre: 'Acompaña',
}

export interface AccionArticular {
  articulacion: Articulacion
  eje: EjeArticular
  desde: number
  hasta: number
  /** Grados recorridos, siempre positivo. */
  recorrido: number
  /** Cómo se llama lo que hace: «Flexión», «Extensión»… */
  accion: string
  rol: Rol
}

export interface ResumenArticular {
  articulacion: Articulacion
  rol: Rol
  acciones: AccionArticular[]
}

/** A partir de aquí se considera que la articulación se está moviendo. */
const UMBRAL_MOTOR = 12

/**
 * Y además tiene que haber músculo tirando de ella.
 *
 * Sin esto, el codo salía como motor de una sentadilla porque los brazos se
 * adelantan doce grados para equilibrar. Se mueve, sí, pero no es lo que hay
 * que mirar: nadie hace una sentadilla con los codos.
 */
const UMBRAL_TENSION_MOTOR = 0.4

// --- Qué articulación cruza cada músculo -----------------------------------

const PADRE: Record<string, string | null> = Object.fromEntries(
  ESQUELETO.map((h) => [h.nombre, h.padre]),
)

const sinLado = (hueso: string): string => hueso.replace(/[DI]$/, '')

/** Cadena de huesos desde uno hasta la raíz, sin el sufijo de lado. */
function ancestros(hueso: string): string[] {
  const salida: string[] = []
  let actual: string | null = hueso
  while (actual) {
    salida.push(sinLado(actual))
    actual = PADRE[actual] ?? null
  }
  return salida
}

/**
 * Un músculo cruza una articulación si uno de sus anclajes queda por encima y
 * el otro por debajo de ella. Es lo que decide si puede sujetarla: un músculo
 * que no la cruza no puede hacer nada por ella, por mucho que esté cerca.
 */
export function cruza(huesoA: string, huesoB: string, art: Articulacion): boolean {
  // Basta con mirar el lado distal: un anclaje está por debajo de la
  // articulación si el hueso distal aparece en su cadena hacia la raíz. Exigir
  // además que el otro contuviera el hueso proximal era demasiado estricto y
  // dejaba fuera a los músculos que nacen más arriba: los flexores del carpo
  // salen del húmero y cruzan la muñeca igual.
  const porDebajo = (hueso: string) => ancestros(hueso).includes(art.huesoDistal)
  return porDebajo(huesoA) !== porDebajo(huesoB)
}

/**
 * Las porciones musculares que cruzan una articulación, es decir, las únicas
 * que pueden moverla o sujetarla. Un músculo que no la cruza no puede hacer
 * nada por ella, por mucho que esté al lado.
 */
export function porcionesQueCruzan(art: Articulacion): PorcionLocalizada[] {
  return PORCIONES.filter(({ porcion }) => cruza(porcion.desde[0], porcion.hasta[0], art))
}

/** Cuánta activación tiene el músculo más solicitado que cruza la articulación. */
function tensionSobre(patron: Patron, art: Articulacion): number {
  let max = 0
  for (const { musculo, porcion } of PORCIONES) {
    if (!cruza(porcion.desde[0], porcion.hasta[0], art)) continue
    for (const lado of ['D', 'I']) {
      max = Math.max(max, activacionDe(patron.activacion, musculo.id, porcion.id, lado))
    }
  }
  return max
}

// --- Cálculo ----------------------------------------------------------------

function valorDe(pose: Record<string, number>, canal: string): number {
  // Un canal puede venir por lado; se toma el que más se mueve de los dos.
  const d = pose[canal + 'D']
  const i = pose[canal + 'I']
  if (d !== undefined || i !== undefined) {
    return Math.abs(d ?? 0) >= Math.abs(i ?? 0) ? (d ?? 0) : (i ?? 0)
  }
  return pose[canal] ?? 0
}

/**
 * Desglose del patrón, articulación por articulación, ordenado por importancia:
 * primero lo que mueve, después lo que sujeta.
 */
export function accionesDelPatron(patron: Patron): ResumenArticular[] {
  const salida: ResumenArticular[] = []

  // Se leen las poses YA resueltas, no las escritas en la ficha. El apoyo
  // plantar calcula el tobillo por su cuenta, así que la dorsiflexión de una
  // sentadilla —que es de sus claves de ejecución— no está escrita en ningún
  // sitio y solo aparece si se mira la pose final de verdad.
  const pies: Lado[] = patron.pies ?? (patron.apoyo === 'suelo' ? ['D', 'I'] : [])
  const resuelta = (fase: number): Pose => {
    const { pose, desplazamiento, giroRaiz } = poseAnimada(patron, fase, 1, 0)
    return pies.length ? apoyarPies(pose, desplazamiento, giroRaiz, pies) : pose
  }
  const poseInicio = resuelta(0)
  const poseFin = resuelta(1)

  for (const articulacion of ARTICULACIONES) {
    const tension = tensionSobre(patron, articulacion)
    const acciones: AccionArticular[] = []
    for (const eje of articulacion.ejes) {
      // Se lee el canal tal cual. La inclinación global del cuerpo NO se cuenta
      // aquí: en una bisagra, que la pelvis rote sobre el fémur ya se está
      // diciendo como «flexión de cadera», y contarlo dos veces —una como cadera
      // y otra como pelvis— confunde en vez de explicar.
      const desde = valorDe(poseInicio, eje.canal)
      const hasta = valorDe(poseFin, eje.canal)
      const recorrido = Math.abs(hasta - desde)
      if (recorrido < 3) continue
      acciones.push({
        articulacion,
        eje,
        desde,
        hasta,
        recorrido,
        // El nombre del sentido, no el del eje: lo que hace y no cómo se llama.
        accion: hasta > desde ? eje.positivo : eje.negativo,
        rol:
          recorrido >= UMBRAL_MOTOR && tension >= UMBRAL_TENSION_MOTOR ? 'motor' : 'libre',
      })
    }

    const mueve = acciones.some((a) => a.rol === 'motor')
    // Si no se mueve pero la cruza un músculo bien solicitado, está sujetando.
    // Es el caso de la muñeca en un press: no recorre nada y aguanta todo.
    const rol: Rol = mueve ? 'motor' : tension >= 0.45 ? 'estabilizador' : 'libre'

    if (rol === 'libre' && acciones.length === 0) continue
    salida.push({ articulacion, rol, acciones })
  }

  const peso: Record<Rol, number> = { motor: 0, estabilizador: 1, libre: 2 }
  return salida.sort((a, b) => {
    if (peso[a.rol] !== peso[b.rol]) return peso[a.rol] - peso[b.rol]
    const rec = (r: ResumenArticular) => Math.max(0, ...r.acciones.map((x) => x.recorrido))
    return rec(b) - rec(a)
  })
}

/**
 * La frase corta del patrón: «Flexión de hombro y extensión de codo».
 *
 * Es lo primero que hay que poder leer, antes de cualquier desglose.
 */
export function fraseDelPatron(patron: Patron): string {
  const motores = accionesDelPatron(patron)
    .filter((r) => r.rol === 'motor')
    .flatMap((r) => r.acciones.filter((a) => a.rol === 'motor'))
    .sort((a, b) => b.recorrido - a.recorrido)
    .slice(0, 3)
    .map((a) => `${a.accion.toLowerCase()} de ${a.articulacion.nombre.toLowerCase()}`)

  if (motores.length === 0) return 'Sin recorrido articular: el trabajo es sostener la posición.'
  if (motores.length === 1) return capitalizar(motores[0])
  return capitalizar(`${motores.slice(0, -1).join(', ')} y ${motores[motores.length - 1]}`)
}

const capitalizar = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Solo lo que hay que mirar: lo que mueve y lo que sujeta.
 *
 * Las articulaciones «libres» acompañan por las capas de movimiento —la mirada
 * que compensa, los brazos que equilibran— y meterlas en la lista solo añade
 * ruido a quien está intentando entender el gesto.
 */
export function accionesPrincipales(patron: Patron): ResumenArticular[] {
  return accionesDelPatron(patron).filter((r) => r.rol !== 'libre')
}
