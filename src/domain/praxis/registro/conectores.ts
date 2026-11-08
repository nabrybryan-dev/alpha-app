/**
 * Conectores: lo que la persona dice de forma vaga → la escala real de cada pregunta del check-in.
 * Diseño: docs/specs/2026-11-07-conectores-lenguaje-a-checkin-diseno.md (paso 1). PROPUESTA, nunca escritura.
 *
 * Va ENCIMA de `mensajeLargo.ts` (no lo copia ni lo cambia) y añade tres cosas:
 *  1. Lo vago («estoy ahí», «como medio», «no tan bien») se traduce a un nivel con confianza BAJA. Si cae entre
 *     dos niveles, no se elige: queda dudoso con los dos y la persona escoge.
 *  2. Un trozo vago que no nombra el área toma la de la pregunta anterior de Praxis, SOLO si esa pregunta era de
 *     un único campo. Sin pregunta, no se usa.
 *  3. Lo habitual («siempre duermo seis», «normalmente ando estresado») no es el check-in de hoy: sale aparte.
 *
 * Reglas firmes que se conservan: riesgo primero (lo hace `mensajeLargo`); la oración clínica no llena nada;
 * el hambre nunca sale de palabras (se pregunta el tramo); el dolor nunca se escribe por aquí; cita literal.
 * El lexicón de lo vago es PROPUESTA DE IA sin firma: Bryan lo aprueba por muestra.
 */
import { TRAMOS } from '../../senales/hambre.ts'
import { marcarSaludPorDiccionario } from '../ingreso/extraer.ts'
import { normalizarTexto } from './numeros.ts'
import { REGULAR_ES_FRECUENCIA } from './vida.ts'
import { respuestaCorta, type ValorCorto } from './respuestaCorta.ts'
import { palabraNueva } from './palabrasNuevas.ts'
import { anotacionDeTrozo, type Anotacion } from './anotaciones.ts'
import {
  proponerDesdeMensajeLargo, trozosDeMensaje,
  type AreaDudosa, type CampoCheckin, type TrozoDescartado, type ValorPropuesto,
} from './mensajeLargo.ts'
import type { MarcaDeRiesgo } from '../riesgo.ts'

export type Grado = 'medio' | 'medio_bajo' | 'medio_alto'

/** Lexicón de lo vago (texto normalizado, sin tildes). El orden importa: lo más específico primero. */
const LEXICO_VAGO: [RegExp, Grado][] = [
  [/\bno (tan|muy|tanto|del todo) (bien|buen[oa])\b/, 'medio_bajo'],
  [/\b(bien no mas|bien nada mas|mas o menos bien)\b/, 'medio_alto'],
  [/\b(no (tan|muy) mal|no me fue mal|ni bien ni mal|ni fu ni fa)\b/, 'medio'],
  // «Medio» delante de un adjetivo lo rebaja: «medio mal» queda entre regular y malo, «medio cansada» es regular.
  [/\bmedio (mal|regular|flojo|floja|pesimo|feo)\b/, 'medio_bajo'],
  [/\bmedio bien\b/, 'medio_alto'],
  [/\bmedi[oa] (cansad[oa]|estresad[oa]|agotad[oa]|agobiad[oa]|desanimad[oa]|con hambre|con ganas)\b/, 'medio'],
  [/\b(regularcito|regularcita|maso|masomenos)\b/, 'medio'],
  [/\b(estoy|ando|vamos|voy|va) ahi\b|\bahi (vamos|voy|va|ando|estoy)\b|^ahi$/, 'medio'],
  [/\b(como medio|medio medio|mas o menos|maso menos|normal|regular)\b|^(como )?medi[oa]$/, 'medio'],
]

export function gradoVago(cita: string): Grado | null {
  return formaVaga(cita)?.grado ?? null
}

/**
 * La expresión vaga que trae la cita, normalizada y SOLA («como medio», «no tan bien»), con su grado. Es lo único
 * que se guarda para aprender cómo habla cada persona: nunca la frase entera.
 */
export function formaVaga(cita: string): { forma: string; grado: Grado } | null {
  // «Voy regular al gimnasio»: el «regular» de frecuencia no es un grado (misma regla que vida.ts).
  const n = normalizarTexto(cita).replace(/\s+/g, ' ').trim().replace(REGULAR_ES_FRECUENCIA, ' ')
  for (const [re, grado] of LEXICO_VAGO) {
    const m = re.exec(n)
    if (m) return { forma: m[0].trim(), grado }
  }
  return null
}

