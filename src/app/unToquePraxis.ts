import { DE_SALUD } from '../domain/praxis/ordenes/ordenesDeVoz'
import { leerPedidoDeOrganizacion, limpiarFrase, type VerboDeOrganizacion } from '../domain/praxis/organizacion/pedido'
import { derivarPorRiesgo, filtroDeRiesgo } from '../domain/praxis/riesgo'
import { TEXTOS_APROBADOS as A, TEXTOS_PENDIENTES as P } from '../features/praxis/unToque/textos'
import type { PerfilAcceso } from './rutas'
import { tituloDeRuta } from './rutas'
import { piezasPara, type PiezaDeLaApp } from './catalogoDePiezas'
import {
  decidirOrganizacion,
  decidirParaPieza,
  type AccionDeOrganizacion,
  type DecisionDeOrganizacion,
  type MotivoDeRechazo,
} from './organizacionPraxis'
import { comoEstadoDeOrganizacion, ordenVisible, ultimoCambio, type EstadoLocal } from './organizacionLocal'

/**
 * EL TURNO DE «PRAXIS A UN TOQUE»: de una frase a lo que la capa tiene que mostrar. Función pura, sin React, sin
 * red y sin modelo: arma una descripción (pasos del esquema, plano de la pantalla, mensaje, tarjeta) y la capa la
 * pinta. El orden de decisión es el del diseño (§6): 1) salud y riesgo, en el teléfono, ANTES de cualquier otra
 * cosa; 2) deshacer; 3) organizar; 4) pregunta de conocimiento; 5) si nada encaja, se pregunta.
 *
 * Los candados del dueño NO se reescriben aquí: salen de `decidirOrganizacion` y `decidirParaPieza`
 * (`organizacionPraxis.ts`). Este módulo solo los traduce a lo que se ve.
 */

export interface PasoDelEsquema {
  titulo: string
  detalle: string
  /** En rojo: una regla que frena la orden, o la salud. */
  alerta?: boolean
  /** De dónde salió la lectura. */
  origen?: string
}

export type ModoDelPlano = 'trae' | 'oculta' | 'sube' | 'baja' | 'no' | 'vuelve' | 'fija'

export interface PlanoDelEsquema {
  pantalla: string
  titulo: string
  filas: readonly { id: string; nombre: string; nivel: PiezaDeLaApp['nivel'] }[]
  foco?: string
  modo: ModoDelPlano
  ocultas: number
}

export type AccionDeTarjeta =
  | { t: 'aplicar'; accion: AccionDeOrganizacion; piezaId: string }
  | { t: 'deshacer' }
  | { t: 'elegir'; verbo: VerboDeOrganizacion; piezaId: string }
  | { t: 'dejar'; mensaje: string }
  | { t: 'avisar_coach_pieza'; piezaId: string }
  | { t: 'avisar_coach_salud' }
  | { t: 'abrir_checkin' }
  | { t: 'quitar_ultimo' }

export interface TarjetaDelTurno {
  /** `confirmar`: cambia lo guardado, botón principal rojo. `neutra`: pregunta. */
  estilo: 'confirmar' | 'neutra'
  etiqueta: string
  texto: string
  sub?: string
  antesDespues?: { antes: string; despues: string }
  botones: readonly { etiqueta: string; accion: AccionDeTarjeta }[]
}

export interface TurnoDePraxis {
  pasos: readonly PasoDelEsquema[]
  plano?: PlanoDelEsquema
  /** Lo que Praxis dice después del esquema. */
  mensaje?: string
  tarjeta?: TarjetaDelTurno
  /** Traer: la capa navega a esa pantalla y se encoge a píldora. Solo viaja en `traer`; nunca cambia nada guardado. */
  traer?: PiezaDeLaApp
  /** Esta frase habla de salud: no llega a ningún otro camino (ni modelo ni enganche). */
  salud?: boolean
  /** Es una pregunta de conocimiento: la capa la entrega al enganche de la charla (solo con la bandera). */
  pregunta?: boolean
}

export interface ContextoDelTurno {
  perfil: PerfilAcceso
  estado: EstadoLocal
  /** Patrón de la pantalla donde está la persona (`/`, `/nutricion`…). */
  pantallaActual: string
  /** `PRAXIS_UN_TOQUE_CHARLA`: si es true, una pregunta de conocimiento va al enganche. */
  charlaActiva: boolean
  /** Hay un camino para dejarle un aviso al coach sobre una pieza. Si no, no se pregunta lo que no se puede hacer. */
  puedeAvisarAlCoach: boolean
}

