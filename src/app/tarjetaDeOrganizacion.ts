import {
  AVISO, BOTON, PREGUNTA, RECHAZO, RESULTADO, TEXTO, botonEsconderVarias,
  type TratoDeTarjeta,
} from '../domain/praxis/organizacion/textosTarjeta'
import { PIEZAS_DE_HOY, PIEZAS_DE_OTRAS_PANTALLAS, piezasPara, type PiezaDeLaApp } from './catalogoDePiezas'
import {
  TOPE_DE_OCULTAS, decidirListarOcultas, decidirParaPieza,
  type AccionDeOrganizacion, type DecisionDeOrganizacion, type EstadoDeOrganizacion,
} from './organizacionPraxis'
import type { PerfilAcceso } from './rutas'

/**
 * De la DECISIÓN de organizar (`organizacionPraxis.ts`) a la TARJETA que ve la persona (diseño
 * `biblioteca-praxis/DISENO-TARJETA-CONFIRMACION-ORGANIZAR-20261111.md`, 27 casos). Puro: no pinta, no guarda, no navega.
 *
 * La regla de la tarjeta: es el recibo antes de pagar. Nada que cambie lo guardado pasa sin el «Sí» de la persona; cada
 * botón dice QUÉ sigue (`Siguiente`) y quien pinta lo ejecuta. Los textos salen todos de `textosTarjeta.ts`.
 */

/** El cambio que se guardaría con el «Sí». Lo aplica el puerto `aplicar` de la conexión (hoy no existe: fase O4). */
export type CambioDeOrganizacion =
  | { tipo: 'pieza'; accion: AccionDeOrganizacion; pieza: PiezaDeLaApp; avisaAlCoach: boolean }
  | { tipo: 'deshacer' }
  | { tipo: 'restablecer' }
  | { tipo: 'solo_lo_importante'; piezas: PiezaDeLaApp[] }

export type ResultadoDeAplicar = 'aplicado' | 'choque' | 'no_se_pudo'

export type Siguiente =
  | { tipo: 'aplicar'; cambio: CambioDeOrganizacion }
  /** Abre la pantalla de la pieza: no guarda nada. */
  | { tipo: 'abrir'; pieza: PiezaDeLaApp }
  /** Otra tarjeta (elegir entre varias, «Muévelo», «Ver lo escondido»…). */
  | { tipo: 'decidir'; decision: DecisionDeOrganizacion }
  /** Se cierra la tarjeta y, si hay frase, se dice. */
  | { tipo: 'cerrar'; frase: string | null }
  /** La frase vuelve a la conversación como si la persona la hubiera dicho (pasa otra vez por el filtro de riesgo). */
  | { tipo: 'frase'; txt: string }
  | { tipo: 'avisar_coach'; pieza: PiezaDeLaApp | null }
  /** «Muévelo» (R1): pregunta hacia dónde (`preguntarSentido`). */
  | { tipo: 'sentido'; pieza: PiezaDeLaApp }

export interface BotonDeTarjeta {
  etiqueta: string
  /** El botón que confirma: va primero y lleva el estilo principal. */
  principal: boolean
  /** Clave estable para la pantalla (`data-k`). */
  clave: string
  siguiente: Siguiente
}

export interface TarjetaDeOrganizacion {
  /** Lo que Praxis dice (y se ve) al abrir la tarjeta. */
  texto: string
  /** Línea extra dentro de la tarjeta (p. ej. el aviso al coach de P1b). No se lee en voz alta. */
  nota: string | null
  botones: BotonDeTarjeta[]
  /** Lo que se dice si la persona cancela: para «No, dejarlo» y compañía. */
  alCancelar: string | null
}

export type PasoDeOrganizar =
  /** No hay tarjeta: la frase sigue su camino (N1) o va el de seguridad (S1). */
  | { tipo: 'nada' }
  /** «traer» que leyó la gramática (T1): se abre de una vez, sin tarjeta. */
  | { tipo: 'abrir'; pieza: PiezaDeLaApp }
  | { tipo: 'tarjeta'; tarjeta: TarjetaDeOrganizacion }

export interface ContextoDeTarjeta {
  trato: TratoDeTarjeta
  perfil: PerfilAcceso
  estado: EstadoDeOrganizacion
}

const TODAS = [...PIEZAS_DE_HOY, ...PIEZAS_DE_OTRAS_PANTALLAS]
const ES_PESO_O_MEDIDAS = /(^|\.)medidas$/

/** ¿Esconder esta pieza esconde el peso o las medidas? (decisión de Bryan, 10-nov: se avisa al coach sin la frase). */
export function escondePesoOMedidas(pieza: PiezaDeLaApp): boolean {
  if (ES_PESO_O_MEDIDAS.test(pieza.id)) return true
  return pieza.tipo === 'pantalla' && TODAS.some((p) => p.pantalla === pieza.pantalla && ES_PESO_O_MEDIDAS.test(p.id))
}

const nombre = (p: PiezaDeLaApp): string => p.nombreHablado

