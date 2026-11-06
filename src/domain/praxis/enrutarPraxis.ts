// Rutas con «.ts»: este módulo lo importa también la Edge Function `praxis-registro` (Deno), que escribe
// la decisión en SOMBRA en `meta.decision`. Por eso no importa nada que no lleve extensión.
import { PRAXIS_ABIERTA_A_ASESORADOS, puedeVerPraxis, type Rol } from './acceso.ts'
import { filtroDeRiesgo, sinTildes } from './riesgo.ts'
// UN solo tipo de pregunta en toda la Praxis: el de la voz (decisión del 5-nov). Se importa por ruta relativa, como hace
// la función con `src/domain`; `tipoPregunta.ts` no importa nada, así que no arrastra dependencias a este módulo.
import { tipoDePregunta as tipoDeLaVoz, type TipoPregunta } from '../../../supabase/functions/praxis-registro/voz/tipoPregunta.ts'

export type { TipoPregunta }

/**
 * EL ENRUTADOR DE LA PRAXIS ÚNICA, POR REGLAS («F1», 4-nov-2026). Diseño: biblioteca-praxis
 * DISENO-ENRUTADOR-REAL-20261104.md §2.3 y §3, pasos 0 a 6. Hereda el contrato del enrutador de la PR #374
 * (decisión de Bryan del 17-oct): el riesgo va antes que la puerta, la puerta antes que la intención, y el
 * enrutador NUNCA escribe. No importa `enrutador.ts` de #374 porque esa PR sigue abierta y no está en main;
 * sus rutas `riesgo` y `salud` aquí se pliegan en `seguridad` con su subnivel, como pide el diseño.
 *
 * EN SOMBRA: hoy nadie decide nada con esto. La Edge Function lo calcula y lo deja en `meta.decision` y en
 * una línea de registro sin la frase, para comparar lo que diría el enrutador con lo que hizo la función.
 *
 * Qué NO hace (y quién lo hace):
 *   · pasos 7 y 8 (portero e5 y registrador Haiku): cuando las reglas no cierran, `ruta` es `null` y `pasaA`
 *     dice a qué capa le toca. No adivina: una ruta inventada aquí parecería decidida sin serlo.
 *   · navegar a pantallas de la app desde una frase: no hay léxico firmado; los destinos válidos están en
 *     `src/app/destinosPraxis.ts` y se usan en el paso 3 («F3»).
 *   · entender órdenes del salón: eso es `interpretarOrden` (features), que el cliente pasa ya leída en `orden`.
 */

export type RutaPraxis = 'bloqueada' | 'seguridad' | 'navegar' | 'registrar' | 'responder' | 'aclarar' | 'abstener'

/** Lo que `interpretarOrden` del salón entendió. Forma mínima: la `Orden` real encaja sin conversión. */
export interface OrdenLocal {
  tipo: string
  id?: string
  nombre?: string
  cara?: string
  opciones?: readonly string[]
}

export interface EntradaPraxis {
  frase: string
  rol: Rol
  personaId?: string
  ocupaElPuesto?: boolean
  abiertaAAsesorados?: boolean
  /** La frase contesta una pregunta de salud de Praxis: sigue por seguridad aunque no traiga marca (#374). */
  aclaracionSalud?: boolean
  /** Praxis acaba de preguntar algo o hay un borrador abierto: la respuesta corta no se reclasifica. */
  pendiente?: 'aclarar' | 'borrador'
  /** Solo en el salón: la orden ya leída. Fuera del salón no se pasa (allí «listo» no es «cerrar»). */
  orden?: OrdenLocal | null
  /** El camino rápido (gramática cerrada del plan de hoy) ya sacó un registro de la frase. */
  registroRapido?: boolean
}

export interface Destino {
  clase: 'zona' | 'ejercicio' | 'movimiento' | 'salon'
  id: string
}

export interface DecisionPraxis {
  /** `null`: las reglas no cierran la decisión y le toca a la capa de `pasaA`. */
  ruta: RutaPraxis | null
  /** Qué paso del diseño (§3) decidió. */
  paso: 1 | 2 | 3 | 4 | 5 | 6
  origen: 'reglas'
  subnivel?: 'riesgo' | 'salud'
  tipo?: TipoPregunta
  destino?: Destino
  opciones?: string[]
  /** «Cómo se hace X»: se abre el movimiento y se anota el hueco de contenido (decisión de Bryan, 4-nov). */
  hueco?: 'metodo'
  pasaA?: 'portero' | 'registrador'
  personaId?: string
  /** El enrutador nunca escribe: `registrar` propone una tarjeta y guardar sigue siendo `/guardar`. */
  escribe: false
  requiereConfirmacion: boolean
}

/** Paso 0: una sola normalización. Sin tildes, sin signos y sin el «hey Praxis» del principio. */
export function normalizar(frase: string): string {
  return sinTildes(frase)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^((hey|oye|hola|ok|okay)\s+)?praxis\b\s*/, '')
}

// Paso 6. El TIPO lo da la voz (`tipoDePregunta` de `voz/tipoPregunta.ts`, 5 tipos, medido con el tono aprobado); aquí solo se
// decide si la frase PARECE una pregunta, que es lo que antes inferían las reglas de ocho tipos. Un tipo de la voz distinto
// de `mi_caso` es una regla que acertó (la voz devuelve `mi_caso` cuando ninguna toca). «Permiso» y «comparación» ya no son
// tipos, pero siguen avisando de que hay una pregunta (si no, «puedo entrenar en ayunas» sin signos caería al registrador).
const SENAL_DE_PREGUNTA = /^(puedo|puede|debo|debe|deberia|se puede|esta bien si|es malo|es mala|conviene)\b|\b(es mejor|que es mejor|cual es mejor|o es mejor|versus|vs|diferencia entre|que diferencia)\b/
const EMPIEZA_INTERROGANDO = /^(que|cual|cuales|quien|donde|dime|explica|explicame|cuentame)\b/

