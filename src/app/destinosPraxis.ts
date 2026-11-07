import { RUTAS, buscarRuta, resolverAcceso, tituloDeRuta, type PerfilAcceso, type RutaApp } from './rutas'

/**
 * LOS DESTINOS DE PRAXIS: a qué pantallas puede llevar Praxis a una persona (paso 1, «N1», del plano de
 * conexiones de la Praxis única, 4-nov-2026).
 *
 * Hoy hay tres listas de lugares que pueden contradecirse: la barra, `RUTAS` y las órdenes de voz del salón.
 * Praxis no añade una cuarta: sus destinos SALEN de `RUTAS`, y quién entra a cada uno lo decide
 * `resolverAcceso`, el mismo oráculo que `rutas.acceso.test.tsx` contrasta con el router real. Así,
 * si alguien cambia una puerta, Praxis la respeta sin tocar este archivo.
 *
 * Qué NO es destino (y por qué):
 *   · rutas con parámetros (`/equipo/:usuarioId`): llevar a una ficha concreta exige saber de quién;
 *     eso no lo decide una frase sin contexto.
 *   · rutas que redirigen (`/coach`, `/coach/asesorados`): Praxis lleva a la dirección final, no a la vieja.
 *   · el comodín y la ruta pública: no son pantallas a las que se va.
 *   · las pantallas de la propia Praxis (`/praxis...`): Praxis no se lleva a sí misma.
 *
 * Este módulo NO navega: solo dice a dónde se puede ir. Navegar es el paso 3 («F3»), con esta guarda.
 */

export interface DestinoPraxis {
  /** El patrón de `RUTAS`: es la clave del destino. No hay otra lista de nombres. */
  patron: string
  /** El título que ve esa persona (el del equipo si cambia, como «Mi día»). */
  titulo: string
}

export type Decision =
  | { tipo: 'puede_ir'; destino: DestinoPraxis }
  /** El destino existe pero esta persona no entra: Praxis lo dice, no la manda a otra parte en silencio. */
  | { tipo: 'sin_acceso'; patron: string }
  /** No es un destino de Praxis (no está en `RUTAS`, lleva parámetros, redirige, o es de Praxis). */
  | { tipo: 'no_es_destino'; patron: string }

function esCandidato(r: RutaApp): boolean {
  const g = r.guarda
  if (g.marco === 'comodin' || g.marco === 'publica' || g.marco === 'praxis') return false
  if (g.redirigeA) return false
  return !r.patron.includes(':')
}

/** Todos los destinos posibles, sin mirar quién pregunta. Derivado de `RUTAS`, en su orden. */
export const PATRONES_DESTINO: readonly string[] = RUTAS.filter(esCandidato).map((r) => r.patron)

function esEquipo(p: PerfilAcceso): boolean {
  return p.rol !== 'asesorado' || p.capacidades.has('puesto_de_coach')
}

/** Los destinos a los que ESTA persona puede ir: solo los que `resolverAcceso` deja entrar. */
export function destinosPara(p: PerfilAcceso): DestinoPraxis[] {
  return RUTAS.filter((r) => esCandidato(r) && resolverAcceso(r, p).tipo === 'entra').map((r) => ({
    patron: r.patron,
    titulo: tituloDeRuta(r.patron, esEquipo(p)) ?? r.titulo,
  }))
}

/** ¿Puede Praxis llevar a esta persona a este patrón? La guarda de rol es la de la app, no una propia. */
export function decidirDestino(patron: string, p: PerfilAcceso): Decision {
  const fila = buscarRuta(patron)
  if (!fila || fila.patron !== patron || !esCandidato(fila)) return { tipo: 'no_es_destino', patron }
  if (resolverAcceso(fila, p).tipo !== 'entra') return { tipo: 'sin_acceso', patron }
  return { tipo: 'puede_ir', destino: { patron, titulo: tituloDeRuta(patron, esEquipo(p)) ?? fila.titulo } }
}
