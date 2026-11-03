import { noAfirmable, type Cifra } from './contrato'
import { GRAVEDAD, VERSION_DEL_MODELO } from './convenciones'
import { fuentesDeLeva, type MasaPuntual } from './dinamica'
import { geometriaDePesoMuerto } from './pesoMuerto'
import { construirSujeto, type EntradaDelSujeto, type Sujeto } from './sujeto'

/**
 * ZANCADA CON MANCUERNAS: dinámica ESTÁTICA en el plano sagital, de cada pierna por separado (la delantera y la trasera no hacen lo mismo).
 *
 * Misma cadena y mismos signos que la sentadilla (positivo = lo que hacen los músculos: extensor de cadera y de rodilla, flexor plantar; ángulos
 * de segmento desde la vertical, + hacia +z), pero con DOS apoyos: el pie delantero plano en el origen (z = 0, y = 0) y el trasero `pasoM` metros
 * detrás, con el talón a `alturaTobilloTraseroM` del suelo. La carga son mancuernas en las manos, a los lados: en el plano sagital cuelgan de los
 * brazos verticales como en el peso muerto (`pesoMuerto.ts`), con `cargaKg` = la SUMA de las dos.
 *
 * LA PIERNA TRASERA no trae ángulos: su cadera es la misma del delantero y su tobillo está en el suelo, así que la rodilla sale de resolver el
 * triángulo cadera-rodilla-tobillo con los largos de muslo y tibia (la solución con la rodilla por delante de la línea cadera-tobillo, que es
 * la flexión de rodilla). Si el tobillo trasero no alcanza, `no_afirmable`.
 *
 * LO QUE LA ESTÁTICA NO DETERMINA y aquí se SUPONE (cada uno con su efecto, y la banda lo recoge):
 *  1. Cuánto peso lleva cada pierna. Se reparte la fuerza vertical por la regla de la palanca entre los dos centros de presión (CP) para que el
 *     centro de masas del cuerpo entero quede sobre la recta de las dos reacciones. Si el centro de masas queda fuera de los dos apoyos, el cuerpo
 *     se caería: `no_afirmable`.
 *  2. Dónde está el CP de cada pie: el delantero en el centro de masas del pie (`pieZ` delante del tobillo), el trasero en la bola del pie
 *     (`copTraseroM` delante del tobillo trasero). La BANDA de cada momento es la envolvente de mover cada CP ±`INCERTIDUMBRE_DEL_CP_M`
 *     (convencion_propuesta, sin fuente), con el reparto siguiendo la regla de la palanca. No es un intervalo de confianza.
 *  3. Solo fuerza vertical en el suelo (sin fricción ni aceleración).
 *  4. El centro de masas del pie trasero es el mismo `pieZ` delante de su tobillo (el pie con el talón levantado está inclinado: no se modela).
 *  5. Brazos estirados y verticales; el hombro en el punto cervical (igual que en el peso muerto).
 * Sin término inercial: con aceleración el reparto de la reacción del suelo entre los dos pies no tiene regla publicada, y no se inventa una.
 */

export const INCERTIDUMBRE_DEL_CP_M = 0.03

export interface PoseDeZancada {
  /** Ángulos desde la vertical (rad, + hacia +z) del segmento de la pierna delantera. */
  tibiaDelantera: number
  musloDelantero: number
  tronco: number
  cabeza: number
  /** Recta hombro-mano desde la vertical (rad, + adelante); 0 = brazos verticales con las mancuernas a los lados. */
  brazo: number
  /** Distancia horizontal entre los dos tobillos (m, >= 0): el trasero va detrás del delantero. */
  pasoM: number
  /** Altura del tobillo trasero sobre el suelo (m, >= 0): el talón levantado. */
  alturaTobilloTraseroM: number
  /** Centro de masas (y CP) del pie delantero, delante del tobillo (m). */
  pieZ: number
  /** CP del pie trasero, delante del tobillo trasero (m): la bola del pie. */
  copTraseroM: number
}

export interface EntradaDeZancada extends EntradaDelSujeto {
  /** Suma de las dos mancuernas, kg. */
  cargaKg: number | null | undefined
  pose: PoseDeZancada | null | undefined
}

interface P2 {
  z: number
  y: number
}

const finito = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const dir = (a: number): P2 => ({ z: Math.sin(a), y: Math.cos(a) })

