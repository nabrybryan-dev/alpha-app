/**
 * CAMINO RÁPIDO del registrador (Bryan, 3-oct: «que responda en tiempo real»).
 *
 * Para las frases MÁS simples de entreno el modelo no aporta nada: un ejercicio, números explícitos,
 * ninguna palabra de más. Aquí se arma, con una gramática cerrada, la MISMA extracción cruda que
 * devolvería el modelo; después pasa por lo de siempre (`validarExtraccion` + `resolverPropuesta`).
 * No hay un segundo resolutor: solo se evita esperar ~2 s a Haiku.
 *
 * REGLAS (ante la mínima duda se devuelve `null` y la frase va al modelo):
 *  1. La frase ENTERA debe casar con una de las formas de abajo. Una palabra de más («como», «más o
 *     menos», «no no», «ayer», «pero»...) la saca del camino rápido.
 *  2. El ejercicio tiene que resolverse a UNO del plan de hoy, con confianza alta, sin pregunta,
 *     sin descartados, sin avisos, sin notas para el coach y sin tocar una serie ya guardada.
 *  3. Esto NO sustituye ningún filtro: el filtro de riesgo corre antes y el lector de riesgo con
 *     modelo corre siempre, igual que con el modelo.
 *
 * Banco: `rapido.test.ts` lo cruza con el corpus (cero diferencias frente a lo esperado y frente a
 * lo que sacó Haiku en los casos que acepta).
 */
import { normalizarTexto } from './numeros.ts'
import { validarExtraccion } from './esquema.ts'
import { resolverPropuesta } from './resolver.ts'
import type { ContextoRegistro, Propuesta } from './tipos.ts'

const UNIDADES = 'un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintidos|veintitres|veinticuatro|veinticinco|veintiseis|veintisiete|veintiocho|veintinueve'
const DECENAS = 'treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa'
const PALABRA_NUMERO = `(?:(?:${DECENAS})(?: y (?:${UNIDADES}))?|${UNIDADES}|cien)`
const NUM = `(?:\\d{1,3}(?:[.,]\\d{1,2})?|${PALABRA_NUMERO})`
const KILOS = '(?: (?:kilos|kilo|kg))?'
const EJ = '([a-z]+(?: [a-z]+){0,4})'
const PRE = '(?:hice (?:el |la |los |las )?|el |la |los |las )?'

/** Palabras que no pueden formar parte del nombre del ejercicio: delatan una frase que no es simple. */
const NO_ES_EJERCICIO = new Set((
  `${UNIDADES}|${DECENAS}|cien|series|serie|veces|vez|reps|repeticiones|por|y|o|ni|no|pero|sin|como|mas|menos|casi|algo|mismo|misma|igual|otra|otro|` +
  'ayer|hoy|anoche|antes|despues|luego|tambien|ademas|solo|nomas|apenas|aproximadamente|kilos|kilo|kg|libras|lb|lastre|mano|manos|lado|banda|' +
  'reserva|rir|fallo|calentamiento|hice|hize|hicimos|le|me|se|lo|que|puse|metí|meti'
).split('|'))

interface Forma { re: RegExp; leer: (m: RegExpMatchArray) => { ej: string; n?: string; reps: string; carga: string; unidad?: string } }

const FORMAS: Forma[] = [
  // «sentadilla 60 por 10», «hice remo con barra 50 por 10»
  { re: new RegExp(`^${PRE}${EJ} (${NUM})( (?:kilos|kilo|kg))? por (${NUM})$`), leer: (m) => ({ ej: m[1], carga: m[2], unidad: m[3]?.trim(), reps: m[4] }) },
  // «jalón al pecho tres series de doce con cuarenta y cinco»
  { re: new RegExp(`^${PRE}${EJ} (${NUM}) series de (${NUM}) con (${NUM})${KILOS}$`), leer: (m) => ({ ej: m[1], n: m[2], reps: m[3], carga: m[4] }) },
  // «sentadilla tres de diez con quince»
  { re: new RegExp(`^${PRE}${EJ} (${NUM}) de (${NUM}) con (${NUM})${KILOS}$`), leer: (m) => ({ ej: m[1], n: m[2], reps: m[3], carga: m[4] }) },
  // «gemelos 40 por 15 cuatro series», «isquios sentado 35 por 12 tres veces»
  { re: new RegExp(`^${PRE}${EJ} (${NUM}) por (${NUM}) (${NUM}) (?:series|veces)$`), leer: (m) => ({ ej: m[1], carga: m[2], reps: m[3], n: m[4] }) },
]

/** La extracción cruda (con la forma de la salida del modelo) o `null` si la frase no es de las simples. */
export function extraerRapido(frase: string): unknown | null {
  const t = normalizarTexto(frase)
  if (!t || t.length > 90) return null
  for (const f of FORMAS) {
    const m = t.match(f.re)
    if (!m) continue
    const x = f.leer(m)
    const palabras = x.ej.split(' ')
    if (palabras.some((p) => NO_ES_EJERCICIO.has(p))) return null
    return {
      intencion: ['entreno'],
      entreno: [{
        ejercicio: { cita: x.ej },
        bloques: [{
          ...(x.n ? { n_series: x.n } : {}),
          reps: x.reps,
          carga: { tipo: 'absoluta', valor: x.carga, ...(x.unidad ? { unidad_cita: x.unidad } : {}) },
        }],
      }],
    }
  }
  return null
}

/** ¿La propuesta es de las que no dejan nada en duda? Si no, la frase va al modelo. */
export function propuestaSinDudas(p: Propuesta, ctx: ContextoRegistro): boolean {
  if (p.accion !== 'tarjeta' || p.registros.length !== 1) return false
  const r = p.registros[0]
  if (r.campo !== 'series') return false
  return (
    r.confianza === 'alta' &&
    ctx.sesionHoyId !== null && ctx.sesionHoyId !== undefined && r.sesion_id === ctx.sesionHoyId &&
    r.origen === undefined && r.reemplaza === undefined && r.dicho === undefined &&
    r.avisos.length === 0 &&
    r.valor.length >= 1 &&
    p.descartado.length === 0 && p.notas_coach.length === 0 && p.citas_invalidas.length === 0 &&
    p.pregunta === undefined && p.seguimiento === undefined && p.aviso === undefined &&
    p.fecha_real === undefined && p.requiere_confirmacion_de_sesion !== true
  )
}

export interface ExtraccionRapida {
  /** Lo mismo que habría devuelto el modelo (entra a `validarExtraccion` como siempre). */
  bruto: unknown
}

/** Devuelve la extracción lista para el camino normal, o `null` si hay que llamar al modelo. */
export function caminoRapido(frase: string, ctx: ContextoRegistro): ExtraccionRapida | null {
  const bruto = extraerRapido(frase)
  if (bruto === null) return null
  const v = validarExtraccion(frase, bruto)
  if (v.citasInvalidas.length > 0) return null
  const p = resolverPropuesta(frase, v.extraccion, ctx, v.citasInvalidas)
  return propuestaSinDudas(p, ctx) ? { bruto } : null
}