/** Campos con escala de tres niveles, ordenados [bueno, medio, malo] según su polaridad. */
const ESCALA: Partial<Record<CampoCheckin, readonly [string, string, string]>> = {
  rendimiento: ['BUENA', 'REGULAR', 'MALA'],
  calidadSueno: ['BUENA', 'REGULAR', 'MALA'],
  alimentacion: ['BUENA', 'REGULAR', 'MALA'],
  motivacion: ['MUCHO', 'REGULAR', 'POCO'],
  cansancio: ['POCO', 'REGULAR', 'MUCHO'],
  estres: ['POCO', 'REGULAR', 'MUCHO'],
}

/** Niveles que admite un grado vago en un campo: uno (se propone) o dos (la persona elige). */
export function nivelesDeGrado(campo: CampoCheckin, grado: Grado): string[] {
  const e = ESCALA[campo]
  if (!e) return []
  if (grado === 'medio') return [e[1]]
  return grado === 'medio_bajo' ? [e[1], e[2]] : [e[0], e[1]]
}

export type Tiempo = 'hoy' | 'habitual'
const HABITUAL = /\b(siempre|normalmente|por lo general|generalmente|usualmente|habitualmente|todos los dias|todas las noches|suelo|acostumbro|duermo|me acuesto|me levanto)\b/
const HOY = /\b(hoy|anoche|esta manana|esta tarde|esta noche|ahora|ahorita|ayer|en este momento)\b/

/** Lo habitual va al perfil; todo lo demás se lee como de hoy (la tarjeta muestra la fecha y la persona confirma). */
export function tiempoDe(cita: string): Tiempo {
  const n = normalizarTexto(cita)
  return HABITUAL.test(n) && !HOY.test(n) ? 'habitual' : 'hoy'
}

/** Áreas que `mensajeLargo` pone en sus descartes → campo del check-in. Dolor, ánimo y horas no entran. */
const CAMPO_DE_AREA: Record<string, CampoCheckin> = {
  'estrés': 'estres', 'energía': 'cansancio', 'hambre': 'hambreEscala', 'motivación': 'motivacion',
  'rendimiento': 'rendimiento', 'alimentación': 'alimentacion', 'sueño': 'calidadSueno',
}

export interface PropuestaConectada extends ValorPropuesto { origen: 'tabla' | 'vago' }
export interface PreguntaDeTramo { campo: 'hambreEscala'; cita: string; texto: string; opciones: { etiqueta: string; desde: number; hasta: number }[] }
export interface Habitual { campo: CampoCheckin; valor: string | number; cita: string }
export interface ContextoConectores {
  /** Campo por el que Praxis preguntó en el turno anterior, si la pregunta era de UN solo campo. */
  preguntaAnterior?: CampoCheckin | null
}

export type ResultadoConectores =
  | { tipo: 'riesgo'; marca: MarcaDeRiesgo }
  | {
    tipo: 'propuesta'; propuestas: PropuestaConectada[]; dudosas: AreaDudosa[]
    preguntas: PreguntaDeTramo[]; habituales: Habitual[]; descartado: TrozoDescartado[]
    /** Para el cuaderno de la persona (0176): no llenan el check-in. Se guardan solo si ella toca la tarjeta. */
    anotaciones: Anotacion[]
  }

/** Texto de cada tramo del hambre, el mismo que enseña el formulario (CheckinForm, DESCRIPCION_TRAMO). */
const TEXTO_TRAMO: Record<string, string> = {
  leve: 'Molesta, pero se lleva', moderada: 'Cuesta, distrae',
  intensa: 'Interfiere con el trabajo o el entreno', insostenible: 'No la puedes sostener',
}

function preguntaDeHambre(cita: string): PreguntaDeTramo {
  return {
    campo: 'hambreEscala', cita, texto: '¿Cuál se parece más a tu hambre de hoy?',
    opciones: TRAMOS.map((t) => ({ etiqueta: TEXTO_TRAMO[t.etiqueta] ?? t.etiqueta, desde: t.bajo, hasta: t.alto })),
  }
}

type Salida = Extract<ResultadoConectores, { tipo: 'propuesta' }>