/** Salud y riesgo, en el teléfono, con el filtro que la app ya usa (`filtroDeRiesgo`, sin tocarlo) y el de dolor de las órdenes. */
export function esFraseDeSalud(frase: string): boolean {
  return filtroDeRiesgo(frase) !== null || DE_SALUD.test(limpiarFrase(frase))
}

const PREGUNTA = /^(que|como|cuanto|cuantas|cuantos|cual|cuales|por que|para que|cuando|donde|es mejor|es bueno|conviene|debo|deberia|puedo)\b/

/** ¿Suena a pregunta de conocimiento? Solo se mira DESPUÉS de que organización dijo «no es mía». */
export function esPreguntaDeConocimiento(frase: string): boolean {
  return /[¿?]/.test(frase) || PREGUNTA.test(limpiarFrase(frase))
}

function nombreDe(p: PiezaDeLaApp): string {
  return p.nombreHablado
}

function tituloDePantalla(patron: string): string {
  return tituloDeRuta(patron) ?? patron
}

function planoDe(pieza: PiezaDeLaApp, ctx: ContextoDelTurno, modo: ModoDelPlano, incluirOculta = false): PlanoDelEsquema | undefined {
  if (pieza.tipo === 'pantalla') return undefined
  const ids = ordenVisible(ctx.estado, pieza.pantalla)
  const todas = piezasPara(ctx.perfil)
  const lista = incluirOculta && !ids.includes(pieza.id) ? [...ids, pieza.id] : ids
  const filas = lista.flatMap((id) => {
    const p = todas.find((x) => x.id === id)
    return p ? [{ id: p.id, nombre: nombreDe(p), nivel: p.nivel }] : []
  })
  return { pantalla: pieza.pantalla, titulo: tituloDePantalla(pieza.pantalla), filas, foco: pieza.id, modo, ocultas: ctx.estado.ocultas.length }
}

const entendi = (verbo: VerboDeOrganizacion, pieza?: PiezaDeLaApp): PasoDelEsquema => ({
  titulo: P.pasoEntendi,
  detalle: pieza ? `${P.verbo[verbo]} ${nombreDe(pieza)}` : P.verbo[verbo],
  origen: P.leidoEnElTelefono,
})

function pasosDeRechazo(verbo: VerboDeOrganizacion, pieza: PiezaDeLaApp | undefined, regla: string): PasoDelEsquema[] {
  return [entendi(verbo, pieza), { titulo: P.pasoReglas, detalle: regla, alerta: true }, { titulo: P.pasoNoLoHago, detalle: P.noCambioNada }]
}

const REGLA_DE_RECHAZO: Record<MotivoDeRechazo, string> = {
  fija: P.reglaFija,
  asignada: P.reglaAsignada,
  nucleo_de_la_barra: P.reglaNucleo,
  tope_de_ocultas: P.reglaTope,
  ya_oculta: P.reglaYaOculta,
  equipo_sin_organizacion: P.reglaEquipo,
  contiene_piezas_protegidas: P.reglaProtegida,
  sin_acceso: P.reglaSinAcceso,
  no_existe: P.reglaNoExiste,
}

function turnoDeRechazo(motivo: MotivoDeRechazo, pieza: PiezaDeLaApp | undefined, verbo: VerboDeOrganizacion, ctx: ContextoDelTurno): TurnoDePraxis {
  const pasos = pasosDeRechazo(verbo, pieza, REGLA_DE_RECHAZO[motivo])
  const plano = pieza ? planoDe(pieza, ctx, 'no') : undefined
  const nombre = pieza ? nombreDe(pieza) : ''
  switch (motivo) {
    case 'fija':
      return { pasos, plano, mensaje: A.ocultarFija }
    case 'asignada':
      if (!pieza) return { pasos, plano, mensaje: A.ocultarDelCoachSinAviso(nombre) }
      return ctx.puedeAvisarAlCoach
        ? {
            pasos,
            plano,
            tarjeta: {
              estilo: 'neutra',
              etiqueta: P.pasoPregunto,
              texto: A.ocultarDelCoach(nombre),
              sub: A.ocultarDelCoachSub,
              botones: [
                { etiqueta: P.avisoCoachSi, accion: { t: 'avisar_coach_pieza', piezaId: pieza.id } },
                { etiqueta: P.avisoCoachNo, accion: { t: 'dejar', mensaje: P.avisoCoachNoHice } },
              ],
            },
          }
        : { pasos, plano, mensaje: A.ocultarDelCoachSinAviso(nombre) }
    case 'nucleo_de_la_barra':
      return { pasos, plano, mensaje: A.barra }
    case 'tope_de_ocultas':
      return { pasos, plano, mensaje: A.tope }
    case 'ya_oculta':
      return { pasos, plano, mensaje: P.yaOculta(nombre) }
    case 'equipo_sin_organizacion':
      return { pasos, plano, mensaje: P.equipoSinOrganizacion(nombre) }
    case 'contiene_piezas_protegidas':
      return { pasos, plano, mensaje: P.protegida(nombre) }
    case 'sin_acceso':
      return { pasos, mensaje: P.sinAcceso }
    case 'no_existe':
      return { pasos, mensaje: P.noExiste }
  }
}

