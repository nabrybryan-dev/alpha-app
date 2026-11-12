import type { Capacidad } from '../data/consola/capacidadesStaff'
import { DE_SALUD } from '../domain/praxis/ordenes/ordenesDeVoz'
import type { LecturaDelModelo } from '../domain/praxis/organizacion/lectorModelo'
import { limpiarFrase, leerPedidoDeOrganizacion, type VerboDeOrganizacion } from '../domain/praxis/organizacion/pedido'
import { filtroDeRiesgo } from '../domain/praxis/riesgo'
import { PIEZAS_DE_HOY, PIEZAS_DE_OTRAS_PANTALLAS, buscarPiezas, piezasPara, type PiezaDeLaApp } from './catalogoDePiezas'
import type { PerfilAcceso } from './rutas'

/**
 * LA DECISIÓN DE ORGANIZACIÓN (fase O2 del diseño `docs/specs/2026-11-09-praxis-interactiva-organiza-la-app-diseno.md`):
 * dada una frase, el catálogo y el estado de la persona, qué haría Praxis. NO ejecuta nada, NO guarda ninguna
 * organización y NO escribe el texto que se le dice a la persona (los textos los aprueba Bryan aparte): devuelve
 * una decisión estructurada. Nada la llama todavía; la organización guardada es la fase O4.
 *
 * Reglas (las del diseño, §3 y §5):
 *   · traer no cambia nada guardado: se puede hacer sin confirmar. Fijar, ocultar, mover, deshacer y restablecer
 *     solo se PROPONEN: la persona confirma con un botón, en otra capa.
 *   · riesgo primero; luego el acceso («esa pantalla no está disponible para tu cuenta», nunca se desvía en silencio);
 *   · lo `fija` no se oculta pero se mueve, y sus notificaciones siguen; lo `asignada` por el coach no se oculta;
 *   · el núcleo de la barra (Hoy y Praxis) no se mueve;
 *   · un nombre que cae en dos piezas se pregunta (hasta 3), no se elige;
 *   · hay un tope de piezas ocultas a la vez (6, fijado por Bryan el 9-nov).
 *
 * El llamador es quien comprueba que Praxis esté abierta a esa persona (`PRAXIS_ABIERTA_A_ASESORADOS`).
 */

/** Cuántas piezas se pueden tener ocultas a la vez. Lo fijó Bryan en 6 el 9-nov (había propuesto 6 y lo aceptó entre 3, 6 y 10). */
export const TOPE_DE_OCULTAS = 6
/** Pantallas que son el núcleo de la barra: se quedan en su puesto (Bryan, 4-nov y 9-nov). */
export const NUCLEO_DE_LA_BARRA: ReadonlySet<string> = new Set(['pantalla:/'])
const MAXIMO_DE_OPCIONES = 3

export interface EstadoDeOrganizacion {
  /** Ids de las piezas que la persona tiene ocultas hoy. */
  ocultas: ReadonlySet<string>
  /** Hay al menos un cambio de organización que se pueda deshacer. */
  hayCambiosParaDeshacer: boolean
}

export type AccionDeOrganizacion = 'ocultar' | 'fijar' | 'mover_arriba' | 'mover_abajo'

export type MotivoDeRechazo =
  | 'fija'
  | 'asignada'
  | 'nucleo_de_la_barra'
  | 'tope_de_ocultas'
  | 'ya_oculta'
  | 'equipo_sin_organizacion'
  /** Una pantalla libre que lleva dentro piezas fijas o asignadas: ocultarla las escondería (hallazgo de la revisión, 10-nov). */
  | 'contiene_piezas_protegidas'
  | 'sin_acceso'
  | 'no_existe'

export type DecisionDeOrganizacion =
  | { tipo: 'no_es_organizacion' }
  /** Era una orden de organizar que habla de salud: gana seguridad y no se organiza nada. */
  | { tipo: 'seguridad' }
  /** `confirmar`: la leyó el modelo, no la gramática; se enseña con un botón «¿te llevo ahí?» antes de abrir (nunca abre solo). */
  | { tipo: 'traer'; pieza: PiezaDeLaApp; confirmar?: boolean }
  /** Se propone con tarjeta y dos botones; todavía no pasó nada. */
  | { tipo: 'propone'; accion: AccionDeOrganizacion; pieza: PiezaDeLaApp; quisoBorrar?: boolean }
  | { tipo: 'propone_deshacer' }
  | { tipo: 'nada_que_deshacer' }
  | { tipo: 'propone_restablecer' }
  | { tipo: 'lista'; libres: PiezaDeLaApp[] }
  /** «qué tengo escondido»: las piezas que la persona ya ocultó (puede ser ninguna). */
  | { tipo: 'lista_ocultas'; piezas: PiezaDeLaApp[] }
  /** Una queja sobre una pieza libre: Praxis OFRECE esconderla. Si la persona dice que sí, se sigue como `propone` ocultar. */
  | { tipo: 'sugiere_ocultar'; pieza: PiezaDeLaApp }
  /** «quita eso»: no se sabe si es un registro o una parte de la pantalla; se le pregunta cuál. */
  | { tipo: 'pregunta_que_quitar' }
  /**
   * «Solo lo importante»: esconder de una vez todo lo libre que sigue a la vista. Va con tarjeta que dice cuántas cosas
   * (Bryan, 9-nov) y salta el tope de piezas ocultas A PROPÓSITO, solo en este modo; lo fijo y lo asignado se quedan.
   * Se deshace con «déjalo como estaba» (es UN solo cambio).
   */
  | { tipo: 'propone_solo_lo_importante'; esconderia: PiezaDeLaApp[] }
  /** El nombre cae en varias piezas: se pregunta cuál (máximo 3). Al elegir, `decidirParaPieza`. */
  | { tipo: 'pregunta_cual'; verbo: VerboDeOrganizacion; opciones: PiezaDeLaApp[]; hayMas: boolean }
  | { tipo: 'rechaza'; motivo: MotivoDeRechazo; pieza?: PiezaDeLaApp }

