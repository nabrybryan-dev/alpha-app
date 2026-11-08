import { candidatosParaDeshacer, diaLocal, minutosLocales, vigentesEnVentana } from './candidatos.ts'
import type { PedidoDeshacer } from './pedido.ts'
import { MAX_CANDIDATOS, VIGENCIA_CONFIRMACION_MIN, type RegistroLibro, type TipoRegistroLibro } from './tipos.ts'

/** Tarjeta de confirmación: la orden NUNCA ejecuta, solo la propone (diseño §4). */
export interface TarjetaConfirmarDeshacer {
  campo: 'deshacer'
  registroId: string
  usuarioId: string
  tipo: TipoRegistroLibro
  descripcion: string
  /** Instante (ISO) en que caduca; nunca se confirma por tiempo. */
  venceEn: string
}

export type PropuestaDeshacer =
  | { accion: 'confirmar_deshacer'; texto: string; tarjeta: TarjetaConfirmarDeshacer; botones: string[] }
  | { accion: 'preguntar'; texto: string; opciones: Array<{ registroId: string; etiqueta: string }>; botones: string[] }
  | { accion: 'nada_que_deshacer'; motivo: 'vacio' | 'fuera_de_ventana'; texto: string }

export const BOTON_SI = 'Sí, quitar'
export const BOTON_NO = 'No, dejarlo'
export const BOTON_NINGUNO = 'Ninguno'

export const TEXTO_NADA = 'No hay nada que deshacer. No toqué nada.'
export const TEXTO_FUERA_DE_VENTANA = 'Es de ayer; para eso dime el valor correcto y lo corrijo con tu confirmación. No toqué nada.'

const NOMBRE: Record<TipoRegistroLibro, string> = {
  hidratacion: 'Agua',
  comida: 'Comida',
  series: 'Series',
  testPost: 'Esfuerzo y duración',
  adherencia: 'Adherencia',
  checkin: 'Check-in',
}

const OBJETO: Record<TipoRegistroLibro, string> = {
  hidratacion: 'el agua',
  comida: 'la comida',
  series: 'las series',
  testPost: 'el esfuerzo y la duración',
  adherencia: 'la adherencia',
  checkin: 'el check-in',
}

/** «8:15», «12:40»: hora local sin cero a la izquierda. */
export function horaCorta(instante: string, zonaHoraria: string): string {
  const min = minutosLocales(instante, zonaHoraria)
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
}

export function etiquetaCandidato(r: RegistroLibro, zonaHoraria: string): string {
  return `${NOMBRE[r.tipo]}: ${r.descripcion}, ${horaCorta(r.creadoEn, zonaHoraria)}`
}

export function textoConfirmacion(r: RegistroLibro, zonaHoraria: string): string {
  return `Voy a quitar ${OBJETO[r.tipo]} que anotaste a las ${horaCorta(r.creadoEn, zonaHoraria)}: ${r.descripcion}. ¿Lo quito?`
}

export function tarjetaDe(r: RegistroLibro, ahora: Date): TarjetaConfirmarDeshacer {
  return {
    campo: 'deshacer',
    registroId: r.id,
    usuarioId: r.usuarioId,
    tipo: r.tipo,
    descripcion: r.descripcion,
    venceEn: new Date(ahora.getTime() + VIGENCIA_CONFIRMACION_MIN * 60_000).toISOString(),
  }
}

/**
 * Qué le propone Praxis a la persona ante «deshaz …». No escribe: devuelve una propuesta que
 * exige confirmar. Regla madre: nunca más de un registro por orden. Solo lo de `usuarioId`.
 */
export function proponerDeshacer(
  libro: readonly RegistroLibro[],
  pedido: PedidoDeshacer,
  ahora: Date,
  zonaHoraria: string,
  usuarioId: string,
): PropuestaDeshacer {
  const propios = libro.filter((r) => r.usuarioId === usuarioId)
  const filtro = { tipo: pedido.tipo, minutoDicho: pedido.minutoDicho }
  const candidatos = candidatosParaDeshacer(propios, ahora, zonaHoraria, filtro)

  if (candidatos.length === 0) {
    const hayViejo = propios.some(
      (r) =>
        r.deshechoEn === null &&
        (filtro.tipo === undefined || r.tipo === filtro.tipo) &&
        diaLocal(r.creadoEn, zonaHoraria) < diaLocal(ahora, zonaHoraria),
    )
    return hayViejo
      ? { accion: 'nada_que_deshacer', motivo: 'fuera_de_ventana', texto: TEXTO_FUERA_DE_VENTANA }
      : { accion: 'nada_que_deshacer', motivo: 'vacio', texto: TEXTO_NADA }
  }

  // «los tres últimos» o «todo»: de a uno, y se dice. Con un orden de «el último», no hay duda.
  const deAUno = pedido.pideVarios ? 'Te los quito de a uno. ' : ''
  // «lo último» o «lo del agua» (sin hora): el más reciente es UNO solo (diseño §3).
  // «eso» o una hora dicha con varios candidatos: no se adivina, se pregunta.
  const unico = candidatos.length === 1 || pedido.referencia === 'ultimo'
  if (unico) {
    const r = candidatos[0]
    return {
      accion: 'confirmar_deshacer',
      texto: deAUno + textoConfirmacion(r, zonaHoraria),
      tarjeta: tarjetaDe(r, ahora),
      botones: [BOTON_SI, BOTON_NO],
    }
  }
  const totales = vigentesEnVentana(propios, ahora, zonaHoraria, filtro).length
  const masQue = totales > MAX_CANDIDATOS ? ` Te muestro los ${MAX_CANDIDATOS} más recientes.` : ''
  return {
    accion: 'preguntar',
    texto: `${deAUno}¿Cuál quito?${masQue}`,
    opciones: candidatos.map((r) => ({ registroId: r.id, etiqueta: etiquetaCandidato(r, zonaHoraria) })),
    botones: [...candidatos.map((r) => etiquetaCandidato(r, zonaHoraria)), BOTON_NINGUNO],
  }
}
