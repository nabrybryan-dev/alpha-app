import { modoNube, supabase } from '../supabase'
import { fechaDeLlamada } from './notasLlamada'

/**
 * Las observaciones que un agente de IA deja sobre cada asesorado (migración 0115, SIN APLICAR al
 * escribir esto). Interno del equipo: el asesorado nunca las ve, y las lee quien entra a la consola
 * (`es_coach()` o la capacidad `leer_entrenamiento`, la misma puerta que las notas de llamada).
 *
 * LA REGLA DEL DUEÑO (Bryan, 9-oct-2026): «las bases de conocimiento tienen la última palabra;
 * solamente en el tema de seguridad y prescripciones Manuela y yo tenemos la última palabra». Dos
 * carriles: `anotada` (se apoya en la base de conocimiento y queda escrita) y `para_firma` (seguridad
 * y prescripciones: pendiente hasta que una persona del equipo la acepte o la descarte). Quién manda
 * cada tema a cada carril lo impone un CHECK de la base, no este archivo: aquí solo se lee y se firma.
 *
 * Este archivo NO escribe observaciones: las escribe el agente, fuera de la app, con la clave de
 * servicio. Lo único que se escribe desde aquí es la FIRMA, y solo por la función
 * `firmar_observacion_agente`: quién firma y cuándo los pone la base (`auth.uid()`, `now()`), nunca
 * este archivo, y la función es la única puerta (la tabla no admite `update` directo).
 */
export const TABLA_OBSERVACIONES_AGENTE = 'observaciones_agente'
export const RPC_FIRMAR_OBSERVACION = 'firmar_observacion_agente'

export const COLUMNAS_OBSERVACIONES_AGENTE = [
  'id',
  'usuario_id',
  'creado_en',
  'tema',
  'carril',
  'titulo',
  'texto',
  'fuentes',
  'agente',
  'corrida_id',
  'estado',
  'firmada_por',
  'firmada_en',
  'nota_de_firma',
] as const

const SELECCION_OBSERVACIONES_AGENTE = COLUMNAS_OBSERVACIONES_AGENTE.join(',')

export type TemaObservacion = 'nota_de_llamada' | 'prescripcion' | 'estilo_de_vida' | 'seguridad' | 'nutricion'
export type CarrilObservacion = 'anotada' | 'para_firma'
export type EstadoObservacion = 'pendiente' | 'aceptada' | 'descartada'
export type DecisionObservacion = 'aceptada' | 'descartada'

/**
 * Una fuente en que se apoya la observación. `base` es la base de conocimiento; `dato` es un dato del
 * propio asesorado. `sin_tipo` es lo que queda cuando el agente escribió algo que no es ninguna de las
 * dos: la base solo exige que `fuentes` sea un arreglo no vacío, no la forma de cada elemento, y la
 * pantalla no debe presentar como «de la base de conocimiento» una fuente que no dijo serlo.
 */
export interface FuenteObservacion {
  tipo: 'base' | 'dato' | 'sin_tipo'
  ref: string
  cita: string
}

/** La fila tal como baja de Supabase. */
interface FilaObservacionAgente {
  id: string
  usuario_id: string
  creado_en: string
  tema: TemaObservacion
  carril: CarrilObservacion
  titulo: string
  texto: string
  fuentes: unknown
  agente: string
  corrida_id: string | null
  estado: EstadoObservacion
  firmada_por: string | null
  firmada_en: string | null
  nota_de_firma: string | null
}

/** La misma fila, en el vocabulario del dominio. */
export interface ObservacionAgente {
  id: string
  usuarioId: string
  creadoEn: string
  tema: TemaObservacion
  carril: CarrilObservacion
  titulo: string
  texto: string
  fuentes: FuenteObservacion[]
  agente: string
  corridaId: string | null
  estado: EstadoObservacion
  firmadaPor: string | null
  firmadaEn: string | null
  notaDeFirma: string | null
}

/**
 * `fuentes` llega como JSON libre. Se lee elemento a elemento: lo que no sea un objeto se descarta, y un
 * texto que falta queda vacío en vez de tumbar la tarjeta entera por una fuente mal escrita.
 */
function aFuentes(crudo: unknown): FuenteObservacion[] {
  if (!Array.isArray(crudo)) return []
  const fuentes: FuenteObservacion[] = []
  for (const elemento of crudo as unknown[]) {
    if (typeof elemento !== 'object' || elemento === null) continue
    const e = elemento as Record<string, unknown>
    fuentes.push({
      tipo: e.tipo === 'base' || e.tipo === 'dato' ? e.tipo : 'sin_tipo',
      ref: typeof e.ref === 'string' ? e.ref : '',
      cita: typeof e.cita === 'string' ? e.cita : '',
    })
  }
  return fuentes
}

function aObservacion(fila: FilaObservacionAgente): ObservacionAgente {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    creadoEn: fila.creado_en,
    tema: fila.tema,
    carril: fila.carril,
    titulo: fila.titulo,
    texto: fila.texto,
    fuentes: aFuentes(fila.fuentes),
    agente: fila.agente,
    corridaId: fila.corrida_id,
    estado: fila.estado,
    firmadaPor: fila.firmada_por,
    firmadaEn: fila.firmada_en,
    notaDeFirma: fila.nota_de_firma,
  }
}

interface ErrorDeBase {
  code?: string
  message?: string
}

/** La tabla no existe (Postgres 42P01) o PostgREST no la conoce todavía (PGRST205): la 0115 no está aplicada. */
const tablaNoExiste = (codigo: string | undefined) => codigo === '42P01' || codigo === 'PGRST205'
/** La función no existe (PostgREST PGRST202, Postgres 42883): la 0115 no está aplicada. */
const funcionNoExiste = (codigo: string | undefined) => codigo === 'PGRST202' || codigo === '42883'

