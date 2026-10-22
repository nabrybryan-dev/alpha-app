import { noAfirmable, type Cifra } from './contrato'
import { GRAVEDAD, VERSION_DEL_MODELO } from './convenciones'
import { DE_LEVA, DE_LEVA_CERV } from './deleva'
import { fuentesDeLeva } from './dinamica'
import { idsDeRadio, momentoDeInercia, rangoDeRadio, type SegmentoConInercia } from './inercia'
import { derivadaSegunda, momentoNetoSobre, type Articulacion, type CuerpoEnMovimiento } from './inercial'
import { construirSujeto, type EntradaDelSujeto, type Sujeto } from './sujeto'
import {
  INCERTIDUMBRE_DEL_CP_M,
  resolverEscenario,
  type EntradaDeZancada,
  type Escenario,
  type PiernaResuelta,
  type PoseDeZancada,
} from './zancada'

/**
 * SENTADILLA BÚLGARA (zancada con el pie trasero elevado ~40 cm): el reparto del peso entre las dos piernas por una REGLA, no por la palanca.
 *
 * En la búlgara el pie trasero soporta una fuerza casi constante en términos absolutos, que no crece con la carga (REPARTO-ZANCADA.md, §4):
 *     F_tras = 0,30 del peso corporal (BW), banda [0,25; 0,35] BW,   F_del = F_total − F_tras
 * con `F_total` = peso del cuerpo + carga + término inercial (la regla se aplica al total, §4 «Estado propuesto»). BW = masa corporal · g, SIN la carga.
 *
 * FUENTES (texto completo abierto, leídas por quien escribió el documento el 22-oct-2026; aquí no se reabrieron):
 *   A. Helme M, Emmonds S, Low CJ. J Strength Cond Res 2020, DOI 10.1519/JSC.0000000000003727: 26 hombres entrenados, barra, 5RM incremental,
 *      trasera 0,30 ± 0,09 BW, delantera 1,54 ± 0,23 BW; la fuerza trasera no cambia con la carga (rho −0,01).
 *   B. Arakawa H et al. Int J Exerc Sci 2025;18(7):881-894, PMC12408075: 9 hombres entrenados, peso corporal, en el fondo: 0,26-0,35 BW (la decisión 36 de Bryan, 22-oct, baja el límite a 0,25: 169/666 = 0,254)
 *      (el documento avisa de que delantera + trasera suman ~0,9 BW sin explicación en el texto).
 * Estado: `estimado` con banda. Dos estudios abiertos coherentes; solo hombres jóvenes entrenados; elevación de 40 cm.
 *
 * LO QUE NO ESTÁ ESTABLECIDO (y el código se abstiene):
 *  · Sentadilla dividida plana (pie trasero en el suelo): un solo estudio abierto (n = 8, promedio temporal) → `no_afirmable`.
 *  · Zancada con paso (adelante, inversa, caminando): ningún estudio abierto con el reparto → `no_afirmable`.
 *  · El término inercial POR PIERNA como cifra propia: ningún estudio lo separa (§4) y por decisión 36 de Bryan (22-oct) sale `no_afirmable` con su motivo.
 *    Se da para el CUERPO ENTERO (`inercialCuerpoEntero`: Σ m·a_y en N, que no usa la regla del reparto). El `total` de cada pierna sigue siendo la regla
 *    aplicada al `F_total` completo, con la salvedad de la excéntrica: el pico trasero llega en la excéntrica (28,9 ± 11,7 % de la repetición), así que en la
 *    concéntrica la regla probablemente SOBRESTIMA la trasera (sesgo no medido); el aviso va en `supuestos`.
 *
 * DÓNDE VA CADA PIE (supuestos de este módulo):
 *  1. Los dos pies fijos: el delantero en el origen, el trasero `pasoM` detrás y a `alturaTobilloTraseroM` (la elevación). Reacciones solo VERTICALES
 *     (sin fricción): la parte horizontal de la reacción neta, Σ m·a_z, no se reparte y se informa aparte en cada cuadro.
 *  2. El CP del pie trasero está en la bola del pie (`copTraseroM`) ± `INCERTIDUMBRE_DEL_CP_M` (la banda, como en `zancada.ts`).
 *  3. El CP del pie DELANTERO no se supone: sale del equilibrio de momentos del cuerpo entero con las dos fuerzas ya fijadas por la regla. Si sale fuera del
 *     pie [−0,25 · largo del pie, +largo del pie] desde el tobillo (`convencion_propuesta`, sin fuente), pose y regla no son compatibles y es `no_afirmable`.
 *  4. Lo demás de `zancada.ts`: pierna trasera con la rodilla resuelta del triángulo, brazos verticales con la carga en las manos, proporciones de de Leva.
 *
 * El término inercial por pierna NO usa `momentosEnElTiempo`: esa función da el momento de TODO lo que está por encima de una articulación con la reacción en
 * esa articulación fuera de la ecuación (una sola cadena); aquí hace falta la reacción de CADA pierna y la segunda pierna. Se reutilizan sus piezas
 * (`derivadaSegunda`, `momentoNetoSobre`, radios de giro) y `momentosEnElTiempo` queda como oráculo independiente del momento de cadera de la suma (ver la prueba).
 */