const ASESORADO_DE_REFERENCIA: PerfilAcceso = { rol: 'asesorado', capacidades: new Set() }
const CAPACIDADES_DEL_EQUIPO: Capacidad[] = ['leer_entrenamiento', 'ver_administracion', 'revisar_creadores', 'responder_mercadeo', 'organizar_plan', 'decisiones_compartidas']
const EQUIPO_DE_REFERENCIA: PerfilAcceso = { rol: 'coach', capacidades: new Set(CAPACIDADES_DEL_EQUIPO) }

/**
 * ¿Esta pantalla lleva dentro alguna pieza fija o asignada? Si sí, la pantalla no se oculta aunque ella sea libre: el
 * nivel de un contenedor es el más estricto de lo que contiene. («oculta mi semana» no puede esconder el chat con el
 * coach ni lo que el equipo le pide responder.)
 */
function contienePiezasProtegidas(pantalla: string): boolean {
  return [...PIEZAS_DE_HOY, ...PIEZAS_DE_OTRAS_PANTALLAS].some((p) => p.pantalla === pantalla && (p.nivel === 'fija' || p.nivel === 'asignada'))
}

/** La decisión sobre UNA pieza ya elegida (la que nombró la frase o la que la persona escogió entre varias). */
export function decidirParaPieza(verbo: VerboDeOrganizacion, pieza: PiezaDeLaApp, estado: EstadoDeOrganizacion): DecisionDeOrganizacion {
  if (verbo === 'traer') return { tipo: 'traer', pieza }
  if (pieza.nivel === 'equipo') return { tipo: 'rechaza', motivo: 'equipo_sin_organizacion', pieza }
  if (verbo === 'ocultar') {
    if (pieza.nivel === 'fija') return { tipo: 'rechaza', motivo: 'fija', pieza }
    if (pieza.nivel === 'asignada') return { tipo: 'rechaza', motivo: 'asignada', pieza }
    if (pieza.tipo === 'pantalla' && contienePiezasProtegidas(pieza.pantalla)) return { tipo: 'rechaza', motivo: 'contiene_piezas_protegidas', pieza }
    if (estado.ocultas.has(pieza.id)) return { tipo: 'rechaza', motivo: 'ya_oculta', pieza }
    if (estado.ocultas.size >= TOPE_DE_OCULTAS) return { tipo: 'rechaza', motivo: 'tope_de_ocultas', pieza }
    return { tipo: 'propone', accion: 'ocultar', pieza }
  }
  if (verbo === 'fijar' || verbo === 'mover_arriba' || verbo === 'mover_abajo') {
    if (NUCLEO_DE_LA_BARRA.has(pieza.id)) return { tipo: 'rechaza', motivo: 'nucleo_de_la_barra', pieza }
    return { tipo: 'propone', accion: verbo, pieza }
  }
  return { tipo: 'no_es_organizacion' }
}

function decidirSoloLoImportante(perfil: PerfilAcceso, estado: EstadoDeOrganizacion): DecisionDeOrganizacion {
  return { tipo: 'propone_solo_lo_importante', esconderia: piezasPara(perfil).filter((p) => p.nivel === 'libre' && !estado.ocultas.has(p.id) && !(p.tipo === 'pantalla' && contienePiezasProtegidas(p.pantalla))) }
}

export function decidirListarOcultas(perfil: PerfilAcceso, estado: EstadoDeOrganizacion): DecisionDeOrganizacion {
  return { tipo: 'lista_ocultas', piezas: piezasPara(perfil).filter((p) => estado.ocultas.has(p.id)) }
}

/**
 * La decisión cuando quien leyó la frase fue el MODELO con menú cerrado (`domain/praxis/organizacion/lectorModelo.ts`),
 * no la gramática. Los candados son los mismos que con la gramática: el modelo solo elige, nunca ejecuta ni salta un
 * nivel. Una pieza que no existe para esta persona no organiza nada.
 */