function turnoDeSalud(frase: string): TurnoDePraxis {
  const marca = filtroDeRiesgo(frase)
  // Con marca de riesgo se muestra primero la línea que el camino de seguridad ya firmado da para ese caso.
  const firmada = marca ? derivarPorRiesgo(marca).respuesta : undefined
  return {
    salud: true,
    pasos: [
      { titulo: P.pasoPrimeroTuSalud, detalle: P.saludCuerpo, alerta: true, origen: P.leidoEnElTelefono },
      { titulo: P.pasoNoPasaAlModelo, detalle: P.saludNoModelo },
      { titulo: P.pasoVaATuCoach, detalle: P.saludNoValora },
    ],
    mensaje: firmada,
    tarjeta: {
      estilo: 'confirmar',
      etiqueta: P.saludEtiqueta,
      texto: A.saludTitulo,
      sub: A.saludSub,
      botones: [
        { etiqueta: A.saludAvisar, accion: { t: 'avisar_coach_salud' } },
        { etiqueta: A.saludCheckin, accion: { t: 'abrir_checkin' } },
      ],
    },
  }
}

const DESCRIPCION: Record<AccionDeOrganizacion, (pieza: string) => string> = {
  ocultar: P.cambioOcultar,
  mover_arriba: P.cambioMoverArriba,
  mover_abajo: P.cambioMoverAbajo,
  fijar: P.cambioFijar,
}

/** La descripción de un cambio, para el historial y para «¿lo deshago?». */
export function descripcionDelCambio(accion: AccionDeOrganizacion, pieza: PiezaDeLaApp): string {
  return DESCRIPCION[accion](nombreDe(pieza))
}

function turnoDePropone(accion: AccionDeOrganizacion, pieza: PiezaDeLaApp, quisoBorrar: boolean | undefined, ctx: ContextoDelTurno): TurnoDePraxis {
  const nombre = nombreDe(pieza)
  const pantalla = tituloDePantalla(pieza.pantalla)
  const rechazar = { t: 'dejar', mensaje: accion === 'ocultar' ? P.loDejeComoEsta : P.noMovi } as const
  const aplicar = { t: 'aplicar', accion, piezaId: pieza.id } as const
  const verbo: VerboDeOrganizacion = accion
  const pasos: PasoDelEsquema[] = [
    entendi(verbo, pieza),
    {
      titulo: P.pasoReglas,
      detalle: accion === 'ocultar' ? P.reglaLibre(ctx.estado.ocultas.length + 1) : P.reglaMover,
    },
    { titulo: P.pasoTePropongo, detalle: P.reglaGuardado },
  ]
  if (accion === 'ocultar') {
    return {
      pasos,
      plano: planoDe(pieza, ctx, 'oculta'),
      tarjeta: {
        estilo: 'confirmar',
        etiqueta: P.tarjetaOcultarTitulo,
        texto: A.confirmaOcultar(nombre, pantalla),
        sub: quisoBorrar ? `${P.noBorroTusDatos} ${A.confirmaOcultarSub(nombre)}` : A.confirmaOcultarSub(nombre),
        botones: [
          { etiqueta: A.confirmaOcultarSi, accion: aplicar },
          { etiqueta: A.confirmaOcultarNo, accion: rechazar },
        ],
      },
    }
  }
  if (accion === 'fijar') {
    return {
      pasos,
      tarjeta: {
        estilo: 'confirmar',
        etiqueta: P.tarjetaMoverTitulo,
        texto: P.confirmaFijar(nombre),
        botones: [
          { etiqueta: P.confirmaFijarSi, accion: aplicar },
          { etiqueta: A.confirmaOcultarNo, accion: { t: 'dejar', mensaje: P.loDejeComoEsta } },
        ],
      },
    }
  }
  const lista = pieza.tipo === 'pantalla' ? [] : ordenVisible(ctx.estado, pieza.pantalla)
  const todas = piezasPara(ctx.perfil)
  const nombreDeId = (id: string | undefined) => (id ? todas.find((p) => p.id === id)?.nombreHablado ?? '' : '')
  const arriba = accion === 'mover_arriba'
  const hoy = arriba ? lista[0] : lista[lista.length - 1]
  return {
    pasos,
    plano: planoDe(pieza, ctx, arriba ? 'sube' : 'baja'),
    tarjeta: {
      estilo: 'confirmar',
      etiqueta: P.tarjetaMoverTitulo,
      texto: arriba ? P.confirmaMoverArriba(nombre, pantalla) : P.confirmaMoverAbajo(nombre, pantalla),
      antesDespues: lista.length
        ? {
            antes: arriba ? P.primeroDe(nombreDeId(hoy)) : P.ultimoDe(nombreDeId(hoy)),
            despues: arriba ? P.primeroDe(nombre) : P.ultimoDe(nombre),
          }
        : undefined,
      botones: [
        { etiqueta: P.confirmaMoverSi, accion: aplicar },
        { etiqueta: A.confirmaOcultarNo, accion: rechazar },
      ],
    },
  }
}