/** Fracción del peso corporal (BW) que lleva la pierna trasera en la búlgara: REPARTO-ZANCADA.md §4, `convencion_propuesta`. */
export const FRACCION_TRASERA_BULGARA = { central: 0.3, inf: 0.25, sup: 0.35 } as const

/** Los ids de `registro.ts` de las tres cifras de la regla (central: Helme 2020; límites: Arakawa 2025 según el documento). */
export const IDS_DE_LA_REGLA_BULGARA = [
  'helme20.bulgara.trasera.bw',
  'arakawa25.bulgara.trasera.bw_inf',
  'arakawa25.bulgara.trasera.bw_sup',
] as const

/** Cuánto del largo del pie queda detrás del tobillo como límite del talón (`convencion_propuesta`, sin fuente). */
export const TALON_DETRAS_DEL_TOBILLO_EN_LARGOS_DE_PIE = 0.25

export const VARIANTES_DE_ZANCADA = ['bulgara', 'sentadilla_dividida_plana', 'zancada_con_paso'] as const
export type VarianteDeZancada = (typeof VARIANTES_DE_ZANCADA)[number]

const MOTIVO_NO_AFIRMABLE: Record<Exclude<VarianteDeZancada, 'bulgara'>, string> = {
  sentadilla_dividida_plana:
    'sentadilla dividida plana: un solo estudio abierto (n = 8, promedio temporal, no una fase) da ~32-34 % de la fuerza total en la trasera; la cifra 15-45 % de Hefzy es cita de segunda mano',
  zancada_con_paso:
    'zancada con paso (adelante, inversa, caminando): ningún estudio abierto da el reparto entre la pierna delantera y la trasera; esgrima y Comfort no dan cuota',
}

const SUPUESTOS_DE_LA_REGLA = [
  'regla de la búlgara (pie trasero elevado ~40 cm): la trasera lleva 0,30 BW, banda [0,25; 0,35] BW, independiente de la carga externa; la delantera lleva el resto',
  'BW = masa corporal · g, sin la carga; la regla se aplica al total (peso + carga + término inercial)',
  'solo hombres jóvenes entrenados (n = 26 con carga, n = 9 sin carga); el segundo estudio no cierra la suma de fuerzas (~0,9 BW)',
  'el pico trasero llega en la excéntrica: en la concéntrica la regla probablemente sobrestima la trasera (sesgo no medido)',
]
const SUPUESTOS_GEOMETRICOS = [
  'reacciones solo verticales (sin fricción); la parte horizontal de la reacción neta no se reparte entre los pies',
  'centro de presión del pie trasero en la bola del pie ± 3 cm; el del delantero sale del equilibrio de momentos del cuerpo entero',
  'pierna trasera: rodilla resuelta del triángulo cadera-rodilla-tobillo con los largos de de Leva',
  'mancuernas en las manos con los brazos estirados y verticales; hombro en el punto cervical',
  'proporciones poblacionales de de Leva 1996 escaladas a la talla y la masa',
]
const MOTIVO_INERCIAL_POR_PIERNA = 'por pierna: ningún estudio separa el término inercial entre las dos piernas (decisión 36 de Bryan); se da para el cuerpo entero en `inercialCuerpoEntero`'
const NIVEL_INERCIAL_CUERPO_ENTERO = 'Σ m·a_y de las masas puntuales del modelo por diferencias finitas de 3 puntos (no usa la regla del reparto); no es un intervalo de confianza'
const NIVEL_ESTATICO = 'envolvente de la regla en [0,25; 0,35] BW y del centro de presión trasero ± 3 cm; no es un intervalo de confianza'
const NIVEL_DINAMICO =
  'envolvente de la regla [0,25; 0,35] BW, del centro de presión trasero ± 3 cm y del rango entre los radios «sagital» y «transverso» de de Leva; no es un intervalo de confianza'

/** Si alguna combinación (regla × CP trasero) deja el CP delantero fuera del pie, la banda es más estrecha que la regla y el nivel lo dice. */
function nivelConCobertura(nivel: string, validas: number): string {
  const total = PASOS_DE_LA_REGLA.length * PASOS_DEL_CP.length
  if (validas >= total) return nivel
  return `${nivel}; envolvente parcial: ${validas} de ${total} combinaciones, en las demás el centro de presión delantero cae fuera del pie, así que la banda es más estrecha que la de la regla`
}

