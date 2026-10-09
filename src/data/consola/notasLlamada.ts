import { modoNube, supabase } from '../supabase'

/**
 * La bitácora de llamadas del coach con cada asesorado (migraciones 0112 y 0113): fecha,
 * hora, conclusiones, tareas que quedan y próxima reunión. Staff-only por RLS — el asesorado
 * nunca la ve, es la bitácora interna de Manuela, no un mensaje hacia él.
 *
 * La puerta NO es solo `es_coach()`: desde la 0113 es `es_coach()` o la capacidad
 * `leer_entrenamiento`, la misma condición que abre la consola. Con `es_coach()` a secas
 * (0112) Manuela —rol `nutricionista`, sin `puesto_de_coach`— no podía ni leer ni escribir
 * la bitácora que se hizo para ella, y la base no daba error: le devolvía cero filas.
 *
 * El autor (`coach_id`) lo pone la base, nunca este archivo: `default auth.uid()` en la
 * columna más el `with check` de la política de escritura. Mismo criterio que
 * `responder_como_staff` — no se manda ni se confía en lo que diga el cliente.
 */
export const TABLA_NOTAS_LLAMADA = 'notas_llamada'

export const COLUMNAS_NOTAS_LLAMADA = [
  'id',
  'usuario_id',
  'coach_id',
  'fecha',
  'hora',
  'conclusiones',
  'tareas',
  'proxima_reunion',
  'creado_en',
] as const

const SELECCION_NOTAS_LLAMADA = COLUMNAS_NOTAS_LLAMADA.join(',')

/** La fila tal como baja de Supabase. */
export interface FilaNotaLlamada {
  id: string
  usuario_id: string
  coach_id: string
  fecha: string
  /** `time` de Postgres: baja como `HH:MM:SS`, no como `HH:MM`. Ver `horaDeLlamada`. */
  hora: string | null
  conclusiones: string
  tareas: string | null
  proxima_reunion: string | null
  creado_en: string
}

/** La misma fila, en el vocabulario del dominio. */
export interface NotaLlamada {
  id: string
  usuarioId: string
  coachId: string
  fecha: string
  hora: string | null
  conclusiones: string
  tareas: string | null
  proximaReunion: string | null
  creadoEn: string
}

function aNotaLlamada(fila: FilaNotaLlamada): NotaLlamada {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    coachId: fila.coach_id,
    fecha: fila.fecha,
    hora: fila.hora,
    conclusiones: fila.conclusiones,
    tareas: fila.tareas,
    proximaReunion: fila.proxima_reunion,
    creadoEn: fila.creado_en,
  }
}

export type ResultadoNotasLlamada = { ok: true; notas: NotaLlamada[] } | { ok: false; error: string }

const ERROR_CARGA = 'No se pudieron cargar las notas de llamada.'

/**
 * Las notas de llamada de un asesorado, más reciente primero. Nunca lanza, pero TAMPOCO se
 * traga el fallo: antes devolvía `[]` ante cualquier error y la pantalla pintaba «todavía no
 * hay llamadas» igual que si de verdad no las hubiera — y alguien podía anotar encima creyendo
 * que era la primera. Ahora un fallo es `ok: false`; `ok: true` con lista vacía solo significa
 * «no hay notas» (o «no hay base a la que preguntar», en el demo).
 *
 * Orden: fecha desc, luego hora desc con las notas sin hora al final (en Postgres un `desc`
 * pone los `null` primero, y una llamada sin hora no es la más tardía del día), luego
 * `creado_en` desc para desempatar.
 */
export async function notasLlamadaDe(usuarioId: string): Promise<ResultadoNotasLlamada> {
  if (!modoNube || !usuarioId) return { ok: true, notas: [] }
  try {
    const { data, error } = await supabase()
      .from(TABLA_NOTAS_LLAMADA)
      .select(SELECCION_NOTAS_LLAMADA)
      .eq('usuario_id', usuarioId)
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false, nullsFirst: false })
      .order('creado_en', { ascending: false })
    // Sin error pero sin datos tampoco es «lista vacía»: la base no contestó nada.
    if (error || !data) return { ok: false, error: ERROR_CARGA }
    return { ok: true, notas: (data as unknown as FilaNotaLlamada[]).map(aNotaLlamada) }
  } catch {
    return { ok: false, error: ERROR_CARGA }
  }
}

export interface NuevaNotaLlamada {
  fecha: string
  /** `HH:MM`, opcional: a veces Manuela solo quiere dejar el día. */
  hora?: string
  conclusiones: string
  /** Lo que le queda por hacer al asesorado (o a Manuela) tras la llamada. Texto libre. */
  tareas?: string
  proximaReunion?: string
}

export type ResultadoAgregarNota = { ok: true; nota: NotaLlamada } | { ok: false; error: string }

const CODIGO_SIN_PERMISO = '42501'

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * El mensaje que ve quien anota. El texto crudo de PostgREST (inglés, con nombres de columna)
 * no se enseña nunca: solo el permiso tiene un mensaje propio porque es el único error que la
 * persona puede entender y a la vez no arreglar reintentando.
 */
function mensajeDeError(error: { code?: string }): string {
  if (error.code === CODIGO_SIN_PERMISO) return 'No tienes permiso para anotar llamadas de este asesorado.'
  return 'No se pudo guardar la nota. Vuelve a intentarlo.'
}

/**
 * Anota una llamada. `coach_id` NO se manda: lo pone la columna (`default auth.uid()`),
 * así que ni siquiera hay con qué intentar falsearlo desde aquí.
 */