export function decidirConLectura(lectura: LecturaDelModelo, perfil: PerfilAcceso, estado: EstadoDeOrganizacion): DecisionDeOrganizacion {
  const { verbo, pieza } = lectura
  if (verbo === 'restablecer') return { tipo: 'propone_restablecer' }
  if (verbo === 'solo_lo_importante') return decidirSoloLoImportante(perfil, estado)
  if (verbo === 'listar_ocultas') return decidirListarOcultas(perfil, estado)
  if (verbo === 'ninguno') return { tipo: 'no_es_organizacion' }
  const elegida = piezasPara(perfil).find((p) => p.id === pieza)
  if (!elegida) return { tipo: 'no_es_organizacion' }
  const decision = decidirParaPieza(verbo, elegida, estado)
  // Lo que lee el modelo nunca se ejecuta solo: ni siquiera «traer», que no cambia nada guardado, abre sin preguntar.
  return decision.tipo === 'traer' ? { ...decision, confirmar: true } : decision
}

/** ¿Se puede consultar al modelo con esta frase? No si habla de salud o de riesgo: eso lo atiende el camino de seguridad. */
export function sePuedeConsultarAlModelo(frase: string): boolean {
  return !filtroDeRiesgo(frase) && !DE_SALUD.test(limpiarFrase(frase))
}

export function decidirOrganizacion(frase: string, perfil: PerfilAcceso, estado: EstadoDeOrganizacion): DecisionDeOrganizacion {
  const pedido = leerPedidoDeOrganizacion(frase)
  if (pedido.tipo === 'ninguno') return { tipo: 'no_es_organizacion' }
  if (pedido.tipo === 'riesgo') return { tipo: 'seguridad' }

  const { verbo } = pedido
  if (verbo === 'deshacer') return { tipo: estado.hayCambiosParaDeshacer ? 'propone_deshacer' : 'nada_que_deshacer' }
  if (verbo === 'restablecer') return { tipo: 'propone_restablecer' }
  if (verbo === 'listar') return { tipo: 'lista', libres: piezasPara(perfil).filter((p) => p.nivel === 'libre') }

  if (verbo === 'solo_lo_importante') return decidirSoloLoImportante(perfil, estado)
  if (verbo === 'listar_ocultas') return decidirListarOcultas(perfil, estado)

  const candidatas = buscarPiezas(pedido.frase, perfil)
  if (verbo === 'sugerir_ocultar') return decidirQueja(candidatas, estado)
  // «quita eso»: si la frase SÍ nombra una pieza del catálogo se trata como esconderla; si no, se pregunta qué quiere quitar.
  if (verbo === 'quitar_ambiguo' && candidatas.length === 0) return { tipo: 'pregunta_que_quitar' }
  const verboFinal = verbo === 'quitar_ambiguo' ? 'ocultar' : verbo
  if (candidatas.length === 0) {
    if (pedido.suave) return { tipo: 'no_es_organizacion' }
    const existeParaOtro = [ASESORADO_DE_REFERENCIA, EQUIPO_DE_REFERENCIA].some((ref) => buscarPiezas(pedido.frase, ref).length > 0)
    return { tipo: 'rechaza', motivo: existeParaOtro ? 'sin_acceso' : 'no_existe' }
  }
  if (candidatas.length > 1) {
    return { tipo: 'pregunta_cual', verbo: verboFinal, opciones: candidatas.slice(0, MAXIMO_DE_OPCIONES), hayMas: candidatas.length > MAXIMO_DE_OPCIONES }
  }
  const decision = decidirParaPieza(verboFinal, candidatas[0]!, estado)
  // «borra» o «elimina» solo esconden la tarjeta: quien muestra la tarjeta debe decir que los datos NO se borran.
  return decision.tipo === 'propone' && pedido.borrar ? { ...decision, quisoBorrar: true } : decision
}

/**
 * Una queja no es una orden: solo se ofrece esconder si la pieza es libre y se puede ocultar. Si no, no se hace
 * nada (la queja la atiende la conversación, no la organización). Con varias piezas posibles, se pregunta cuál.
 */
function decidirQueja(candidatas: PiezaDeLaApp[], estado: EstadoDeOrganizacion): DecisionDeOrganizacion {
  if (candidatas.length > 1) {
    return { tipo: 'pregunta_cual', verbo: 'ocultar', opciones: candidatas.slice(0, MAXIMO_DE_OPCIONES), hayMas: candidatas.length > MAXIMO_DE_OPCIONES }
  }
  const pieza = candidatas[0]
  if (!pieza) return { tipo: 'no_es_organizacion' }
  const puede = decidirParaPieza('ocultar', pieza, estado)
  return puede.tipo === 'propone' ? { tipo: 'sugiere_ocultar', pieza } : { tipo: 'no_es_organizacion' }
}