const boton = (etiqueta: string, clave: string, siguiente: Siguiente, principal = false): BotonDeTarjeta => ({ etiqueta, clave, siguiente, principal })
const cerrar = (frase: string | null = null): Siguiente => ({ tipo: 'cerrar', frase })
const aplicar = (cambio: CambioDeOrganizacion): Siguiente => ({ tipo: 'aplicar', cambio })
const tarjeta = (texto: string, botones: BotonDeTarjeta[], alCancelar: string | null = null, nota: string | null = null): PasoDeOrganizar =>
  ({ tipo: 'tarjeta', tarjeta: { texto, nota, botones, alCancelar } })
/** Un aviso con un solo botón que cierra. */
const aviso = (texto: string, etiqueta: string = BOTON.ok): PasoDeOrganizar => tarjeta(texto, [boton(etiqueta, 'org-ok', cerrar(), true)])
/** Sí / No, dejarlo: el molde de la confirmación (igual que el deshacer de registros). */
const siNo = (texto: string, si: string, siguiente: Siguiente, nota: string | null = null, alCancelar: string = RESULTADO.noCambio, no: string = BOTON.dejarlo): PasoDeOrganizar =>
  tarjeta(texto, [boton(si, 'org-si', siguiente, true), boton(no, 'org-no', cerrar(alCancelar))], alCancelar, nota)

const BOTON_SI_POR_ACCION: Record<AccionDeOrganizacion, string> = { ocultar: BOTON.esconder, fijar: BOTON.fijar, mover_arriba: BOTON.subir, mover_abajo: BOTON.bajar }

function proponer(d: Extract<DecisionDeOrganizacion, { tipo: 'propone' }>, t: TratoDeTarjeta): PasoDeOrganizar {
  const n = nombre(d.pieza)
  const avisa = d.accion === 'ocultar' && escondePesoOMedidas(d.pieza)
  const cambio = aplicar({ tipo: 'pieza', accion: d.accion, pieza: d.pieza, avisaAlCoach: avisa })
  const nota = avisa ? TEXTO.avisoCoachPesoOMedidas(t) : null
  const texto = d.accion === 'ocultar'
    ? (d.quisoBorrar ? TEXTO.ocultarEnVezDeBorrar(t, n) : TEXTO.ocultar(t, n))
    : d.accion === 'fijar' ? TEXTO.fijar(t, n) : d.accion === 'mover_arriba' ? TEXTO.subir(t, n) : TEXTO.bajar(t, n)
  return siNo(texto, BOTON_SI_POR_ACCION[d.accion], cambio, nota)
}

function rechazar(d: Extract<DecisionDeOrganizacion, { tipo: 'rechaza' }>, c: ContextoDeTarjeta): PasoDeOrganizar {
  const { trato: t } = c
  const p = d.pieza
  const n = p ? nombre(p) : ''
  switch (d.motivo) {
    case 'fija':
      return p
        ? tarjeta(RECHAZO.fija(t, n), [boton(BOTON.entendido, 'org-ok', cerrar(), true), boton(BOTON.muevelo, 'org-muevelo', { tipo: 'sentido', pieza: p })])
        : aviso(RESULTADO.sinOpciones, BOTON.entendido)
    case 'asignada':
      return tarjeta(RECHAZO.asignada(t), [boton(BOTON.avisale, 'org-avisale', { tipo: 'avisar_coach', pieza: p ?? null }, true), boton(BOTON.no, 'org-no', cerrar())])
    case 'nucleo_de_la_barra': return aviso(RECHAZO.nucleo, BOTON.entendido)
    case 'tope_de_ocultas':
      return tarjeta(RECHAZO.tope(t, TOPE_DE_OCULTAS), [boton(BOTON.verLoEscondido, 'org-ver-ocultas', { tipo: 'decidir', decision: decidirListarOcultas(c.perfil, c.estado) }, true), boton(BOTON.entendido, 'org-ok', cerrar())])
    case 'ya_oculta':
      return p ? siNo(RECHAZO.yaOculta, BOTON.traer, { tipo: 'abrir', pieza: p }, null, '', BOTON.no) : aviso(RECHAZO.yaOculta)
    case 'equipo_sin_organizacion': return aviso(RECHAZO.equipo, BOTON.entendido)
    case 'contiene_piezas_protegidas': {
      const libres = p ? piezasPara(c.perfil).filter((x) => x.pantalla === p.pantalla && x.id !== p.id && x.nivel === 'libre') : []
      return tarjeta(RECHAZO.contieneProtegidas(t), [boton(BOTON.entendido, 'org-ok', cerrar(), true), boton(BOTON.verQueTrae, 'org-ver', { tipo: 'decidir', decision: { tipo: 'lista', libres } })])
    }
    case 'sin_acceso': return aviso(RECHAZO.sinAcceso(t), BOTON.entendido)
    case 'no_existe': {
      const libres = piezasPara(c.perfil).filter((x) => x.nivel === 'libre')
      return tarjeta(RECHAZO.noExiste(t, []), [boton(BOTON.verOpciones, 'org-ver', { tipo: 'decidir', decision: { tipo: 'lista', libres } }, true), boton(BOTON.entendido, 'org-ok', cerrar())])
    }
  }
}