/** La decisión sobre una pieza ya elegida (la que se escogió en una tarjeta de «¿cuál?»). */
export function turnoDeEleccion(verbo: VerboDeOrganizacion, pieza: PiezaDeLaApp, ctx: ContextoDelTurno): TurnoDePraxis {
  return turnoDeDecision(decidirParaPieza(verbo, pieza, comoEstadoDeOrganizacion(ctx.estado)), verbo, ctx)
}

export function turnoDeDecision(d: DecisionDeOrganizacion, verboDicho: VerboDeOrganizacion, ctx: ContextoDelTurno): TurnoDePraxis {
  const todas = piezasPara(ctx.perfil)
  switch (d.tipo) {
    case 'seguridad':
      // Una orden de organizar que habla de salud: gana seguridad. (`resolverTurno` ya la corta antes; esto cubre la ruta directa.)
      return turnoDeSalud('')
    case 'traer': {
      const oculta = ctx.estado.ocultas.includes(d.pieza.id)
      return {
        pasos: [
          entendi('traer', d.pieza),
          { titulo: P.pasoReglas, detalle: oculta ? `${P.reglaTraer} ${P.reglaTraerOculta}` : P.reglaTraer },
          { titulo: P.pasoVoy, detalle: `${tituloDePantalla(d.pieza.pantalla)} › ${nombreDe(d.pieza)}` },
        ],
        plano: planoDe(d.pieza, ctx, 'trae', oculta),
        mensaje: A.traje(nombreDe(d.pieza)),
        traer: d.pieza,
      }
    }
    case 'propone':
      return turnoDePropone(d.accion, d.pieza, d.quisoBorrar, ctx)
    case 'propone_deshacer': {
      const ultimo = ultimoCambio(ctx.estado)
      return {
        pasos: [entendi('deshacer'), { titulo: P.pasoTePropongo, detalle: P.reglaGuardado }],
        tarjeta: {
          estilo: 'confirmar',
          etiqueta: P.tarjetaDeshacerTitulo,
          texto: P.confirmaDeshacer(ultimo?.descripcion ?? ''),
          botones: [
            { etiqueta: P.deshacerSi, accion: { t: 'deshacer' } },
            { etiqueta: P.deshacerNo, accion: { t: 'dejar', mensaje: P.noDeshice } },
          ],
        },
      }
    }
    case 'nada_que_deshacer':
      return { pasos: [entendi('deshacer')], mensaje: P.nadaQueDeshacer }
    case 'pregunta_cual':
      return {
        pasos: [entendi(d.verbo), { titulo: P.pasoPregunto, detalle: P.cualCuerpo(P.verbo[d.verbo]) }],
        tarjeta: {
          estilo: 'neutra',
          etiqueta: P.cualTitulo,
          texto: P.cualCuerpo(P.verbo[d.verbo]),
          sub: d.hayMas ? P.cualHayMas : undefined,
          botones: d.opciones.map((o) => ({ etiqueta: nombreDe(o), accion: { t: 'elegir', verbo: d.verbo, piezaId: o.id } })),
        },
      }
    case 'pregunta_que_quitar': {
      const libres = ordenVisible(ctx.estado, ctx.pantallaActual)
        .flatMap((id) => todas.filter((p) => p.id === id))
        .filter((p) => p.nivel === 'libre')
        .slice(0, 2)
      return {
        pasos: [entendi('quitar_ambiguo'), { titulo: P.pasoPregunto, detalle: P.queQuitoCuerpo }],
        tarjeta: {
          estilo: 'neutra',
          etiqueta: P.queQuitoTitulo,
          texto: P.queQuitoCuerpo,
          botones: [
            { etiqueta: P.queQuitoUltimo, accion: { t: 'quitar_ultimo' } },
            ...libres.map((p) => ({ etiqueta: nombreDe(p), accion: { t: 'elegir', verbo: 'ocultar', piezaId: p.id } as AccionDeTarjeta })),
          ],
        },
      }
    }
    case 'lista_ocultas':
      return {
        pasos: [entendi('listar_ocultas'), { titulo: P.pasoReglas, detalle: P.ocultasCuenta(d.piezas.length) }],
        mensaje: d.piezas.length ? P.ocultasConLista(d.piezas.map((p) => `${nombreDe(p)} (${tituloDePantalla(p.pantalla)})`).join(', ')) : P.ocultasVacia,
      }
    case 'lista':
      return {
        pasos: [entendi('listar')],
        mensaje: P.ocultablesConLista(d.libres.slice(0, 6).map(nombreDe).join(', ')),
      }
    case 'rechaza':
      return turnoDeRechazo(d.motivo, d.pieza, verboDicho, ctx)
    case 'no_es_organizacion':
      return { pasos: [], mensaje: A.noEntendi }
    // Sin dibujar en esta versión (ver la descripción del PR): se dice, no se hace.
    case 'propone_restablecer':
    case 'sugiere_ocultar':
    case 'propone_solo_lo_importante':
      return { pasos: [entendi(verboDicho)], mensaje: P.sinSoporte }
  }
}

