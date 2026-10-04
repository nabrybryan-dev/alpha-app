import { VERSION_AUTORIZACION } from '../../domain/interesados/formulario'
import { pareceCodigoDeAtajo } from '../../domain/salud/atajo'
import { modoNube, supabase } from '../supabase'

/**
 * Salud del celular, Fase A (migración 0093): el permiso de la casilla E, el código del
 * Atajo de Apple y lo que la pantalla necesita para pintarse.
 *
 * TODO pasa por funciones de la base (`salud_*`), no por las tablas: ninguna sesión de
 * usuario puede escribir en ellas, y las funciones sacan quién es la persona de `auth.uid()`,
 * nunca de un parámetro. Este módulo no repite esas comprobaciones —las asume— y nunca lanza:
 * una pantalla opcional no puede romper Bienestar.
 *
 * EL CÓDIGO EN CLARO no se guarda en ninguna parte: ni en el almacenamiento del teléfono, ni
 * en un registro, ni en el estado global. Lo devuelve `generarCodigoAtajo` una sola vez y
 * quien lo pide lo enseña y lo suelta.
 *
 * Sin nube (modo demo) todo devuelve `sin_nube` y la pantalla no se pinta.
 */

export interface EstadoSalud {
  /** ¿Tiene la casilla E vigente? */
  permiso: boolean
  permisoDesde: string | null
  /** ¿Tiene un código del atajo activo? */
  codigoActivo: boolean
  codigoCreadoEn: string | null
  /** La última vez que el atajo mandó algo (el código se usó). */
  codigoUltimoUsoEn: string | null
  /** El día de la última muestra recibida, `AAAA-MM-DD`. */
  ultimaMuestra: string | null
}

export type Motivo = 'sin_nube' | 'sin_permiso' | 'error'
export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; motivo: Motivo }

interface FilaEstado {
  consentimiento?: boolean
  consentimiento_desde?: string | null
  codigo_activo?: boolean
  codigo_creado_en?: string | null
  codigo_ultimo_uso_en?: string | null
  ultima_muestra?: string | null
}

function aEstado(f: FilaEstado): EstadoSalud {
  return {
    permiso: f.consentimiento === true,
    permisoDesde: f.consentimiento_desde ?? null,
    codigoActivo: f.codigo_activo === true,
    codigoCreadoEn: f.codigo_creado_en ?? null,
    codigoUltimoUsoEn: f.codigo_ultimo_uso_en ?? null,
    ultimaMuestra: f.ultima_muestra ?? null,
  }
}

/**
 * Cómo está esta persona. `null` si no hay nube o si la base no responde —por ejemplo,
 * porque la migración 0093 todavía no está aplicada—: en los dos casos la pantalla no se
 * pinta, en vez de enseñar un botón que no puede funcionar.
 */
export async function leerEstadoSalud(): Promise<EstadoSalud | null> {
  if (!modoNube) return null
  try {
    const { data, error } = await supabase().rpc('salud_estado')
    if (error || !data || typeof data !== 'object') return null
    return aEstado(data as FilaEstado)
  } catch {
    return null
  }
}

/** 42501 = insufficient_privilege: la base dice «falta el permiso» (p. ej. generar un código sin la E). */
function motivoDe(error: { code?: string } | null): Motivo {
  return error?.code === '42501' ? 'sin_permiso' : 'error'
}

/**
 * La persona marca «Sí» en la casilla E y acepta la declaración. La versión del texto que
 * se manda es la que la pantalla enseñó; si no es la vigente en la base, la base lo rechaza.
 */
export async function otorgarPermisoE(): Promise<Resultado> {
  if (!modoNube) return { ok: false, motivo: 'sin_nube' }
  try {
    const { error } = await supabase().rpc('salud_dar_consentimiento', {
      p_version: VERSION_AUTORIZACION,
      p_declaracion: true,
    })
    return error ? { ok: false, motivo: motivoDe(error) } : { ok: true }
  } catch {
    return { ok: false, motivo: 'error' }
  }
}

export interface ResumenRevocacion {
  codigosRevocados: number
  muestrasBorradas: number
}

/**
 * Revoca el permiso: la base anota el evento, revoca el código del atajo y, si se pide,
 * borra lo ya enviado.
 */
export async function revocarPermisoE(borrarDatos: boolean): Promise<Resultado<ResumenRevocacion>> {
  if (!modoNube) return { ok: false, motivo: 'sin_nube' }
  try {
    const { data, error } = await supabase().rpc('salud_revocar_consentimiento', { p_borrar_datos: borrarDatos })
    if (error) return { ok: false, motivo: motivoDe(error) }
    const d = (data ?? {}) as { codigos_revocados?: number; muestras_borradas?: number }
    return { ok: true, codigosRevocados: d.codigos_revocados ?? 0, muestrasBorradas: d.muestras_borradas ?? 0 }
  } catch {
    return { ok: false, motivo: 'error' }
  }
}

/**
 * Genera el código del atajo (revoca el anterior). Exige el permiso E vigente. Devuelve el
 * código EN CLARO una sola vez: en la base solo queda su hash.
 */
export async function generarCodigoAtajo(): Promise<Resultado<{ codigo: string }>> {
  if (!modoNube) return { ok: false, motivo: 'sin_nube' }
  try {
    const { data, error } = await supabase().rpc('salud_atajo_generar_token')
    if (error) return { ok: false, motivo: motivoDe(error) }
    const codigo = (data as { token?: unknown } | null)?.token
    // Solo se enseña lo que TIENE la forma de un código: una respuesta rara no se le pasa a la persona.
    return typeof codigo === 'string' && pareceCodigoDeAtajo(codigo) ? { ok: true, codigo } : { ok: false, motivo: 'error' }
  } catch {
    return { ok: false, motivo: 'error' }
  }
}

/** Quita el código activo sin tocar el permiso. `habia` dice si había uno. */
export async function revocarCodigoAtajo(): Promise<Resultado<{ habia: boolean }>> {
  if (!modoNube) return { ok: false, motivo: 'sin_nube' }
  try {
    const { data, error } = await supabase().rpc('salud_atajo_revocar_token')
    return error ? { ok: false, motivo: motivoDe(error) } : { ok: true, habia: data === true }
  } catch {
    return { ok: false, motivo: 'error' }
  }
}
