/**
 * El guion de la llamada de venta que arma el agente de la landing (tabla `guiones_llamada`, 0151),
 * leído de forma TOLERANTE.
 *
 * El guion lo escribe otro repo y otro agente, y va a cambiar antes que esta pantalla: un campo
 * nuevo no debe romper la tarjeta y uno que falte tampoco. Por eso aquí:
 *   · las claves desconocidas se ignoran;
 *   · un campo con forma equivocada cuenta como ausente (no tumba al resto);
 *   · los textos se recortan y los vacíos desaparecen;
 *   · solo un `guion` que ni siquiera es un objeto devuelve `null`.
 *
 * Módulo puro: sin red, sin React. La forma la valida de verdad la Edge Function `guion-llamada`
 * al recibirlo; esto es la segunda línea, para filas viejas o escritas a mano.
 */

export interface ObjecionProbable {
  objecion: string
  respuesta: string
}

export interface PersonaDelGuion {
  nombre: string | null
  edadTramo: string | null
  objetivo: string | null
}

export interface PreferenciaEnElGuion {
  /** YYYY-MM-DD, hora de Colombia. */
  dia: string | null
  franja: string | null
  /** HH:MM si la persona dijo una hora. */
  hora: string | null
  /** Cómo se le confirmó a la persona («el jueves 5 de noviembre en la tarde»). */
  enClaro: string | null
}

export interface GuionDeVenta {
  version: number | null
  persona: PersonaDelGuion
  /** El texto a destacar, o `null` si no hay alerta. */
  alertaSalud: string | null
  apertura: string | null
  dolores: string[]
  queMostrar: string[]
  objeciones: ObjecionProbable[]
  cierre: string | null
  avisos: string[]
  preferencia: PreferenciaEnElGuion
}

/** Lo que se dice cuando la alerta llega como un simple «sí», sin motivo. */
export const ALERTA_SIN_MOTIVO = 'Declaró una condición de salud: pide el aval médico antes del plan.'

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function texto(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const limpio = v.trim()
  return limpio === '' ? null : limpio
}

function textos(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(texto).filter((t): t is string => t !== null)
}

function objeciones(v: unknown): ObjecionProbable[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((o) => {
    if (!esObjeto(o)) return []
    const objecion = texto(o.objecion)
    if (!objecion) return []
    // Una objeción sin respuesta se enseña igual: saber que vendrá ya sirve.
    return [{ objecion, respuesta: texto(o.respuesta) ?? '' }]
  })
}

/** Texto, «sí», o un objeto con su motivo: los tres se entienden. `false` o vacío es «no hay». */
function alerta(v: unknown): string | null {
  if (v === true) return ALERTA_SIN_MOTIVO
  if (typeof v === 'string') return texto(v)
  if (esObjeto(v)) {
    if (v.activa === false || v.hay === false) return null
    return texto(v.motivo) ?? texto(v.detalle) ?? texto(v.texto) ?? ALERTA_SIN_MOTIVO
  }
  return null
}

function persona(v: unknown): PersonaDelGuion {
  const p = esObjeto(v) ? v : {}
  return { nombre: texto(p.nombre), edadTramo: texto(p.edad_tramo), objetivo: texto(p.objetivo) }
}

function preferencia(v: unknown): PreferenciaEnElGuion {
  const p = esObjeto(v) ? v : {}
  return {
    dia: texto(p.dia) ?? texto(p.fecha),
    franja: texto(p.franja),
    hora: texto(p.hora),
    enClaro: texto(p.en_claro),
  }
}

export function leerGuion(crudo: unknown): GuionDeVenta | null {
  if (!esObjeto(crudo)) return null
  const version = typeof crudo.version === 'number' && Number.isInteger(crudo.version) ? crudo.version : null
  return {
    version,
    persona: persona(crudo.persona),
    alertaSalud: alerta(crudo.alerta_salud),
    apertura: texto(crudo.apertura),
    dolores: textos(crudo.dolores),
    queMostrar: textos(crudo.que_mostrar),
    objeciones: objeciones(crudo.objeciones_probables),
    cierre: texto(crudo.cierre),
    avisos: textos(crudo.avisos),
    preferencia: preferencia(crudo.preferencia ?? crudo.reserva),
  }
}

/** ¿Hay algo que enseñar en la tarjeta? Un guion sin ninguna sección no se pinta. */
export function guionTieneContenido(g: GuionDeVenta): boolean {
  return Boolean(
    g.alertaSalud ||
      g.apertura ||
      g.cierre ||
      g.dolores.length ||
      g.queMostrar.length ||
      g.objeciones.length ||
      g.avisos.length,
  )
}

const FRANJA_EN_CLARO: Record<string, string> = {
  manana: 'en la mañana',
  mañana: 'en la mañana',
  tarde: 'en la tarde',
  noche: 'en la noche',
}

/** `tarde` → `en la tarde`. Una franja que no se reconoce se enseña tal cual. */
export function franjaEnClaro(franja: string | null): string | null {
  if (!franja) return null
  return FRANJA_EN_CLARO[franja.toLowerCase()] ?? franja
}