export interface PiernaResuelta {
  tobillo: P2
  rodilla: P2
  cadera: P2
  /** Ángulos de segmento (rad, desde la vertical, + adelante), en la convención de la sentadilla. */
  tibia: number
  muslo: number
  masas: { pie: MasaPuntual; tibia: MasaPuntual; muslo: MasaPuntual }
}

function pierna(s: Sujeto, tobillo: P2, rodilla: P2, cadera: P2, pieZ: number): PiernaResuelta {
  const { tibia, muslo, pie } = s.segmentos
  const at = (a: P2, b: P2, cm: number) => ({ z: b.z + cm * (a.z - b.z), y: b.y + cm * (a.y - b.y) }) // cm del largo medido desde `b` hacia `a`
  const cmTibia = at(tobillo, rodilla, tibia.cm) // desde la rodilla (proximal) hacia el tobillo
  const cmMuslo = at(rodilla, cadera, muslo.cm) // desde la cadera (proximal) hacia la rodilla
  return {
    tobillo,
    rodilla,
    cadera,
    tibia: Math.atan2(rodilla.z - tobillo.z, rodilla.y - tobillo.y),
    muslo: Math.atan2(cadera.z - rodilla.z, cadera.y - rodilla.y),
    masas: {
      pie: { nombre: 'pie', kg: pie.masaKg, z: tobillo.z + pieZ, y: tobillo.y },
      tibia: { nombre: 'tibia', kg: tibia.masaKg, ...cmTibia },
      muslo: { nombre: 'muslo', kg: muslo.masaKg, ...cmMuslo },
    },
  }
}

/** La rodilla trasera: la del triángulo cadera-rodilla-tobillo con la rodilla por delante de la recta cadera-tobillo; `null` si no alcanza. */
export function rodillaDeLaPiernaTrasera(cadera: P2, tobillo: P2, largoTibia: number, largoMuslo: number): P2 | null {
  const dz = cadera.z - tobillo.z
  const dy = cadera.y - tobillo.y
  const D = Math.hypot(dz, dy)
  if (D > largoTibia + largoMuslo || D < Math.abs(largoTibia - largoMuslo) || D === 0) return null
  const a = (largoTibia ** 2 - largoMuslo ** 2 + D ** 2) / (2 * D) // distancia del tobillo al pie de la perpendicular
  const h = Math.sqrt(Math.max(0, largoTibia ** 2 - a ** 2))
  const base = { z: tobillo.z + (a * dz) / D, y: tobillo.y + (a * dy) / D }
  const n = { z: dy / D, y: -dz / D } // perpendicular a la recta tobillo->cadera; con dy > 0 apunta hacia +z (delante)
  const signo = n.z >= 0 ? 1 : -1
  return { z: base.z + signo * h * n.z, y: base.y + signo * h * n.y }
}

export interface MomentosDePierna {
  tobillo: number
  rodilla: number
  cadera: number
}

/** Momentos (N·m) de una pierna, de abajo arriba: reacción vertical `fuerza` (N) en `zCp` y los pesos de lo que hay bajo cada articulación. */
export function momentosDeUnaPierna(p: PiernaResuelta, fuerza: number, zCp: number): MomentosDePierna {
  const { pie, tibia, muslo } = p.masas
  const w = (m: MasaPuntual, zj: number) => GRAVEDAD * m.kg * (m.z - zj)
  const tTobillo = fuerza * (zCp - p.tobillo.z) - w(pie, p.tobillo.z)
  const tRodilla = fuerza * (zCp - p.rodilla.z) - w(pie, p.rodilla.z) - w(tibia, p.rodilla.z)
  const tCadera = fuerza * (zCp - p.cadera.z) - w(pie, p.cadera.z) - w(tibia, p.cadera.z) - w(muslo, p.cadera.z)
  return { tobillo: tTobillo, rodilla: -tRodilla, cadera: tCadera } // mismos signos que la sentadilla: rodilla es extensora con el signo cambiado
}

export interface EstadoDeApoyo {
  /** Fracción de la fuerza vertical que lleva la pierna delantera, en [0, 1]. */
  delantera: number
  zComM: number
}

/** Reparto por la regla de la palanca; `null` si el centro de masas cae fuera de los dos apoyos. */
export function repartoPorPalanca(zCom: number, zCpDelantero: number, zCpTrasero: number): number | null {
  if (Math.abs(zCpDelantero - zCpTrasero) < 1e-9) return Math.abs(zCom - zCpDelantero) < 1e-6 ? 0.5 : null
  const f = (zCom - zCpTrasero) / (zCpDelantero - zCpTrasero)
  return f < 0 || f > 1 ? null : f
}