const finito = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** La fracción de BW que lleva la pierna trasera según la variante: cifra `estimado` en la búlgara, `no_afirmable` con su motivo en las demás. */
export function fraccionTraseraDe(variante: VarianteDeZancada): Cifra {
  const v = VERSION_DEL_MODELO
  if (variante !== 'bulgara') return noAfirmable(`${variante}.reparto.trasera.bw`, '1', MOTIVO_NO_AFIRMABLE[variante], v)
  return {
    id: 'bulgara.reparto.trasera.bw',
    valor: FRACCION_TRASERA_BULGARA.central,
    unidad: '1',
    estado: 'estimado',
    fuente: [...IDS_DE_LA_REGLA_BULGARA],
    supuestos: SUPUESTOS_DE_LA_REGLA,
    banda: { inf: FRACCION_TRASERA_BULGARA.inf, sup: FRACCION_TRASERA_BULGARA.sup, nivel: 'promedio de varones jóvenes entrenados (Helme 2020, Arakawa 2025): rango 0,25-0,35 BW (decisión 36 de Bryan, REPARTO-ZANCADA.md §4); no es un intervalo de confianza' },
    version: v,
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Núcleo: un instante (estático = aceleraciones cero) con la regla, un porcentaje y un desplazamiento del CP trasero
// ---------------------------------------------------------------------------------------------------------------------------------------------

interface Cuerpos {
  superior: CuerpoEnMovimiento[]
  delantera: { pie: CuerpoEnMovimiento; tibia: CuerpoEnMovimiento; muslo: CuerpoEnMovimiento }
  trasera: { pie: CuerpoEnMovimiento; tibia: CuerpoEnMovimiento; muslo: CuerpoEnMovimiento }
}

export interface MomentosDeUnaPierna {
  tobillo: number
  rodilla: number
  cadera: number
}

export interface EvaluacionDeBulgara {
  delantera: MomentosDeUnaPierna
  trasera: MomentosDeUnaPierna
  /** Fuerza vertical total (N): Σ m·(g + a_y). */
  fuerzaTotalN: number
  fuerzaDelanteraN: number
  fuerzaTraseraN: number
  /** Posición z del centro de presión delantero que cierra el equilibrio (m). */
  zCpDelantero: number
  repartoDelantera: number
}

/** Momento ccw de los cuerpos de debajo de J más la reacción: lo que hace el músculo de la articulación (+ extensor), como en `zancada.ts`. */
function momentosDeLaPierna(p: PiernaResuelta, c: Cuerpos['delantera'], fuerza: number, zCp: number): MomentosDeUnaPierna {
  const bajo = (cuerpos: CuerpoEnMovimiento[], j: { z: number; y: number }) => fuerza * (zCp - j.z) - momentoNetoSobre(cuerpos, j, GRAVEDAD)
  return {
    tobillo: bajo([c.pie], p.tobillo),
    rodilla: -bajo([c.pie, c.tibia], p.rodilla),
    cadera: bajo([c.pie, c.tibia, c.muslo], p.cadera),
  }
}

/**
 * Los seis momentos de un instante para una fracción de BW en la trasera y un centro de presión trasero dados. El CP delantero sale del equilibrio de
 * momentos respecto del tobillo delantero (el origen) con reacciones verticales. `null` si la fuerza delantera no es positiva, o si ese CP cae fuera del pie.
 */
export function evaluarBulgara(
  s: Sujeto,
  esc: Escenario,
  cuerpos: Cuerpos,
  fraccionTrasera: number,
  zCpTrasero: number,
): EvaluacionDeBulgara | null {
  const todos = [...cuerpos.superior, ...Object.values(cuerpos.delantera), ...Object.values(cuerpos.trasera)]
  const origen = esc.delantera.tobillo
  const fuerzaTotal = todos.reduce((t, c) => t + c.kg * (GRAVEDAD + c.ay), 0)
  const fTras = fraccionTrasera * s.masa * GRAVEDAD
  const fDel = fuerzaTotal - fTras
  if (!(fDel > 0) || !(fTras >= 0)) return null
  const zDel = (momentoNetoSobre(todos, origen, GRAVEDAD) - fTras * (zCpTrasero - origen.z)) / fDel + origen.z
  const largoPie = s.segmentos.pie.largoM
  if (zDel < origen.z - TALON_DETRAS_DEL_TOBILLO_EN_LARGOS_DE_PIE * largoPie || zDel > origen.z + largoPie) return null
  return {
    delantera: momentosDeLaPierna(esc.delantera, cuerpos.delantera, fDel, zDel),
    trasera: momentosDeLaPierna(esc.trasera, cuerpos.trasera, fTras, zCpTrasero),
    fuerzaTotalN: fuerzaTotal,
    fuerzaDelanteraN: fDel,
    fuerzaTraseraN: fTras,
    zCpDelantero: zDel,
    repartoDelantera: fDel / fuerzaTotal,
  }
}

const quieto = (m: { kg: number; z: number; y: number }): CuerpoEnMovimiento => ({ kg: m.kg, z: m.z, y: m.y, az: 0, ay: 0 })

/** Los cuerpos de un escenario sin aceleración: el caso estático. */
export function cuerposQuietos(esc: Escenario): Cuerpos {
  const pata = (p: PiernaResuelta) => ({ pie: quieto(p.masas.pie), tibia: quieto(p.masas.tibia), muslo: quieto(p.masas.muslo) })
  return { superior: esc.superior.map(quieto), delantera: pata(esc.delantera), trasera: pata(esc.trasera) }
}

const PASOS_DE_LA_REGLA = [FRACCION_TRASERA_BULGARA.inf, FRACCION_TRASERA_BULGARA.central, FRACCION_TRASERA_BULGARA.sup] as const
const PASOS_DEL_CP = [-INCERTIDUMBRE_DEL_CP_M, 0, INCERTIDUMBRE_DEL_CP_M] as const

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Estático
// ---------------------------------------------------------------------------------------------------------------------------------------------

export interface ResultadoDeBulgara {
  variante: VarianteDeZancada
  delantera: { tobillo: Cifra; rodilla: Cifra; cadera: Cifra }
  trasera: { tobillo: Cifra; rodilla: Cifra; cadera: Cifra }
  /** Fracción de la fuerza vertical en la delantera (adimensional): sale de la regla, no de la palanca. */
  repartoDelantera: Cifra
  /** Dónde tiene que estar el CP del pie delantero (m, desde el tobillo) para que el cuerpo esté en equilibrio con la regla. */
  cpDelantero: Cifra
  /** Siempre `no_afirmable` en estático: el inercial sale de la serie en el tiempo. */
  inercial: Cifra
  piernaTrasera: PiernaResuelta | null
}

function bulgaraSinDato(variante: VarianteDeZancada, motivo: string): ResultadoDeBulgara {
  const v = VERSION_DEL_MODELO
  const na = (id: string) => noAfirmable(id, 'N·m', motivo, v)
  const pata = (lado: string) => ({
    tobillo: na(`${variante}.${lado}.momento.tobillo`),
    rodilla: na(`${variante}.${lado}.momento.rodilla`),
    cadera: na(`${variante}.${lado}.momento.cadera`),
  })
  return {
    variante,
    delantera: pata('delantera'),
    trasera: pata('trasera'),
    repartoDelantera: noAfirmable(`${variante}.reparto.delantera`, '1', motivo, v),
    cpDelantero: noAfirmable(`${variante}.cp.delantero`, 'm', motivo, v),
    inercial: noAfirmable(`${variante}.momento.inercial`, 'N·m', motivo, v),
    piernaTrasera: null,
  }
}

function validarEntrada(e: EntradaDeZancada): { sujeto: Sujeto; pose: PoseDeZancada } | string {
  const sujeto = construirSujeto(e)
  if (!sujeto) return 'talla, masa o sexo ausentes o fuera de rango'
  if (!finito(e.cargaKg) || e.cargaKg < 0) return 'carga ausente o negativa'
  const p = e.pose
  const campos = p ? [p.tibiaDelantera, p.musloDelantero, p.tronco, p.cabeza, p.brazo, p.pasoM, p.alturaTobilloTraseroM, p.pieZ, p.copTraseroM] : []
  if (!p || !campos.every(finito)) return 'algún ángulo, la distancia entre los pies o un punto de apoyo falta'
  if (p.pasoM < 0 || p.alturaTobilloTraseroM < 0) return 'el paso y la altura del talón trasero no pueden ser negativos'
  return { sujeto, pose: p }
}

/** Todos los resultados de la envolvente (regla × CP trasero); `nominal` es el de la fracción central y el CP sin mover. */
function envolvente(s: Sujeto, esc: Escenario, cuerpos: Cuerpos, zTras: number) {
  const todos: EvaluacionDeBulgara[] = []
  let nominal: EvaluacionDeBulgara | null = null
  for (const f of PASOS_DE_LA_REGLA) {
    for (const d of PASOS_DEL_CP) {
      const r = evaluarBulgara(s, esc, cuerpos, f, zTras + d)
      if (!r) continue
      todos.push(r)
      if (f === FRACCION_TRASERA_BULGARA.central && d === 0) nominal = r
    }
  }
  return { nominal, todos }
}

/**
 * Momentos de las dos piernas en la búlgara, estáticos, con la regla del reparto. Misma entrada que `momentosDeZancada` (pose de `zancada.ts`; la
 * elevación del pie trasero es `alturaTobilloTraseroM`). Sin algo, todo `no_afirmable` con el motivo.
 */
export function momentosDeBulgara(entrada: EntradaDeZancada): ResultadoDeBulgara {
  const v = VERSION_DEL_MODELO
  const val = validarEntrada(entrada)
  if (typeof val === 'string') return bulgaraSinDato('bulgara', val)
  const { sujeto, pose } = val
  const esc = resolverEscenario(sujeto, entrada.cargaKg as number, pose)
  if (typeof esc === 'string') return bulgaraSinDato('bulgara', esc)
  const zTras = esc.trasera.tobillo.z + pose.copTraseroM
  const { nominal, todos } = envolvente(sujeto, esc, cuerposQuietos(esc), zTras)
  if (!nominal) {
    return bulgaraSinDato('bulgara', 'con la regla de la búlgara el centro de presión del pie delantero cae fuera del pie (o la delantera no lleva peso): pose y regla no son compatibles')
  }
  const fuente = [...fuentesDeLeva(sujeto.sexo), ...IDS_DE_LA_REGLA_BULGARA]
  const supuestos = [...SUPUESTOS_DE_LA_REGLA, ...SUPUESTOS_GEOMETRICOS, 'estático: sin aceleración (el término inercial sale de la serie en el tiempo)']
  const cifra = (id: string, valor: number, serie: number[], unidad: 'N·m' | '1' | 'm'): Cifra => ({
    id,
    valor,
    unidad,
    estado: 'estimado',
    fuente,
    supuestos,
    banda: { inf: Math.min(valor, ...serie), sup: Math.max(valor, ...serie), nivel: nivelConCobertura(NIVEL_ESTATICO, todos.length) },
    version: v,
  })
  const pata = (lado: 'delantera' | 'trasera') => {
    const art = (k: keyof MomentosDeUnaPierna) =>
      cifra(`bulgara.${lado}.momento.${k}`, nominal[lado][k], todos.map((c) => c[lado][k]), 'N·m')
    return { tobillo: art('tobillo'), rodilla: art('rodilla'), cadera: art('cadera') }
  }
  return {
    variante: 'bulgara',
    delantera: pata('delantera'),
    trasera: pata('trasera'),
    repartoDelantera: cifra('bulgara.reparto.delantera', nominal.repartoDelantera, todos.map((c) => c.repartoDelantera), '1'),
    cpDelantero: cifra('bulgara.cp.delantero', nominal.zCpDelantero - esc.delantera.tobillo.z, todos.map((c) => c.zCpDelantero - esc.delantera.tobillo.z), 'm'),
    inercial: noAfirmable('bulgara.momento.inercial', 'N·m', 'estático: la aceleración sale de la serie en el tiempo, no de una pose', v),
    piernaTrasera: esc.trasera,
  }
}

/**
 * Entrada única por variante: la búlgara usa la regla; la sentadilla dividida plana y la zancada con paso devuelven todo `no_afirmable` con el motivo
 * de REPARTO-ZANCADA.md (nunca un reparto inventado).
 */
export function momentosDeZancadaPorVariante(variante: VarianteDeZancada, entrada: EntradaDeZancada): ResultadoDeBulgara {
  if (variante === 'bulgara') return momentosDeBulgara(entrada)
  return bulgaraSinDato(variante, MOTIVO_NO_AFIRMABLE[variante])
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// En el tiempo: término inercial por pierna
// ---------------------------------------------------------------------------------------------------------------------------------------------

export interface InstanteDeBulgara {
  /** Segundos. Estrictamente creciente. */
  t: number
  pose: PoseDeZancada
}

export interface EntradaDeSerieDeBulgara extends EntradaDelSujeto {
  cargaKg: number | null | undefined
  instantes: readonly InstanteDeBulgara[] | null | undefined
  /** De dónde salen los ángulos y los tiempos. Vacía → no_afirmable. */
  fuenteDeAngulos: string | null | undefined
}

export interface MomentoDeBulgara {
  /** La misma pose sin aceleración (con la regla). */
  estatico: Cifra
  /** `no_afirmable` por pierna (decisión 36): el término inercial se da para el cuerpo entero (`MarcoDeBulgara.inercialCuerpoEntero`). */
  inercial: Cifra
  /** Con aceleración. */
  total: Cifra
}

export interface MarcoDeBulgara {
  indice: number
  t: number
  delantera: Record<Articulacion, MomentoDeBulgara>
  trasera: Record<Articulacion, MomentoDeBulgara>
  /** Σ m·a_z (N): la fuerza horizontal neta que el suelo tendría que dar y el modelo no reparte entre los pies; `null` si el marco no se calculó. */
  horizontalNoRepartidaN: number | null
  /** Fuerza vertical total del cuadro, Σ m·(g + a_y), y la que lleva la trasera por la regla (N); `null` si el marco no se calculó. */
  fuerzaTotalN: number | null
  fuerzaTraseraN: number | null
  /** Término inercial del cuerpo entero (decisión 36): Σ m·a_y = fuerza vertical total − peso del cuerpo y la carga (N); no usa la regla del reparto. */
  inercialCuerpoEntero: Cifra
}

export interface ResultadoDeSerieDeBulgara {
  motivo: string | null
  marcos: MarcoDeBulgara[]
}

type Lado = 'delantera' | 'trasera'

function marcoNoAfirmable(indice: number, t: number, motivo: string): MarcoDeBulgara {
  const v = VERSION_DEL_MODELO
  const m = (lado: string, a: Articulacion): MomentoDeBulgara => ({
    estatico: noAfirmable(`bulgara.${lado}.momento.${a}`, 'N·m', motivo, v),
    inercial: noAfirmable(`bulgara.${lado}.momento.inercial.total.${a}`, 'N·m', motivo, v),
    total: noAfirmable(`bulgara.${lado}.momento.dinamico.${a}`, 'N·m', motivo, v),
  })
  const pata = (lado: string) => ({ tobillo: m(lado, 'tobillo'), rodilla: m(lado, 'rodilla'), cadera: m(lado, 'cadera') })
  return {
    indice,
    t,
    delantera: pata('delantera'),
    trasera: pata('trasera'),
    horizontalNoRepartidaN: null,
    fuerzaTotalN: null,
    fuerzaTraseraN: null,
    inercialCuerpoEntero: noAfirmable('bulgara.cuerpo.inercial.fuerza_vertical', 'N', motivo, v),
  }
}

type Clave = 'sup:tronco' | 'sup:cabeza' | 'sup:brazos' | 'sup:barra' | 'del:pie' | 'del:tibia' | 'del:muslo' | 'tras:pie' | 'tras:tibia' | 'tras:muslo'
const CLAVES: readonly Clave[] = ['sup:tronco', 'sup:cabeza', 'sup:brazos', 'sup:barra', 'del:pie', 'del:tibia', 'del:muslo', 'tras:pie', 'tras:tibia', 'tras:muslo']
/** Los cuerpos que giran con inercia propia y el segmento de de Leva de cada uno. */
const CON_INERCIA: Partial<Record<Clave, SegmentoConInercia>> = {
  'sup:tronco': 'tronco',
  'sup:cabeza': 'cabeza',
  'del:tibia': 'tibia',
  'del:muslo': 'muslo',
  'tras:tibia': 'tibia',
  'tras:muslo': 'muslo',
}

interface Foto {
  pos: Map<Clave, { kg: number; z: number; y: number }>
  /** Ángulo desde la vertical de cada cuerpo con inercia. */
  ang: Map<Clave, number>
}

function foto(esc: Escenario, pose: PoseDeZancada): Foto {
  const pos = new Map<Clave, { kg: number; z: number; y: number }>()
  for (const m of esc.superior) pos.set(`sup:${m.nombre}` as Clave, m)
  for (const [lado, p] of [['del', esc.delantera], ['tras', esc.trasera]] as const) {
    for (const n of ['pie', 'tibia', 'muslo'] as const) pos.set(`${lado}:${n}` as Clave, p.masas[n])
  }
  const ang = new Map<Clave, number>([
    ['sup:tronco', pose.tronco],
    ['sup:cabeza', pose.cabeza],
    ['del:tibia', esc.delantera.tibia],
    ['del:muslo', esc.delantera.muslo],
    ['tras:tibia', esc.trasera.tibia],
    ['tras:muslo', esc.trasera.muslo],
  ])
  return { pos, ang }
}

function largoDe(s: Sujeto, seg: SegmentoConInercia): number {
  if (seg === 'tibia') return s.segmentos.tibia.largoM
  if (seg === 'muslo') return s.segmentos.muslo.largoM
  return DE_LEVA_CERV[s.sexo][seg].largo * (s.talla / DE_LEVA[s.sexo].estaturaDeReferencia)
}

/** Los cuerpos del cuadro `k` con sus aceleraciones (diferencias finitas de 3 puntos) y, si `radio` no es `ninguno`, su inercia y aceleración angular. */
function cuerposDelCuadro(s: Sujeto, fotos: readonly Foto[], tiempos: readonly number[], k: number, radio: 'min' | 'max' | 'ninguno'): Cuerpos {
  const [i0, i1, i2] = [k - 1, k, k + 1]
  const mapa = new Map<Clave, CuerpoEnMovimiento>()
  for (const clave of CLAVES) {
    const p = (i: number) => fotos[i]!.pos.get(clave)!
    const esPie = clave === 'del:pie' || clave === 'tras:pie'
    const az = esPie ? 0 : derivadaSegunda(tiempos[i0]!, p(i0).z, tiempos[i1]!, p(i1).z, tiempos[i2]!, p(i2).z)
    const ay = esPie ? 0 : derivadaSegunda(tiempos[i0]!, p(i0).y, tiempos[i1]!, p(i1).y, tiempos[i2]!, p(i2).y)
    const c: CuerpoEnMovimiento = { kg: p(i1).kg, z: p(i1).z, y: p(i1).y, az, ay }
    const seg = CON_INERCIA[clave]
    if (radio !== 'ninguno' && seg) {
      const r = rangoDeRadio(s.sexo, seg)
      const th = (i: number) => fotos[i]!.ang.get(clave)!
      c.inercia = momentoDeInercia(radio === 'min' ? r.min : r.max, c.kg, largoDe(s, seg))
      c.alfa = -derivadaSegunda(tiempos[i0]!, th(i0), tiempos[i1]!, th(i1), tiempos[i2]!, th(i2))
    }
    mapa.set(clave, c)
  }
  const g = (c: Clave) => mapa.get(c)!
  return {
    superior: [g('sup:tronco'), g('sup:cabeza'), g('sup:brazos'), g('sup:barra')],
    delantera: { pie: g('del:pie'), tibia: g('del:tibia'), muslo: g('del:muslo') },
    trasera: { pie: g('tras:pie'), tibia: g('tras:tibia'), muslo: g('tras:muslo') },
  }
}

/** Σ m·a_z de todo el cuerpo: la fuerza horizontal neta que pediría el suelo (N). */
export function fuerzaHorizontalNeta(c: Cuerpos): number {
  return [...c.superior, ...Object.values(c.delantera), ...Object.values(c.trasera)].reduce((t, x) => t + x.kg * x.az, 0)
}

/**
 * La serie de momentos de la búlgara por pierna: estático (la misma pose sin aceleración), total (con aceleración) e inercial (la diferencia), cada uno
 * con la regla del reparto aplicada al `F_total` de ese cuadro. Los extremos y todo cuadro cuya entrada no sirve salen `no_afirmable` con el motivo.
 */
export function momentosDeBulgaraEnElTiempo(e: EntradaDeSerieDeBulgara): ResultadoDeSerieDeBulgara {
  const v = VERSION_DEL_MODELO
  const todos = (motivo: string): ResultadoDeSerieDeBulgara => ({
    motivo,
    marcos: (e.instantes ?? []).map((x, i) => marcoNoAfirmable(i, finito(x?.t) ? x.t : Number.NaN, motivo)),
  })
  const sujeto = construirSujeto(e)
  if (!sujeto) return todos('talla, masa o sexo ausentes o fuera de rango')
  if (!finito(e.cargaKg) || e.cargaKg < 0) return todos('carga ausente o negativa')
  if (typeof e.fuenteDeAngulos !== 'string' || e.fuenteDeAngulos.trim() === '') {
    return todos('la fuente de los ángulos no está declarada: sin ella el término inercial no se afirma')
  }
  const ins = e.instantes
  if (!ins || ins.length < 3) return todos('hacen falta al menos 3 instantes para una aceleración')
  const escenarios: Escenario[] = []
  for (let i = 0; i < ins.length; i++) {
    if (!finito(ins[i]?.t) || (i > 0 && !(ins[i]!.t > ins[i - 1]!.t))) return todos('los instantes deben ser finitos y estrictamente crecientes')
    const val = validarEntrada({ sexo: e.sexo, talla: e.talla, masa: e.masa, cargaKg: e.cargaKg, pose: ins[i]!.pose })
    if (typeof val === 'string') return todos(val)
    const esc = resolverEscenario(sujeto, e.cargaKg, val.pose)
    if (typeof esc === 'string') return todos(esc)
    escenarios.push(esc)
  }
  const p0 = ins[0]!.pose
  const se = (a: number, b: number) => Math.abs(a - b) < 1e-9
  if (!ins.every((x) => se(x.pose.pasoM, p0.pasoM) && se(x.pose.alturaTobilloTraseroM, p0.alturaTobilloTraseroM) && se(x.pose.pieZ, p0.pieZ) && se(x.pose.copTraseroM, p0.copTraseroM))) {
    return todos('los pies de apoyo se mueven entre cuadros: la búlgara los supone fijos (paso, elevación, pie y punto de apoyo constantes)')
  }
  const fotos = ins.map((x, i) => foto(escenarios[i]!, x.pose))
  const tiempos = ins.map((x) => x.t)
  const fuenteRadios = (['tibia', 'muslo', 'tronco', 'cabeza'] as const).flatMap((n) => idsDeRadio(sujeto.sexo, n))
  const fuente = [...fuentesDeLeva(sujeto.sexo), ...IDS_DE_LA_REGLA_BULGARA, ...fuenteRadios, `angulos:${e.fuenteDeAngulos.trim()}`]
  const supuestos = [
    ...SUPUESTOS_DE_LA_REGLA,
    ...SUPUESTOS_GEOMETRICOS,
    'ángulos de entrada sin ruido: la segunda derivada amplifica el ruido, se propaga aparte',
    'derivada segunda por diferencias finitas de 3 puntos; sin vecino a ambos lados no se calcula',
    'los dos pies fijos; las piernas, el tronco y la cabeza giran con la inercia de de Leva (rango sagital-transverso); brazos y carga son masas puntuales sin inercia propia',
    'el inercial por pierna no tiene estudio que lo separe: sale no_afirmable; el total de cada pierna es la regla aplicada al F_total con aceleración, con el sesgo de la concéntrica',
  ]

  const marcos = ins.map((x, k): MarcoDeBulgara => {
    if (k === 0 || k === ins.length - 1) return marcoNoAfirmable(k, x.t, 'sin vecino a ambos lados: la aceleración no se extrapola')
    const esc = escenarios[k]!
    const zTras = esc.trasera.tobillo.z + x.pose.copTraseroM
    const quietos = cuerposQuietos(esc)
    const dinamicos = (['min', 'max'] as const).map((r) => cuerposDelCuadro(sujeto, fotos, tiempos, k, r))
    const ninguno = cuerposDelCuadro(sujeto, fotos, tiempos, k, 'ninguno')
    // por cada combinación (regla × CP trasero): estático, y dinámico con el radio mínimo y el máximo
    const filas: { est: EvaluacionDeBulgara; din: EvaluacionDeBulgara[] }[] = []
    let nominal: { est: EvaluacionDeBulgara; din: EvaluacionDeBulgara[] } | null = null
    for (const f of PASOS_DE_LA_REGLA) {
      for (const d of PASOS_DEL_CP) {
        const est = evaluarBulgara(sujeto, esc, quietos, f, zTras + d)
        const din = dinamicos.map((c) => evaluarBulgara(sujeto, esc, c, f, zTras + d))
        if (!est || din.some((r) => r === null)) continue
        const fila = { est, din: din as EvaluacionDeBulgara[] }
        filas.push(fila)
        if (f === FRACCION_TRASERA_BULGARA.central && d === 0) nominal = fila
      }
    }
    if (!nominal) {
      return marcoNoAfirmable(k, x.t, 'con la regla de la búlgara el centro de presión del pie delantero cae fuera del pie (o la delantera no lleva peso): pose y regla no son compatibles')
    }
    const nom = nominal
    const cifra = (id: string, valor: number, serie: number[], nivel: string): Cifra => ({
      id,
      valor,
      unidad: 'N·m',
      estado: 'estimado',
      fuente,
      supuestos,
      banda: { inf: Math.min(valor, ...serie), sup: Math.max(valor, ...serie), nivel: nivelConCobertura(nivel, filas.length) },
      version: v,
    })
    const mom = (lado: Lado, a: Articulacion): MomentoDeBulgara => {
      const sEst = (r: { est: EvaluacionDeBulgara }) => r.est[lado][a]
      const sTot = (r: { din: EvaluacionDeBulgara[] }, i: number) => r.din[i]![lado][a]
      const media = (r: { din: EvaluacionDeBulgara[] }) => (sTot(r, 0) + sTot(r, 1)) / 2
      const estatico = sEst(nom)
      const total = media(nom)
      const serieTotal = filas.flatMap((r) => [sTot(r, 0), sTot(r, 1)])
      return {
        estatico: cifra(`bulgara.${lado}.momento.${a}`, estatico, filas.map(sEst), NIVEL_ESTATICO),
        inercial: noAfirmable(`bulgara.${lado}.momento.inercial.total.${a}`, 'N·m', MOTIVO_INERCIAL_POR_PIERNA, v),
        total: cifra(`bulgara.${lado}.momento.dinamico.${a}`, total, serieTotal, NIVEL_DINAMICO),
      }
    }
    const pata = (lado: Lado) => ({ tobillo: mom(lado, 'tobillo'), rodilla: mom(lado, 'rodilla'), cadera: mom(lado, 'cadera') })
    // término inercial del CUERPO ENTERO: Σ m·a_y = fuerza vertical total − peso (cuerpo + carga); no depende de la regla del reparto
    const pesoN = (sujeto.masa + e.cargaKg) * GRAVEDAD
    const inerciales = filas.flatMap((fl) => fl.din.map((d) => d.fuerzaTotalN - pesoN))
    const valorInercial = nom.din[0]!.fuerzaTotalN - pesoN
    const inercialCuerpoEntero: Cifra = {
      id: 'bulgara.cuerpo.inercial.fuerza_vertical',
      valor: valorInercial,
      unidad: 'N',
      estado: 'estimado',
      fuente,
      supuestos,
      banda: { inf: Math.min(valorInercial, ...inerciales), sup: Math.max(valorInercial, ...inerciales), nivel: NIVEL_INERCIAL_CUERPO_ENTERO },
      version: v,
    }
    return {
      indice: k,
      t: x.t,
      delantera: pata('delantera'),
      trasera: pata('trasera'),
      horizontalNoRepartidaN: fuerzaHorizontalNeta(ninguno),
      fuerzaTotalN: nom.din[0]!.fuerzaTotalN,
      fuerzaTraseraN: nom.din[0]!.fuerzaTraseraN,
      inercialCuerpoEntero,
    }
  })
  return { motivo: null, marcos }
}