/** «Muévelo» tras un rechazo de pieza fija (R1): se pregunta el sentido. SIN APROBAR los botones «Más arriba»/«Más abajo». */
export function preguntarSentido(pieza: PiezaDeLaApp, estado: EstadoDeOrganizacion): PasoDeOrganizar {
  return tarjeta(PREGUNTA.haciaDonde(nombre(pieza)), [
    boton(BOTON.masArriba, 'org-arriba', { tipo: 'decidir', decision: decidirParaPieza('mover_arriba', pieza, estado) }, true),
    boton(BOTON.masAbajo, 'org-abajo', { tipo: 'decidir', decision: decidirParaPieza('mover_abajo', pieza, estado) }),
    boton(BOTON.ninguna, 'org-no', cerrar(RESULTADO.noCambio)),
  ], RESULTADO.noCambio)
}

function preguntarCual(d: Extract<DecisionDeOrganizacion, { tipo: 'pregunta_cual' }>, c: ContextoDeTarjeta): PasoDeOrganizar {
  const texto = d.hayMas ? PREGUNTA.cualHayMas(c.trato) : PREGUNTA.cual(d.opciones.map(nombre))
  return tarjeta(texto, [
    ...d.opciones.map((p, i) => boton(nombre(p), `org-opcion-${i}`, { tipo: 'decidir', decision: decidirParaPieza(d.verbo, p, c.estado) })),
    boton(BOTON.ninguna, 'org-ninguna', cerrar(RESULTADO.noCambio)),
  ], RESULTADO.noCambio)
}

function listaDeOcultas(piezas: PiezaDeLaApp[], t: TratoDeTarjeta): PasoDeOrganizar {
  if (piezas.length === 0) return aviso(AVISO.ocultasVacia)
  return tarjeta(AVISO.ocultas(t, piezas.map(nombre)), [
    ...piezas.slice(0, 3).map((p, i) => boton(nombre(p), `org-traer-${i}`, { tipo: 'abrir', pieza: p })),
    boton(BOTON.ninguno, 'org-ninguno', cerrar()),
  ])
}

/** La tarjeta (o el paso sin tarjeta) para cada decisión. */
export function tarjetaDeOrganizacion(d: DecisionDeOrganizacion, c: ContextoDeTarjeta): PasoDeOrganizar {
  const t = c.trato
  switch (d.tipo) {
    case 'no_es_organizacion':
    case 'seguridad':
      return { tipo: 'nada' }
    case 'traer':
      return d.confirmar ? siNo(TEXTO.traerConfirmar(t, nombre(d.pieza)), BOTON.llevame, { tipo: 'abrir', pieza: d.pieza }, null, '', BOTON.no) : { tipo: 'abrir', pieza: d.pieza }
    case 'propone': return proponer(d, t)
    case 'propone_deshacer': return siNo(TEXTO.deshacerUltimo(t), BOTON.devolver, aplicar({ tipo: 'deshacer' }))
    case 'nada_que_deshacer': return aviso(AVISO.nadaQueDeshacer)
    case 'propone_restablecer': return siNo(TEXTO.restablecer(t), BOTON.restablecer, aplicar({ tipo: 'restablecer' }))
    case 'propone_solo_lo_importante': {
      const n = d.esconderia.length
      if (n === 0) return aviso(TEXTO.soloLoImportanteVacio)
      return siNo(TEXTO.soloLoImportante(t, n), botonEsconderVarias(n), aplicar({ tipo: 'solo_lo_importante', piezas: d.esconderia }))
    }
    case 'sugiere_ocultar': {
      const avisa = escondePesoOMedidas(d.pieza)
      return siNo(TEXTO.queja(t, nombre(d.pieza)), BOTON.esconder, aplicar({ tipo: 'pieza', accion: 'ocultar', pieza: d.pieza, avisaAlCoach: avisa }), avisa ? TEXTO.avisoCoachPesoOMedidas(t) : null, RESULTADO.noCambioQueja)
    }
    case 'pregunta_que_quitar':
      return tarjeta(PREGUNTA.queQuitar, [
        boton(BOTON.unRegistro, 'org-registro', { tipo: 'frase', txt: FRASE_QUITAR_REGISTRO }, true),
        boton(BOTON.unaParte, 'org-parte', cerrar(PREGUNTA.dimeCual(t))),
        boton(BOTON.nada, 'org-nada', cerrar(RESULTADO.noCambio)),
      ], RESULTADO.noCambio)
    case 'pregunta_cual': return preguntarCual(d, c)
    case 'lista': return d.libres.length > 0 ? aviso(AVISO.lista(t, d.libres.map(nombre))) : aviso(RESULTADO.sinOpciones)
    case 'lista_ocultas': return listaDeOcultas(d.piezas, t)
    case 'rechaza': return rechazar(d, c)
  }
}

/**
 * Lo que vuelve a la conversación al tocar «Un registro» en «¿quitar qué?» (Q2): lleva al camino de deshacer registros,
 * que ya existe y propone con su propia tarjeta. Comprobado en la prueba: NO vuelve a caer en organizar (no hace bucle).
 */
export const FRASE_QUITAR_REGISTRO = 'deshaz lo último que anoté'