export interface ResultadoDeZancada {
  delantera: { tobillo: Cifra; rodilla: Cifra; cadera: Cifra }
  trasera: { tobillo: Cifra; rodilla: Cifra; cadera: Cifra }
  /** Fracción de la fuerza vertical en la pierna delantera (adimensional): es un supuesto, no una medida. */
  repartoDelantera: Cifra
  inercial: Cifra
  /** La rodilla y los ángulos de segmento de la pierna trasera que salieron del triángulo; `null` si no hubo solución. */
  piernaTrasera: PiernaResuelta | null
}

const SUPUESTOS = [
  'estático: sin aceleración ni fricción (solo fuerza vertical en el suelo)',
  'reparto de la fuerza vertical entre los dos pies por la regla de la palanca con el centro de masas del cuerpo entero',
  'centro de presión de cada pie: el delantero en el centro de masas del pie, el trasero en la bola del pie; la banda es la envolvente de moverlos ± 3 cm',
  'pierna trasera: rodilla resuelta del triángulo cadera-rodilla-tobillo con los largos de de Leva',
  'mancuernas en las manos con los brazos estirados y verticales; hombro en el punto cervical',
  'proporciones poblacionales de de Leva 1996 escaladas a la talla y la masa',
]
const NIVEL_DE_LA_BANDA = 'envolvente de mover cada centro de presión ± 3 cm con el reparto por la regla de la palanca; no es un intervalo de confianza'

function sinDato(motivo: string): ResultadoDeZancada {
  const v = VERSION_DEL_MODELO
  const na = (id: string) => noAfirmable(id, 'N·m', motivo, v)
  const pierna3 = (lado: string) => ({
    tobillo: na(`zancada.${lado}.momento.tobillo`),
    rodilla: na(`zancada.${lado}.momento.rodilla`),
    cadera: na(`zancada.${lado}.momento.cadera`),
  })
  return {
    delantera: pierna3('delantera'),
    trasera: pierna3('trasera'),
    repartoDelantera: noAfirmable('zancada.reparto.delantera', '1', motivo, v),
    inercial: noAfirmable('zancada.momento.inercial', 'N·m', 'la aceleración no tiene regla de reparto de la reacción entre los dos pies', v),
    piernaTrasera: null,
  }
}

export interface Escenario {
  delantera: PiernaResuelta
  trasera: PiernaResuelta
  /** Masas del tronco, la cabeza, los brazos y la carga (lo que va sobre la cadera). */
  superior: MasaPuntual[]
}

export function resolverEscenario(s: Sujeto, cargaKg: number, p: PoseDeZancada): Escenario | string {
  const { tibia, muslo } = s.segmentos
  const ankle: P2 = { z: 0, y: 0 }
  const uT = dir(p.tibiaDelantera)
  const rodilla: P2 = { z: tibia.largoM * uT.z, y: tibia.largoM * uT.y }
  const uM = dir(p.musloDelantero)
  const cadera: P2 = { z: rodilla.z + muslo.largoM * uM.z, y: rodilla.y + muslo.largoM * uM.y }
  const delantera = pierna(s, ankle, rodilla, cadera, p.pieZ)
  const tobilloTrasero: P2 = { z: -p.pasoM, y: p.alturaTobilloTraseroM }
  const rodillaTrasera = rodillaDeLaPiernaTrasera(cadera, tobilloTrasero, tibia.largoM, muslo.largoM)
  if (!rodillaTrasera) return 'el tobillo trasero no alcanza la cadera con los largos de muslo y tibia'
  const trasera = pierna(s, tobilloTrasero, rodillaTrasera, cadera, p.pieZ)
  const base = geometriaDePesoMuerto(s, cargaKg, {
    tibia: p.tibiaDelantera,
    muslo: p.musloDelantero,
    tronco: p.tronco,
    cabeza: p.cabeza,
    brazo: p.brazo,
    pieZ: p.pieZ,
  })
  return { delantera, trasera, superior: base.porEncimaDeLaCadera }
}

function centroDeMasas(e: Escenario): number {
  const todas = [...e.superior, ...Object.values(e.delantera.masas), ...Object.values(e.trasera.masas)]
  const kg = todas.reduce((t, m) => t + m.kg, 0)
  return todas.reduce((t, m) => t + m.kg * m.z, 0) / kg
}