/** Coloca un trozo vago ya con campo: propuesta (un nivel), dudosa (dos), pregunta (hambre) o descarte. */
function colocarVago(campo: CampoCheckin, cita: string, grado: Grado, s: Salida): void {
  // Una sola pregunta por campo: «ahí, como medio» son dos trozos y no deben dar dos preguntas.
  if (campo === 'hambreEscala') { if (!s.preguntas.some((p) => p.campo === campo)) s.preguntas.push(preguntaDeHambre(cita)); return }
  const niveles = nivelesDeGrado(campo, grado)
  if (niveles.length === 0) {
    s.descartado.push({ area: campo, cita, motivo: 'este campo no se llena con una expresión vaga' })
  } else if (niveles.length === 1) {
    s.propuestas.push({ campo, valor: niveles[0], cita, confianza: 'baja', origen: 'vago' })
  } else {
    s.dudosas.push({ campo, candidatos: niveles.map((valor) => ({ valor, cita })), motivo: 'expresión vaga entre dos niveles: que la persona elija' })
  }
}

/** Un mismo campo con dos valores distintos (tabla y vago) no se elige: queda dudoso. */
function resolverChoques(s: Salida): void {
  const porCampo = new Map<CampoCheckin, PropuestaConectada[]>()
  for (const p of s.propuestas) porCampo.set(p.campo, [...(porCampo.get(p.campo) ?? []), p])
  const finales: PropuestaConectada[] = []
  for (const [campo, lista] of porCampo) {
    const yaDudosa = s.dudosas.find((d) => d.campo === campo)
    if (yaDudosa) { yaDudosa.candidatos.push(...lista.map((p) => ({ valor: p.valor, cita: p.cita }))); continue }
    if (new Set(lista.map((p) => String(p.valor))).size > 1) {
      s.dudosas.push({ campo, candidatos: lista.map((p) => ({ valor: p.valor, cita: p.cita })), motivo: 'el mensaje dice cosas distintas sobre lo mismo: que la persona elija' })
    } else finales.push(lista.find((p) => p.origen === 'tabla') ?? lista[0])
  }
  s.propuestas = finales
}

const esClinico = (cita: string) => marcarSaludPorDiccionario(cita).marcas.length > 0

/** Coloca lo que la tabla de vida.ts ya convirtió: habitual aparte; si la misma cita es vaga, manda lo vago. */
function colocarDeTabla(p: ValorPropuesto, s: Salida): void {
  if (tiempoDe(p.cita) === 'habitual') { s.habituales.push({ campo: p.campo, valor: p.valor, cita: p.cita }); return }
  const vaga = formaVaga(p.cita)
  const niveles = vaga ? nivelesDeGrado(p.campo, vaga.grado) : []
  // «Medio estresado»: «medio» delante del estado lo REBAJA a regular (tarjeta L6), aunque la tabla diga MUCHO.
  if (vaga?.grado === 'medio' && /^medi[oa] /.test(vaga.forma) && niveles.length === 1) {
    s.propuestas.push({ campo: p.campo, valor: niveles[0], cita: p.cita, confianza: 'baja', origen: 'vago' })
    return
  }
  // «Medio mal» trae «mal» y la tabla lee MALA a secas: si la misma cita es vaga, la persona elige.
  const juntos = [...new Set([...niveles, String(p.valor)])]
  if (niveles.length > 0 && juntos.length > 1) {
    s.dudosas.push({ campo: p.campo, candidatos: juntos.map((valor) => ({ valor, cita: p.cita })), motivo: 'la frase es vaga: que la persona elija' })
  } else s.propuestas.push({ ...p, origen: 'tabla' })
}

export function conectarMensaje(texto: string, ctx: ContextoConectores = {}): ResultadoConectores {
  const base = proponerDesdeMensajeLargo(texto)
  if (base.tipo === 'riesgo') return base
  const s: Salida = { tipo: 'propuesta', propuestas: [], dudosas: base.dudosas.map((d) => ({ ...d, candidatos: [...d.candidatos] })), preguntas: [], habituales: [], descartado: [], anotaciones: [] }

  // 0. Lo que no llena el check-in pero va al cuaderno de la persona (recuperación de una zona, reacción a una comida).
  for (const t of trozosDeMensaje(texto)) {
    const a = anotacionDeTrozo(t, esClinico)
    if (a) s.anotaciones.push(a)
  }

  // 1. Lo que la tabla ya convirtió: lo habitual sale aparte.
  for (const p of base.propuestas) colocarDeTabla(p, s)

  // 2. Lo que la tabla descartó en un área conocida: se intenta como vago («el sueño ahí» incluido).
  const vistas = new Set<string>([...base.propuestas, ...base.dudosas.flatMap((d) => d.candidatos)].map((c) => c.cita))
  for (const d of base.descartado) { vistas.add(d.cita); colocarDescartado(d, s) }

  // 3. Trozos sin área: heredan el área del trozo de antes («5 horas y mal») o la de la pregunta anterior.
  colocarSueltos(texto, ctx, vistas, campoDeCadaCita(base), s)

  resolverChoques(s)
  return s
}

