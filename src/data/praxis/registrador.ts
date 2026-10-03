import type { FalloDelRegistrador, RespuestaDeGuardar, RespuestaDelRegistrador, ResultadoDeRegistro } from '../../domain/praxis/conversacion'
import type { ContextoCharla } from '../../domain/praxis/charla/modelo'
import { limpiarTurnos } from '../../domain/praxis/charla/modelo'
import type { Propuesta, RegistroPropuesto } from '../../domain/praxis/registro/tipos'
import type { Tarjeta } from '../../domain/praxis/registro/tarjeta'
import type { TurnoId } from '../../domain/praxis/ingreso/guion'
import type { RespuestaIngreso } from '../../domain/praxis/ingreso/prueba'

/**
 * El cliente de la Edge Function `praxis-registro` (sin desplegar todavía: la publica Bryan).
 *
 *   proponerRegistro → POST /praxis-registro           NO guarda: devuelve propuesta + tarjeta.
 *   guardarRegistro  → POST /praxis-registro/guardar   Escribe SOLO lo que la persona confirmó.
 *   extraerIngreso   → POST /praxis-registro {accion:'ingreso'}   Etiqueta UN turno hablado del cuestionario
 *                      de ingreso (prueba interna). NO guarda nada.
 *
 * Tres reglas:
 *  - El usuario NO viaja en el cuerpo: el servidor lo saca del token. Mandarlo dejaría
 *    pasar el de otra persona.
 *  - Nunca lanza. Si algo falla devuelve el motivo, y la pantalla lo dice.
 *  - Un 200 sin la forma esperada NO cuenta como éxito: «guardado» solo es lo que el
 *    servidor confirmó registro por registro.
 */
export interface SesionDeFunciones { access_token: string; url: string }

export interface PeticionProponer {
  frase: string
  mensajeId: string
  /** Hora local del teléfono, ISO con zona. */
  horaLocal: string
  hidratacionHoyMl?: number
  verComposicion?: boolean
  checkinHoy?: Record<string, unknown>
  /** El ejercicio que la persona eligió con un toque tras «¿cuál fue?». */
  pantallaEjercicioId?: string
  /**
   * La charla (3-oct): el trato, el nombre de pila, hasta 6 turnos de ESTA sesión y el saludo que Praxis ya dijo.
   * Viaja solo en esta petición: ni el cliente ni el servidor lo guardan en ningún sitio.
   */
  charla?: ContextoCharla
}

export interface PeticionGuardar {
  mensajeId: string
  registros: RegistroPropuesto[]
  confirmaSesion: boolean
  horaLocal: string
}

const RUTA = '/functions/v1/praxis-registro'

function motivoDe(status: number): FalloDelRegistrador {
  if (status === 404) return 'no_desplegada'
  if (status === 401 || status === 403) return 'sin_sesion'
  if (status === 429) return 'limite'
  if (status === 502) return 'no_entendi'
  if (status === 400) return 'frase'
  return 'red'
}

