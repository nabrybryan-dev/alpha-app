import { sinTildes } from '../riesgo'
import type { EjercicioVisto, LoQuePraxisVe, MicrocicloVisto, SesionVista } from './listaBlanca'

/**
 * Lo que Praxis contesta del plan SIN modelo (DISENO.md §2.3: «las respuestas frecuentes no
 * gastan modelo»; §4: dato, razón, y lo que falte se dice).
 *
 * Cuatro salidas, y siempre con un siguiente paso:
 *   respuesta    → hay dato escrito y se cita.
 *   parcial      → hay dato pero falta el porqué. Se dice el dato y se ofrece preguntar.
 *   no_se        → no hay nada que citar. «Aún no tengo ese dato», y se ofrece preguntar.
 *   pide_cambio  → la persona pide tocar el plan. Praxis no cambia cargas, series,
 *                  ejercicios ni comida: eso es del coach.
 *
 * LO QUE NUNCA HACE: inventar un número, afirmar una causa («te lo bajaron porque…») o
 * proponer una carga. La única cuenta que hace es la diferencia entre dos cargas que ya
 * están escritas, y la dice como dato, no como razón. La hoja del porqué (decisión D2)
 * todavía no existe: hasta entonces, todo «¿por qué?» termina en dato + preguntar.
 */
export type Trato = 'tu' | 'usted'
export type QueFalto = 'sin_plan_activo' | 'sin_dato' | 'porque_no_escrito' | 'cambio_del_plan' | 'fuera_del_plan' | 'no_entendido'

/** La frase que Bryan pidió para cuando falta un dato. */
export const SIN_DATO = 'Aún no tengo ese dato'

export interface RespuestaDelPlan {
  tipo: 'respuesta' | 'parcial' | 'no_se' | 'pide_cambio'
  texto: string
  /** Referencias de lo citado, para que la persona pueda comprobar que Praxis no inventó. */
  citas: string[]
  ofrecePregunta: boolean
  queFalto?: QueFalto
}

const INTERROGATIVO = /^\s*¿?\s*(qué|por qué|para qué|cuál|cuáles|cuánto|cuánta|cuántos|cuántas|cómo|cuándo|dónde|quién|por que|para que|cuantos|cuantas|explica|explícame|explicame|dime|cuéntame)(?=\s|$)/i

/** ¿Es una pregunta (y no algo que anotar)? */
export function esPregunta(frase: string): boolean {
  return /[?¿]/.test(frase) || INTERROGATIVO.test(frase)
}

const PIDE_CAMBIO =
  /\b(me (subes|bajas|cambias|quitas|pones|agregas|aumentas|reduces)|subeme|bajame|cambiame|quitame|ponme|agregame|aumentame|(puedes|podrias|puedo|podria|quiero|quisiera|debo|deberia) (\w+ ){0,2}?(subir|bajar|cambiar|quitar|poner|agregar|aumentar|reducir|saltar)\w*)/

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

