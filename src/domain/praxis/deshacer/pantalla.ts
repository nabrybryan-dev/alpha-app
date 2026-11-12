import { BOTON_NINGUNO, BOTON_NO, BOTON_SI } from './proponer'

/**
 * Lo que la PANTALLA sabe de «deshacer» (diseño 4-nov, §4). La orden nunca ejecuta: el servidor propone y la persona toca.
 *
 * Esto solo LEE lo que contesta la Edge Function (`praxis-registro/deshacer.ts`) y dice cada resultado en una frase corta, sin
 * tecnicismos. La tarjeta firmada viaja tal cual: el cliente no la toca ni la fabrica, así que no puede deshacer lo que el servidor no ofreció.
 */

/** La tarjeta que firmó el servidor. Se devuelve igual en `{tarjeta, confirmado:true}`. */
export interface TarjetaFirmada {
  campo: 'deshacer'
  registro_id: string
  tipo: string
  descripcion: string
  vence_en: string
  token: string
}

export type PropuestaDeshacerPantalla =
  | { accion: 'confirmar_deshacer'; texto: string; tarjeta: TarjetaFirmada; botonSi: string; botonNo: string }
  | { accion: 'preguntar'; texto: string; opciones: Array<{ registroId: string; etiqueta: string }>; botonNinguno: string }
  | { accion: 'nada_que_deshacer'; texto: string }

export type ResultadoDeshacer = 'deshecho' | 'ya_deshecho' | 'cambio_despues' | 'vencida' | 'otro_dia' | 'no_se_pudo'

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const cadena = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0

function leerTarjeta(x: unknown): TarjetaFirmada | null {
  if (!esObjeto(x) || x.campo !== 'deshacer') return null
  if (!cadena(x.registro_id) || !cadena(x.tipo) || !cadena(x.vence_en) || !cadena(x.token) || typeof x.descripcion !== 'string') return null
  return { campo: 'deshacer', registro_id: x.registro_id, tipo: x.tipo, descripcion: x.descripcion, vence_en: x.vence_en, token: x.token }
}

/** La propuesta del servidor (`{tipo:'deshacer', propuesta}`). `null` = no tiene la forma esperada: no se pinta nada que no se pueda sostener. */
export function leerPropuestaDeshacer(propuesta: unknown): PropuestaDeshacerPantalla | null {
  if (!esObjeto(propuesta) || !cadena(propuesta.texto)) return null
  const texto = propuesta.texto.trim()
  if (propuesta.accion === 'nada_que_deshacer') return { accion: 'nada_que_deshacer', texto }
  if (propuesta.accion === 'confirmar_deshacer') {
    const tarjeta = leerTarjeta(propuesta.tarjeta)
    return tarjeta ? { accion: 'confirmar_deshacer', texto, tarjeta, botonSi: BOTON_SI, botonNo: BOTON_NO } : null
  }
  if (propuesta.accion === 'preguntar') {
    if (!Array.isArray(propuesta.opciones)) return null
    const opciones = propuesta.opciones.flatMap((o): Array<{ registroId: string; etiqueta: string }> =>
      esObjeto(o) && cadena(o.registro_id) && cadena(o.etiqueta) ? [{ registroId: o.registro_id, etiqueta: o.etiqueta.trim() }] : [])
    return opciones.length > 0 ? { accion: 'preguntar', texto, opciones, botonNinguno: BOTON_NINGUNO } : null
  }
  return null
}

/** Qué pasó al tocar «Sí, quitar», según `{resultado}` del servidor y el estado HTTP. Todo lo raro cae en `no_se_pudo` (no se tocó nada). */
export function leerResultadoDeshacer(status: number, cuerpo: unknown): ResultadoDeshacer {
  if (!esObjeto(cuerpo) || cuerpo.tipo !== 'deshacer') return 'no_se_pudo'
  const bien = status >= 200 && status < 300
  switch (cuerpo.resultado) {
    case 'deshecho': return bien ? 'deshecho' : 'no_se_pudo'
    case 'ya_deshecho': return bien ? 'ya_deshecho' : 'no_se_pudo'
    case 'cambio_despues': return bien ? 'cambio_despues' : 'no_se_pudo'
    case 'vencida': return 'vencida'
    case 'otro_dia': return 'otro_dia'
    default: return 'no_se_pudo'
  }
}

const FRASES: Record<ResultadoDeshacer, [string, string]> = {
  deshecho: ['Listo, lo quité.', 'Listo, lo quité.'],
  ya_deshecho: ['Eso ya estaba quitado.', 'Eso ya estaba quitado.'],
  cambio_despues: ['Eso cambió después, así que no lo toqué.', 'Eso cambió después, así que no lo toqué.'],
  vencida: ['La tarjeta venció y no quité nada. Pídemelo otra vez.', 'La tarjeta venció y no quité nada. Pídamelo otra vez.'],
  otro_dia: ['Eso es de otro día. Dime el valor bueno y lo corrijo.', 'Eso es de otro día. Dígame el valor bueno y lo corrijo.'],
  no_se_pudo: ['No pude quitarlo ahora y no toqué nada.', 'No pude quitarlo ahora y no toqué nada.'],
}

export function fraseDeResultado(r: ResultadoDeshacer, trato: 'tu' | 'usted'): string {
  return FRASES[r][trato === 'usted' ? 1 : 0]
}

export const FRASE_NO_QUITE = 'Listo, no quité nada.'