export type ResultadoObservaciones = { ok: true; observaciones: ObservacionAgente[] } | { ok: false; error: string }

const ERROR_CARGA = 'No se pudieron cargar las observaciones del agente.'
const ERROR_SIN_ACTIVAR = 'Las observaciones del agente todavía no están activadas en la base.'

/**
 * Las observaciones del agente sobre un asesorado, la más reciente primero. Nunca lanza, y tampoco se
 * traga el fallo: `ok: true` con lista vacía solo significa «no hay observaciones» (o «no hay base a la
 * que preguntar», en el demo); un fallo es `ok: false`, para que la pantalla no lo pinte como «todavía
 * no hay» y la persona crea que el agente no tiene nada que decir de una seguridad pendiente.
 */
export async function observacionesDe(usuarioId: string): Promise<ResultadoObservaciones> {
  if (!modoNube || !usuarioId) return { ok: true, observaciones: [] }
  try {
    const { data, error } = await supabase()
      .from(TABLA_OBSERVACIONES_AGENTE)
      .select(SELECCION_OBSERVACIONES_AGENTE)
      .eq('usuario_id', usuarioId)
      .order('creado_en', { ascending: false })
    if (error) return { ok: false, error: tablaNoExiste(error.code) ? ERROR_SIN_ACTIVAR : ERROR_CARGA }
    // Sin error pero sin datos tampoco es «lista vacía»: la base no contestó nada.
    if (!data) return { ok: false, error: ERROR_CARGA }
    return { ok: true, observaciones: (data as unknown as FilaObservacionAgente[]).map(aObservacion) }
  } catch {
    return { ok: false, error: ERROR_CARGA }
  }
}

export type ResultadoFirma =
  | { ok: true; observacion: ObservacionAgente }
  | {
      ok: false
      error: string
      /** Otra persona la firmó antes: lo que se ve en pantalla está viejo y conviene volver a cargar. */
      yaFirmada: boolean
    }

const CODIGO_SIN_PERMISO = '42501'
const CODIGO_DATO_INVALIDO = '22023'
const CODIGO_NO_EXISTE = 'P0002'

/**
 * El mensaje que ve quien firma. El texto crudo de PostgREST (inglés, con nombres de columna) no se
 * enseña nunca. El código `22023` lo usa la función tanto para «ya está firmada» como para una decisión
 * o una nota inválidas; solo el primer caso se puede dar desde la pantalla, y se distingue por el texto
 * de la base, que es de la propia función y no del usuario.
 */
function mensajeDeFirma(error: ErrorDeBase): { error: string; yaFirmada: boolean } {
  if (error.code === CODIGO_SIN_PERMISO) {
    return { error: 'No tienes permiso para firmar observaciones del agente.', yaFirmada: false }
  }
  if (error.code === CODIGO_NO_EXISTE) {
    return { error: 'Esa observación ya no existe. Vuelve a cargar la lista.', yaFirmada: false }
  }
  if (error.code === CODIGO_DATO_INVALIDO && /ya está firmada/i.test(error.message ?? '')) {
    return { error: 'Otra persona del equipo ya la firmó. Se vuelve a cargar la lista.', yaFirmada: true }
  }
  if (error.code === CODIGO_DATO_INVALIDO) {
    return { error: 'La nota de la firma es demasiado larga: máximo 500 letras.', yaFirmada: false }
  }
  if (funcionNoExiste(error.code)) {
    return { error: ERROR_SIN_ACTIVAR, yaFirmada: false }
  }
  return { error: 'No se pudo guardar la firma. Vuelve a intentarlo.', yaFirmada: false }
}

/**
 * Acepta o descarta una observación pendiente. Solo manda el id, la decisión y la nota: quién firma y
 * cuándo lo pone la base. Vuelve la fila ya firmada, para repintar sin volver a pedir la lista.
 */
export async function firmarObservacion(
  id: string,
  decision: DecisionObservacion,
  nota?: string,
): Promise<ResultadoFirma> {
  if (!modoNube) return { ok: false, error: 'Sin conexión con la base: esto es un demo.', yaFirmada: false }
  try {
    const { data, error } = await supabase().rpc(RPC_FIRMAR_OBSERVACION, {
      p_id: id,
      p_decision: decision,
      p_nota: nota?.trim() || null,
    })
    if (error) return { ok: false, ...mensajeDeFirma(error) }
    // Una función que devuelve una fila baja como objeto; por si el cliente la envolviera en un arreglo.
    const fila = (Array.isArray(data) ? data[0] : data) as FilaObservacionAgente | null | undefined
    if (!fila || typeof fila !== 'object') {
      return { ok: false, error: 'No se pudo guardar la firma. Vuelve a intentarlo.', yaFirmada: false }
    }
    return { ok: true, observacion: aObservacion(fila) }
  } catch {
    // Excepción = la petición ni salió o ni volvió (red). No es un error de la base.
    return { ok: false, error: 'Sin conexión: la firma no se guardó. Vuelve a intentarlo.', yaFirmada: false }
  }
}

/**
 * `2026-10-09T03:30:00Z` → `jue 8 oct 2026`: el día en Colombia (UTC−5, sin horario de verano).
 * Un `timestamptz` se corta por la zona de Colombia y no por la del navegador: una observación escrita
 * a las 9 p. m. caería en «mañana» para quien mire desde otra zona, y `new Date(...).toLocaleDateString`
 * cambiaría el texto con el navegador. Lo que no sea una fecha vuelve tal cual.
 */
export function fechaDeObservacion(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  return fechaDeLlamada(new Date(ms - 5 * 60 * 60 * 1000).toISOString().slice(0, 10))
}
