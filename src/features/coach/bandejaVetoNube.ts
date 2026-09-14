/**
 * Acceso a Supabase de la bandeja del veto de 24 h.
 *
 * Separa la nube de la pantalla igual que `consultasNube.ts`: la vista
 * (`BandejaVeto.tsx`) solo habla con estas dos funciones y no toca
 * `supabase()` directo. Así el mock del test puede sustituir el cliente.
 */
import { supabase } from '../../data/supabase'

/** Lo que guarda `publicaciones_pendientes` y lo que ve el coach. */
export interface PendienteVeto {
  id: string
  usuarioId: string
  microcicloId: string
  idAnterior: string | null
  datos: Record<string, unknown>
  avisos: unknown[]
  traeParada: boolean
  creadoEn: string
  publicarEn: string
  estado: string
  motivo: string | null
}

export interface FilaBandeja {
  pendiente: PendienteVeto
  nombre: string
  microcicloNumero: number | undefined
}

interface FilaCruda {
  id: string
  usuario_id: string
  microciclo_id: string
  id_anterior: string | null
  datos: Record<string, unknown>
  avisos: unknown
  trae_parada: boolean
  creado_en: string
  publicar_en: string
  estado: string
  motivo: string | null
}

function aPendiente(f: FilaCruda): PendienteVeto {
  return {
    id: f.id,
    usuarioId: f.usuario_id,
    microcicloId: f.microciclo_id,
    idAnterior: f.id_anterior,
    datos: f.datos as Record<string, unknown>,
    avisos: Array.isArray(f.avisos) ? (f.avisos as unknown[]) : [],
    traeParada: Boolean(f.trae_parada),
    creadoEn: f.creado_en,
    publicarEn: f.publicar_en,
    estado: f.estado,
    motivo: f.motivo,
  }
}

/**
 * Lee todo lo que queda en bandeja (`estado = 'pendiente'`).
 *
 * Los nombres van en consulta aparte: si fallara, las filas se siguen
 * viendo con el id como reserva. Igual que `leerConsultas`.
 */
export async function leerBandeja(): Promise<FilaBandeja[]> {
  const sb = supabase()

  const { data, error } = await sb
    .from('publicaciones_pendientes')
    .select('id,usuario_id,microciclo_id,id_anterior,datos,avisos,trae_parada,creado_en,publicar_en,estado,motivo')
    .eq('estado', 'pendiente')
    .order('publicar_en', { ascending: true })
  if (error) throw new Error(error.message)

  const pendientes = (data ?? []).map((f) => aPendiente(f as FilaCruda))

  const ids = [...new Set(pendientes.map((p) => p.usuarioId))]
  let nombres: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: usuarios } = await sb.from('usuarios_app').select('id,nombre').in('id', ids)
    for (const u of usuarios ?? []) nombres[u.id as string] = u.nombre as string
  }

  return pendientes.map((p) => ({
    pendiente: p,
    nombre: nombres[p.usuarioId] ?? p.usuarioId,
    microcicloNumero:
      typeof p.datos.numero === 'number' ? (p.datos.numero as number) : undefined,
  }))
}

/**
 * Para una publicación: `select parar_publicacion(p_id, p_motivo)`.
 *
 * Lanza si RLS la rechaza o si Supabase devuelve error. Quien llama
 * decide si sacar la fila de la lista o enseñar el mensaje.
 */
export async function pararPublicacion(id: string, motivo: string): Promise<void> {
  const { error } = await supabase().rpc('parar_publicacion', {
    p_id: id,
    p_motivo: motivo,
  })
  if (error) throw new Error(error.message)
}

/** Horas y minutos que quedan hasta publicar. Negativo = ya venció. */
export function msRestantes(publicarEn: string, ahoraMs = Date.now()): number {
  const t = new Date(publicarEn).getTime()
  return Number.isNaN(t) ? 0 : t - ahoraMs
}

export function textoCuentaAtras(publicarEn: string, ahoraMs = Date.now()): string {
  const ms = msRestantes(publicarEn, ahoraMs)
  if (ms <= 0) return 'vencida — publica en el próximo barrido'
  const totalMin = Math.ceil(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}