export async function agregarNotaLlamada(
  usuarioId: string,
  nota: NuevaNotaLlamada,
): Promise<ResultadoAgregarNota> {
  if (!modoNube) return { ok: false, error: 'Sin conexión con la base: esto es un demo.' }
  if (!nota.conclusiones.trim()) return { ok: false, error: 'Escribe qué se habló en la llamada.' }
  // Una fecha vacía llegaba a la base y volvía como un error crudo en inglés.
  if (!FECHA_ISO.test(nota.fecha)) return { ok: false, error: 'Pon la fecha de la llamada.' }
  try {
    const { data, error } = await supabase()
      .from(TABLA_NOTAS_LLAMADA)
      .insert({
        usuario_id: usuarioId,
        fecha: nota.fecha,
        hora: nota.hora || null,
        conclusiones: nota.conclusiones.trim(),
        tareas: nota.tareas?.trim() || null,
        proxima_reunion: nota.proximaReunion?.trim() || null,
      })
      .select(SELECCION_NOTAS_LLAMADA)
      .single()
    if (error || !data) return { ok: false, error: mensajeDeError(error ?? {}) }
    return { ok: true, nota: aNotaLlamada(data as unknown as FilaNotaLlamada) }
  } catch {
    // Excepción = la petición ni salió o ni volvió (red). No es un error de la base.
    return { ok: false, error: 'Sin conexión: la nota no se guardó. Vuelve a intentarlo.' }
  }
}

/**
 * Corrige una nota ya guardada. Solo la suya: la política de la 0114 exige `coach_id =
 * auth.uid()`, así que para una nota ajena la base no cambia ninguna fila y aquí se dice.
 * No se manda `usuario_id` ni `coach_id`: una corrección no cambia de quién es la llamada ni
 * quién la anotó (y la base no da permiso para tocar esas columnas).
 */
export async function corregirNotaLlamada(id: string, nota: NuevaNotaLlamada): Promise<ResultadoAgregarNota> {
  if (!modoNube) return { ok: false, error: 'Sin conexión con la base: esto es un demo.' }
  if (!nota.conclusiones.trim()) return { ok: false, error: 'Escribe qué se habló en la llamada.' }
  if (!FECHA_ISO.test(nota.fecha)) return { ok: false, error: 'Pon la fecha de la llamada.' }
  try {
    const { data, error } = await supabase()
      .from(TABLA_NOTAS_LLAMADA)
      .update({
        fecha: nota.fecha,
        hora: nota.hora || null,
        conclusiones: nota.conclusiones.trim(),
        tareas: nota.tareas?.trim() || null,
        proxima_reunion: nota.proximaReunion?.trim() || null,
      })
      .eq('id', id)
      .select(SELECCION_NOTAS_LLAMADA)
    if (error || !data) return { ok: false, error: mensajeDeError(error ?? {}) }
    const filas = data as unknown as FilaNotaLlamada[]
    // Bajo RLS, corregir una nota ajena no falla: no toca ninguna fila.
    if (filas.length === 0) return { ok: false, error: 'Solo puedes corregir las notas que anotaste tú.' }
    return { ok: true, nota: aNotaLlamada(filas[0]) }
  } catch {
    return { ok: false, error: 'Sin conexión: la nota no se guardó. Vuelve a intentarlo.' }
  }
}

export type ResultadoBorrarNota = { ok: true } | { ok: false; error: string }

/** Borra una nota. Solo la suya, por la misma política que la corrección. No se puede deshacer. */
export async function borrarNotaLlamada(id: string): Promise<ResultadoBorrarNota> {
  if (!modoNube) return { ok: false, error: 'Sin conexión con la base: esto es un demo.' }
  try {
    const { data, error } = await supabase().from(TABLA_NOTAS_LLAMADA).delete().eq('id', id).select('id')
    if (error || !data) {
      return {
        ok: false,
        error:
          error?.code === CODIGO_SIN_PERMISO
            ? 'No tienes permiso para borrar esta nota.'
            : 'No se pudo borrar la nota. Vuelve a intentarlo.',
      }
    }
    if ((data as unknown[]).length === 0) return { ok: false, error: 'Solo puedes borrar las notas que anotaste tú.' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Sin conexión: la nota no se borró. Vuelve a intentarlo.' }
  }
}

// ------------------------------------------------------------------ formato

const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * `2026-10-08` → `jue 8 oct 2026`.
 *
 * Se arma a mano (arreglos de días y meses) y no con `toLocaleDateString`: en es-CO abrevia
 * con punto («oct.», «sept.») y el texto cambiaría con el navegador que lo pinte. Y el ISO se
 * parte en año/mes/día para construir `new Date(año, mes - 1, día)`: **nunca**
 * `new Date('2026-10-08')`, que se lee como medianoche UTC y en Colombia (UTC−5) cae el día
 * anterior — «miércoles 7» para una llamada del jueves.
 *
 * Un texto que no sea una fecha real (`''`, `2026-02-31`) vuelve tal cual: mejor enseñar lo
 * que hay que inventarse un día.
 */
export function fechaDeLlamada(iso: string): string {
  if (!FECHA_ISO.test(iso)) return iso
  const [anio, mes, dia] = iso.split('-').map(Number)
  const fecha = new Date(anio, mes - 1, dia)
  // `new Date(2026, 1, 31)` no falla: rueda al 3 de marzo. Si el día no se conserva, no existía.
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return iso
  return `${DIAS_SEMANA[fecha.getDay()]} ${dia} ${MESES_CORTOS[mes - 1]} ${anio}`
}

/** `18:30:00` (como baja la columna `time`) → `18:30`. Lo que no parezca una hora vuelve tal cual. */
export function horaDeLlamada(hora: string): string {
  const partes = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(hora)
  return partes ? `${partes[1]}:${partes[2]}` : hora
}