/** El tipo de la voz si la frase ya normalizada parece pregunta; `undefined` si no (p. ej. «hice mi rutina»). */
export function tipoSiPregunta(frase: string, normalizada: string, conSigno = false): TipoPregunta | undefined {
  const tipo = tipoDeLaVoz(frase)
  if (tipo !== 'mi_caso' || conSigno || EMPIEZA_INTERROGANDO.test(normalizada) || SENAL_DE_PREGUNTA.test(normalizada)) return tipo
  return undefined
}

const ORDENES_DE_NAVEGAR = new Set(['zona', 'ejercicio', 'movimiento', 'cuerpo', 'vuelta', 'cara', 'siguiente', 'anterior', 'hoy', 'indice', 'cerrar'])

function destinoDeOrden(o: OrdenLocal): Destino {
  if (o.tipo === 'zona') return { clase: 'zona', id: o.id ?? '' }
  if (o.tipo === 'ejercicio') return { clase: 'ejercicio', id: o.nombre ?? '' }
  if (o.tipo === 'movimiento') return { clase: 'movimiento', id: 'movimiento' }
  return { clase: 'salon', id: o.tipo === 'cara' ? `cara_${o.cara ?? ''}` : o.tipo }
}

export function enrutarPraxis(e: EntradaPraxis): DecisionPraxis {
  const personaId = e.personaId?.trim() ? e.personaId : undefined
  const sinPersona = { origen: 'reglas' as const, escribe: false as const, requiereConfirmacion: false }
  const base = { ...sinPersona, ...(personaId ? { personaId } : {}) }

  // Paso 1. Riesgo antes que todo, incluso antes que la puerta: una frase de riesgo no se pierde en silencio.
  const marca = filtroDeRiesgo(e.frase)
  if (marca) return { ...base, ruta: 'seguridad', paso: 1, subnivel: marca.tipo === 'salud' ? 'salud' : 'riesgo' }

  // Paso 2. La puerta: la misma de la app y de la función (`puedeVerPraxis`).
  if (!personaId || !puedeVerPraxis(e.rol, e.abiertaAAsesorados ?? PRAXIS_ABIERTA_A_ASESORADOS, e.ocupaElPuesto ?? false)) {
    return { ...sinPersona, ruta: 'bloqueada', paso: 2 }
  }

  const n = normalizar(e.frase)
  const tipo = tipoSiPregunta(e.frase, n, /[?¿]/.test(e.frase))

  // Paso 3. Estado pendiente: la respuesta a lo que Praxis acaba de preguntar no se reclasifica.
  if (e.aclaracionSalud) return { ...base, ruta: 'seguridad', paso: 3, subnivel: 'salud' }
  if (e.pendiente) return { ...base, ruta: 'registrar', paso: 3, requiereConfirmacion: true }

  const porOrden = e.orden ? decidirPorOrden(e.orden, tipo, base) : null
  if (porOrden) return porOrden

  // Paso 5. Camino rápido de registro: propone una tarjeta, no guarda.
  if (e.registroRapido) return { ...base, ruta: 'registrar', paso: 5, requiereConfirmacion: true }

  // Paso 6. Tipo de pregunta. Las reglas no eligen la ficha: eso es del portero (paso 7).
  if (tipo !== undefined) return { ...base, ruta: null, paso: 6, pasaA: 'portero', tipo }
  return { ...base, ruta: null, paso: 6, pasaA: 'registrador' }
}

type Base = Pick<DecisionPraxis, 'origen' | 'escribe' | 'requiereConfirmacion' | 'personaId'>

/** Paso 4. Órdenes del salón (lista cerrada, sin modelo). `duda` y `no_entendi` no son órdenes: devuelve null. */
function decidirPorOrden(o: OrdenLocal, tipo: TipoPregunta | undefined, base: Base): DecisionPraxis | null {
  if (o.tipo === 'salud') return { ...base, ruta: 'seguridad', paso: 4, subnivel: 'salud' }
  if (o.tipo === 'cual') return { ...base, ruta: 'aclarar', paso: 4, opciones: [...(o.opciones ?? [])] }
  if (!ORDENES_DE_NAVEGAR.has(o.tipo)) return null
  return { ...base, ruta: 'navegar', paso: 4, destino: destinoDeOrden(o), ...(tipo === 'como' ? { tipo, hueco: 'metodo' as const } : {}) }
}

/** Lo que entra en `meta.decision` y en el registro: sin la frase, sin la persona y sin nombres de ejercicio. */
export function decisionParaMeta(d: DecisionPraxis): Pick<DecisionPraxis, 'ruta' | 'paso' | 'origen' | 'subnivel' | 'tipo' | 'pasaA' | 'hueco'> {
  return {
    ruta: d.ruta,
    paso: d.paso,
    origen: d.origen,
    ...(d.subnivel ? { subnivel: d.subnivel } : {}),
    ...(d.tipo ? { tipo: d.tipo } : {}),
    ...(d.pasaA ? { pasaA: d.pasaA } : {}),
    ...(d.hueco ? { hueco: d.hueco } : {}),
  }
}
