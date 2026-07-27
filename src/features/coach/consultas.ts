/**
 * Lógica pura del panel de consultas del coach: tipos, clasificación y orden.
 *
 * No toca la red ni el almacén local a propósito. La vista
 * (`ConsultasPage.tsx`) trae las filas de Supabase y pasa por aquí; así lo
 * que decide qué merece la atención de Bryan se puede probar sin montar nada.
 */

export type ViaConsulta = 'ficha' | 'ficha_tentativa' | 'ia_vivo' | 'escalado'
export type EstadoConsulta = 'criterio' | 'dudas' | 'resuelto'

export interface Consulta {
  id: string
  usuarioId: string
  mensaje: string
  fichaId: string | null
  similitud: number | null
  via: ViaConsulta
  banderaRoja: boolean
  revisado: boolean
  corregido: boolean
  creadoEn: string
}

export interface Grupos {
  criterio: Consulta[]
  dudas: Consulta[]
  resuelto: Consulta[]
}

/**
 * Una consulta ya revisada sale de la cola, sea cual sea su origen: el coach
 * ya la vio y esa es la señal que importa. Lo demás se ordena por cuánto
 * necesita su criterio, no por la hora.
 */
export function estadoDe(c: Consulta): EstadoConsulta {
  if (c.revisado) return 'resuelto'
  if (c.banderaRoja || c.via === 'escalado' || c.via === 'ia_vivo') return 'criterio'
  if (c.via === 'ficha_tentativa') return 'dudas'
  return 'resuelto'
}

export function agrupar(consultas: Consulta[]): Grupos {
  const g: Grupos = { criterio: [], dudas: [], resuelto: [] }
  for (const c of consultas) g[estadoDe(c)].push(c)
  const recientePrimero = (a: Consulta, b: Consulta) => b.creadoEn.localeCompare(a.creadoEn)
  g.criterio.sort(recientePrimero)
  g.dudas.sort(recientePrimero)
  g.resuelto.sort(recientePrimero)
  return g
}