/** 37.5 → «37,5». */
function fmt(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

interface Hallado { ejercicio: EjercicioVisto; sesion: SesionVista }

/** El ejercicio del microciclo que la frase nombra: el que más palabras de su nombre comparte. */
function ejercicioNombrado(n: string, m: MicrocicloVisto | null): Hallado | null {
  if (!m) return null
  let mejor: Hallado | null = null
  let puntos = 0
  for (const sesion of m.sesiones) {
    for (const ejercicio of sesion.ejercicios) {
      const palabras = sinTildes(ejercicio.nombre).split(/[^a-z0-9]+/).filter((p) => p.length >= 4)
      const p = palabras.filter((w) => new RegExp(`\\b${w}`).test(n)).length
      if (p > puntos) { puntos = p; mejor = { ejercicio, sesion } }
    }
  }
  return mejor
}

function sesionDeHoy(m: MicrocicloVisto, hoy: string): SesionVista | null {
  const porFecha = m.sesiones.find((s) => s.fecha === hoy)
  if (porFecha) return porFecha
  const dia = DIAS[new Date(`${hoy}T12:00:00Z`).getUTCDay()]
  return m.sesiones.find((s) => !s.fecha && s.dia && sinTildes(s.dia) === dia) ?? null
}

export function responderDelPlan(frase: string, ve: LoQuePraxisVe, hoy: string, trato: Trato = 'tu'): RespuestaDelPlan {
  const n = sinTildes(frase)
  const t = (tu: string, usted: string) => (trato === 'usted' ? usted : tu)
  const m = ve.activo
  const noSe = (texto: string, queFalto: QueFalto): RespuestaDelPlan => ({ tipo: 'no_se', texto, citas: [], ofrecePregunta: true, queFalto })

  // 1. Pedir un cambio no es una consulta: Praxis no toca el plan.
  if (PIDE_CAMBIO.test(n)) {
    return { tipo: 'pide_cambio', texto: t('Yo no cambio cargas ni tu plan: eso lo decide tu coach.', 'Yo no cambio cargas ni su plan: eso lo decide su coach.'), citas: [], ofrecePregunta: true, queFalto: 'cambio_del_plan' }
  }

  const nombrado = ejercicioNombrado(n, m)

  // 2. El porqué: el dato sí, la causa no.
  if (/\bpor ?que\b/.test(n)) {
    if (!m || !nombrado) return noSe(t('El porqué de eso no lo tengo escrito, y no quiero adivinar.', 'El porqué de eso no lo tengo escrito, y no quiero adivinar.'), 'porque_no_escrito')
    const { ejercicio: e, sesion: s } = nombrado
    const previo = ve.cerrados[0]
    const antes = previo?.sesiones.flatMap((x) => x.ejercicios).find((x) => x.id === e.id)
    const citas: string[] = []
    let dato: string
    if (previo && antes?.cargaKg != null && e.cargaKg != null && antes.cargaKg !== e.cargaKg) {
      dato = t(`En ${e.nombre} pasaste de ${fmt(antes.cargaKg)} a ${fmt(e.cargaKg)} kg, del microciclo ${previo.numero} al ${m.numero}.`, `En ${e.nombre} pasó de ${fmt(antes.cargaKg)} a ${fmt(e.cargaKg)} kg, del microciclo ${previo.numero} al ${m.numero}.`)
      citas.push(`M${previo.numero}→M${m.numero} · ${e.nombre} · cargaKg`)
    } else {
      dato = t(`${e.nombre} está en tu ${s.nombre}: ${e.prescripcion}.`, `${e.nombre} está en su ${s.nombre}: ${e.prescripcion}.`)
      citas.push(`M${m.numero} · ${s.nombre} · ${e.nombre} · prescripcion`)
    }
    let nota = ''
    if (e.notaCoach) { nota = t(` Tu coach dejó esta nota: «${e.notaCoach}».`, ` Su coach dejó esta nota: «${e.notaCoach}».`); citas.push(`M${m.numero} · ${s.nombre} · ${e.nombre} · notaCoach`) }
    return { tipo: 'parcial', texto: `${dato}${nota} El porqué de ese cambio no lo tengo escrito.`, citas, ofrecePregunta: true, queFalto: 'porque_no_escrito' }
  }

  // 3. Un ejercicio: su prescripción, tal como está.
  if (m && nombrado) {
    const { ejercicio: e, sesion: s } = nombrado
    const citas = [`M${m.numero} · ${s.nombre} · ${e.nombre} · prescripcion`]
    let texto = `${e.nombre}, en ${s.nombre}: ${e.prescripcion}.`
    if (e.notaCoach) { texto += t(` Nota de tu coach: «${e.notaCoach}».`, ` Nota de su coach: «${e.notaCoach}».`); citas.push(`M${m.numero} · ${s.nombre} · ${e.nombre} · notaCoach`) }
    return { tipo: 'respuesta', texto, citas, ofrecePregunta: false }
  }

  // 4. Para qué es el plan.
  if (/para que (es|sirve)|objetivo|\bmeta\b/.test(n)) {
    const objetivo = ve.perfil?.objetivos?.trim()
    if (!objetivo) return noSe(t(`${SIN_DATO}: tu perfil no trae el objetivo escrito.`, `${SIN_DATO}: su perfil no trae el objetivo escrito.`), 'sin_dato')
    return { tipo: 'respuesta', texto: t(`Tu perfil dice que el objetivo es: «${objetivo}».`, `Su perfil dice que el objetivo es: «${objetivo}».`), citas: ['PERFIL · objetivos'], ofrecePregunta: false }
  }

  // 5. Qué toca hoy o esta semana.
  if (/\b(toca|tengo|hay|sigue|rutina|entreno|sesion|semana|hoy)\b/.test(n)) {
    if (!m) return noSe(t(`${SIN_DATO}: no veo un plan activo tuyo.`, `${SIN_DATO}: no veo un plan activo suyo.`), 'sin_plan_activo')
    const lista = m.sesiones.map((s) => (s.dia ? `${s.nombre} (${s.dia})` : s.nombre)).join(', ')
    const semana = t(`Esta semana, en tu microciclo ${m.numero}, tienes: ${lista}.`, `Esta semana, en su microciclo ${m.numero}, tiene: ${lista}.`)
    if (/\bsemana\b/.test(n)) return { tipo: 'respuesta', texto: semana, citas: [`M${m.numero} · semana`], ofrecePregunta: false }
    const s = sesionDeHoy(m, hoy)
    if (!s) return { tipo: 'respuesta', texto: t(`Para hoy no veo una sesión con fecha en tu plan. ${semana}`, `Para hoy no veo una sesión con fecha en su plan. ${semana}`), citas: [`M${m.numero} · semana`], ofrecePregunta: false }
    const ejercicios = s.ejercicios.map((e) => e.nombre).join(', ')
    const cuerpo = ejercicios || [...s.bloquesCardio, ...s.preparacion].map((p) => p.titulo).join(', ')
    return { tipo: 'respuesta', texto: t(`Hoy te toca ${s.nombre}${cuerpo ? `: ${cuerpo}` : ''}.`, `Hoy le toca ${s.nombre}${cuerpo ? `: ${cuerpo}` : ''}.`), citas: [`M${m.numero} · ${s.nombre}`], ofrecePregunta: false }
  }

  // 6. Lo demás: no se contesta de memoria.
  return noSe(t('Eso no está en lo que veo de tu plan, y no quiero adivinar.', 'Eso no está en lo que veo de su plan, y no quiero adivinar.'), 'fuera_del_plan')
}