/** Una decisión de organización trae su verbo dicho implícito en el tipo; para el rótulo del paso basta una aproximación. */
function verboDe(d: DecisionDeOrganizacion): VerboDeOrganizacion {
  switch (d.tipo) {
    case 'traer':
      return 'traer'
    case 'propone':
      return d.accion
    case 'pregunta_cual':
      return d.verbo
    case 'propone_deshacer':
    case 'nada_que_deshacer':
      return 'deshacer'
    case 'lista':
      return 'listar'
    case 'lista_ocultas':
      return 'listar_ocultas'
    case 'pregunta_que_quitar':
      return 'quitar_ambiguo'
    case 'propone_restablecer':
      return 'restablecer'
    case 'propone_solo_lo_importante':
      return 'solo_lo_importante'
    case 'sugiere_ocultar':
      return 'sugerir_ocultar'
    case 'rechaza':
      return 'ocultar'
    default:
      return 'traer'
  }
}

/**
 * De la frase al turno. La salud va PRIMERO y corta todo: ni la gramática de organización, ni el enganche de la
 * charla, ni ningún modelo ven una frase que el filtro local marca.
 */
export function resolverTurno(frase: string, ctx: ContextoDelTurno): TurnoDePraxis {
  if (esFraseDeSalud(frase)) return turnoDeSalud(frase)
  const decision = decidirOrganizacion(frase, ctx.perfil, comoEstadoDeOrganizacion(ctx.estado))
  if (decision.tipo === 'seguridad') return turnoDeSalud(frase)
  if (decision.tipo === 'no_es_organizacion') {
    if (ctx.charlaActiva && esPreguntaDeConocimiento(frase)) return { pasos: [], pregunta: true }
    return { pasos: [], mensaje: A.noEntendi }
  }
  const pedido = leerPedidoDeOrganizacion(frase)
  const dicho = pedido.tipo === 'pedido' && pedido.verbo !== 'quitar_ambiguo' ? pedido.verbo : verboDe(decision)
  return turnoDeDecision(decision, dicho, ctx)
}