/** Las palabras que solo NOMBRAN el área («el entreno estuvo …»): lo que sobra se lee como respuesta corta. */
const PALABRAS_DE_AREA = /\b(el|la|los|las|mi|mis|de|hoy|entreno|entrenamiento|rutina|sesion|gym|gimnasio|comida|alimentacion|dieta|sueno|estres|energia|cansancio|ganas|estuvo|esta|fue|me fue|anda|ando|estoy)\b/g

/** Lo que la tabla descartó en un área conocida: vago, «<área> ahí» o «<área> + respuesta corta»; si no, queda descartado. */
function colocarDescartado(d: TrozoDescartado, s: Salida): void {
  const campo = CAMPO_DE_AREA[d.area]
  if (!campo || esClinico(d.cita) || tiempoDe(d.cita) === 'habitual') { s.descartado.push(d); return }
  const grado = gradoConArea(d.cita)
  if (grado) { colocarVago(campo, d.cita, grado, s); return }
  const corta = respuestaCorta(normalizarTexto(d.cita).replace(PALABRAS_DE_AREA, ' '), campo) ?? palabraNueva(d.cita, campo)
  if (corta) colocarCorta(campo, d.cita, corta, s)
  else s.descartado.push(d)
}

/** Con el área ya nombrada en el trozo, «ahí» al final también es el medio («el sueño ahí»). Sin área, no: «lo dejé ahí». */
function gradoConArea(cita: string): Grado | null {
  return gradoVago(cita) ?? (/\bahi$/.test(normalizarTexto(cita).trim()) ? 'medio' : null)
}

type Base = Extract<ReturnType<typeof proponerDesdeMensajeLargo>, { tipo: 'propuesta' }>

/** De qué campo habla cada trozo que el paso de mensajes largos reconoció. Las horas de sueño heredan como calidad. */
function campoDeCadaCita(base: Base): Map<string, CampoCheckin> {
  const m = new Map<string, CampoCheckin>()
  for (const d of base.descartado) { const c = CAMPO_DE_AREA[d.area]; if (c && !m.has(d.cita)) m.set(d.cita, c) }
  for (const p of base.propuestas) if (!m.has(p.cita)) m.set(p.cita, p.campo === 'horasSueno' ? 'calidadSueno' : p.campo)
  return m
}

/** Un trozo que no nombra el área: respuesta corta o expresión vaga, con el área del trozo de antes o de la pregunta. */
function colocarSueltos(texto: string, ctx: ContextoConectores, vistas: Set<string>, campoDe: Map<string, CampoCheckin>, s: Salida): void {
  let previo: CampoCheckin | undefined
  for (const cita of trozosDeMensaje(texto)) {
    const propio = campoDe.get(cita)
    if (propio || vistas.has(cita)) { previo = propio; continue }
    const destino = previo ?? ctx.preguntaAnterior ?? undefined
    previo = undefined
    if (esClinico(cita) || tiempoDe(cita) === 'habitual') continue
    const corta = destino ? (respuestaCorta(cita, destino) ?? palabraNueva(cita, destino)) : null
    if (destino && corta) { colocarCorta(destino, cita, corta, s); continue }
    const grado = gradoVago(cita)
    if (!grado) continue
    if (!destino) s.descartado.push({ area: 'sin área', cita, motivo: 'expresión vaga sin decir de qué habla, y no hubo una pregunta antes' })
    else colocarVago(destino, cita, grado, s)
  }
}

function colocarCorta(campo: CampoCheckin, cita: string, c: ValorCorto, s: Salida): void {
  if ('valor' in c) s.propuestas.push({ campo, valor: c.valor, cita, confianza: 'media', origen: 'vago' })
  else s.dudosas.push({ campo, candidatos: c.entre.map((valor) => ({ valor, cita })), motivo: 'respuesta entre dos niveles: que la persona elija' })
}