async function llamar(sesion: SesionDeFunciones, ruta: string, cuerpo: unknown): Promise<{ ok: true; datos: unknown } | { ok: false; motivo: FalloDelRegistrador }> {
  try {
    const r = await fetch(`${sesion.url}${ruta}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${sesion.access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
    if (!r.ok) return { ok: false, motivo: motivoDe(r.status) }
    return { ok: true, datos: await r.json() }
  } catch {
    return { ok: false, motivo: 'red' }
  }
}

/** Quita las claves sin valor para no mandar `undefined` ni datos que la app no tiene. */
function sinVacios(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null))
}

export async function proponerRegistro(sesion: SesionDeFunciones | null, p: PeticionProponer): Promise<RespuestaDelRegistrador> {
  if (!sesion?.access_token || !sesion.url) return { ok: false, motivo: 'sin_sesion' }
  const r = await llamar(sesion, RUTA, sinVacios({
    frase: p.frase,
    mensaje_id: p.mensajeId,
    hora_local: p.horaLocal,
    hidratacion_hoy_ml: p.hidratacionHoyMl,
    ver_composicion: p.verComposicion,
    checkin_hoy: p.checkinHoy,
    pantalla_ejercicio_id: p.pantallaEjercicioId,
    charla: p.charla ? { trato: p.charla.trato, nombre: p.charla.nombre ?? undefined, turnos: limpiarTurnos(p.charla.turnos), apertura: p.charla.apertura ?? undefined } : undefined,
  }))
  if (!r.ok) return r
  const datos = r.datos as { propuesta?: Propuesta; tarjeta?: Tarjeta; charla?: { texto?: unknown } } | null
  if (!datos?.propuesta || !datos.tarjeta || !Array.isArray(datos.propuesta.registros) || !Array.isArray(datos.tarjeta.lineas)) {
    return { ok: false, motivo: 'no_entendi' }
  }
  const charla = typeof datos.charla?.texto === 'string' && datos.charla.texto.trim() ? datos.charla.texto.trim() : undefined
  return { ok: true, propuesta: datos.propuesta, tarjeta: datos.tarjeta, mensajeId: p.mensajeId, ...(charla ? { charla } : {}) }
}

const ESTADOS: ResultadoDeRegistro['estado'][] = ['guardado', 'rechazado', 'pendiente_prerrequisito']

export async function guardarRegistro(sesion: SesionDeFunciones | null, p: PeticionGuardar): Promise<RespuestaDeGuardar> {
  if (!sesion?.access_token || !sesion.url) return { ok: false, motivo: 'sin_sesion' }
  if (p.registros.length === 0) return { ok: false, motivo: 'frase' }
  const r = await llamar(sesion, `${RUTA}/guardar`, {
    mensaje_id: p.mensajeId,
    registros: p.registros,
    confirma_sesion: p.confirmaSesion,
    // Una serie de más (fuera de la pauta) no se acepta con el mismo toque: pide el suyo.
    confirma_extra: false,
    hora_local: p.horaLocal,
  })
  if (!r.ok) return r
  const resultados = (r.datos as { resultados?: unknown } | null)?.resultados
  if (!Array.isArray(resultados) || !resultados.every((x) => x && typeof x === 'object' && ESTADOS.includes((x as ResultadoDeRegistro).estado))) {
    return { ok: false, motivo: 'red' }
  }
  return { ok: true, resultados: resultados as ResultadoDeRegistro[] }
}

/**
 * Un turno hablado del cuestionario de ingreso. Devuelve lo que el servidor pudo rastrear a una cita literal,
 * los toques de salud que lo dicho hace urgentes, o la derivación si Praxis detuvo el turno. Nunca lanza, y un 200
 * con otra forma no cuenta como éxito.
 */
export async function extraerIngreso(sesion: SesionDeFunciones | null, p: { turno: TurnoId; texto: string }): Promise<RespuestaIngreso> {
  if (!sesion?.access_token || !sesion.url) return { ok: false, motivo: 'sin_sesion' }
  const r = await llamar(sesion, RUTA, { accion: 'ingreso', turno: p.turno, texto: p.texto })
  if (!r.ok) return r
  const d = r.datos as {
    tipo?: unknown; derivada?: unknown; campos?: Record<string, string | number>; temas?: unknown; toques?: unknown; descartados?: unknown
    derivacion?: { filtro?: string | null; riesgo?: { tipo?: string; linea?: string } | null; urgencia?: string | null }
  } | null
  if (d?.tipo !== 'ingreso') return { ok: false, motivo: 'no_entendi' }
  if (d.derivada === true && d.derivacion) {
    const riesgo = d.derivacion.riesgo
    return {
      ok: true, derivada: true, turno: p.turno,
      derivacion: {
        filtro: d.derivacion.filtro ?? null,
        riesgo: riesgo?.tipo === 'quieta' && (riesgo.linea === 'vida' || riesgo.linea === 'pareja' || riesgo.linea === 'nino')
          ? { tipo: 'quieta', linea: riesgo.linea }
          : riesgo?.tipo === 'cuidado' ? { tipo: 'cuidado' } : null,
        urgencia: d.derivacion.urgencia === 'alta' ? 'alta' : null,
      },
    }
  }
  if (d.derivada !== false || !d.campos || typeof d.campos !== 'object' || !Array.isArray(d.toques) || !Array.isArray(d.temas)) return { ok: false, motivo: 'no_entendi' }
  const textos = (xs: unknown[]): string[] => xs.filter((x): x is string => typeof x === 'string')
  return {
    ok: true, derivada: false, turno: p.turno,
    campos: d.campos,
    temas: textos(d.temas),
    toques: textos(d.toques),
    descartados: Array.isArray(d.descartados) ? (d.descartados as { campo: string; motivo: string }[]) : [],
  }
}