const pesoTotal = (e: Escenario): number =>
  GRAVEDAD * [...e.superior, ...Object.values(e.delantera.masas), ...Object.values(e.trasera.masas)].reduce((t, m) => t + m.kg, 0)

/** Los seis momentos y el reparto para unos centros de presión dados; `null` si el centro de masas cae fuera de los apoyos. */
export function momentosConCp(e: Escenario, zCpDelantero: number, zCpTrasero: number): { delantera: MomentosDePierna; trasera: MomentosDePierna; reparto: number } | null {
  const f = repartoPorPalanca(centroDeMasas(e), zCpDelantero, zCpTrasero)
  if (f === null) return null
  const W = pesoTotal(e)
  return {
    delantera: momentosDeUnaPierna(e.delantera, f * W, zCpDelantero),
    trasera: momentosDeUnaPierna(e.trasera, (1 - f) * W, zCpTrasero),
    reparto: f,
  }
}

/** Los momentos de cada pierna con su banda; sin algo, todo `no_afirmable` con el motivo. */
export function momentosDeZancada(entrada: EntradaDeZancada): ResultadoDeZancada {
  const v = VERSION_DEL_MODELO
  const sujeto = construirSujeto(entrada)
  if (!sujeto) return sinDato('talla, masa o sexo ausentes o fuera de rango')
  if (!finito(entrada.cargaKg) || entrada.cargaKg < 0) return sinDato('carga ausente o negativa')
  const p = entrada.pose
  const campos = p ? [p.tibiaDelantera, p.musloDelantero, p.tronco, p.cabeza, p.brazo, p.pasoM, p.alturaTobilloTraseroM, p.pieZ, p.copTraseroM] : []
  if (!p || !campos.every(finito)) return sinDato('algún ángulo, la distancia entre los pies o un punto de apoyo falta')
  if (p.pasoM < 0 || p.alturaTobilloTraseroM < 0) return sinDato('el paso y la altura del talón trasero no pueden ser negativos')
  const esc = resolverEscenario(sujeto, entrada.cargaKg, p)
  if (typeof esc === 'string') return sinDato(esc)
  const zf = esc.delantera.tobillo.z + p.pieZ
  const zr = esc.trasera.tobillo.z + p.copTraseroM
  const nominal = momentosConCp(esc, zf, zr)
  if (!nominal) return sinDato('el centro de masas cae fuera de los dos apoyos: el cuerpo no se sostendría')

  // envolvente: cada CP ±3 cm (el reparto sigue a la regla de la palanca); las combinaciones sin solución se descartan y se cuentan
  const combos: NonNullable<ReturnType<typeof momentosConCp>>[] = []
  for (const df of [-INCERTIDUMBRE_DEL_CP_M, 0, INCERTIDUMBRE_DEL_CP_M]) {
    for (const dr of [-INCERTIDUMBRE_DEL_CP_M, 0, INCERTIDUMBRE_DEL_CP_M]) {
      const m = momentosConCp(esc, zf + df, zr + dr)
      if (m) combos.push(m)
    }
  }
  const fuente = fuentesDeLeva(sujeto.sexo)
  const cifra = (id: string, valor: number, serie: number[], unidad: 'N·m' | '1' = 'N·m'): Cifra => ({
    id,
    valor,
    unidad,
    estado: 'estimado',
    fuente,
    supuestos: SUPUESTOS,
    banda: { inf: Math.min(valor, ...serie), sup: Math.max(valor, ...serie), nivel: NIVEL_DE_LA_BANDA },
    version: v,
  })
  const pata = (lado: 'delantera' | 'trasera') => {
    const art = (k: keyof MomentosDePierna) =>
      cifra(`zancada.${lado}.momento.${k}`, nominal[lado][k], combos.map((c) => c[lado][k]))
    return { tobillo: art('tobillo'), rodilla: art('rodilla'), cadera: art('cadera') }
  }
  return {
    delantera: pata('delantera'),
    trasera: pata('trasera'),
    repartoDelantera: cifra('zancada.reparto.delantera', nominal.reparto, combos.map((c) => c.reparto), '1'),
    inercial: noAfirmable('zancada.momento.inercial', 'N·m', 'la aceleración no tiene regla de reparto de la reacción entre los dos pies', v),
    piernaTrasera: esc.trasera,
  }
}
