import { db } from '../dbInstance'
import { reportarError } from '../errores/reportarError'
import { modoNube, supabase } from '../supabase'
import type { ResultadoDeRegistro } from '../../domain/praxis/conversacion'
import type { RegistroPropuesto } from '../../domain/praxis/registro/tipos'

/**
 * El agua que Praxis registra, por la RPC `praxis_aplicar_agua` (migración 0161, G1 del plano
 * CONEXIONES-OPERATIVAS, fila C2). Decisión de Bryan (4-nov): «Praxis escribe y la app FIJA el total devuelto».
 *
 * POR QUÉ. `registrarHidratacion` suma un delta en el teléfono y no es idempotente (P5): el mismo toque dos
 * veces suma dos veces, y el sync sube el total absoluto, así que cualquier suma duplicada queda en la nube.
 * La RPC lleva el libro `(usuario, mensaje_id, indice)`: la misma tarjeta dos veces suma UNA vez y devuelve el
 * total del día. La app no suma nada: pone ese total.
 *
 * APAGADO. `PRAXIS_AGUA_POR_RPC` nace en `false`, como `PRAXIS_ABIERTA_A_ASESORADOS`. Cambiarlo es un cambio
 * de código con su PR, a propósito. Apagado, esta función devuelve los resultados tal cual y no toca nada.
 *
 * COMPORTAMIENTO ANTE FALLOS: si la RPC falla (red, sesión, 4xx, respuesta rara), el resultado queda como hoy
 * (`pendiente_prerrequisito`: «anótalo en el formulario») y el fallo se anota con un texto fijo: ni la persona,
 * ni el mensaje, ni los mL viajan en el aviso.
 *
 * REGLAS QUE PROTEGEN LAS PRUEBAS (`agua.test.ts`):
 *  - solo se fija el agua de QUIEN TIENE LA SESIÓN: si la sesión no es la de la conexión, ni se llama;
 *  - solo se aplica lo que la RPC aceptaría (1 a 3000 mL) y solo de HOY en Bogotá: la RPC siempre escribe
 *    «hoy», así que una tarjeta con otra fecha se deja pendiente en vez de caer en el día equivocado;
 *  - el total que se fija es el DEVUELTO, validado (entero, 0 a 10 000), en la fecha que devuelve la base;
 *  - solo se toca lo que el servidor dejó «pendiente_prerrequisito»: si algún día el servidor ya lo guarda, no
 *    se suma otra vez.
 */
export const PRAXIS_AGUA_POR_RPC = false

export const RPC_APLICAR_AGUA = 'praxis_aplicar_agua'
const TOPE_TARJETA_ML = 3000
const TOPE_DIA_ML = 10000
const AVISO_FALLO = 'praxis_aplicar_agua: no se pudo aplicar el agua'

export interface RespuestaRpcAgua { data: unknown; error: { code?: string } | null }

export interface DependenciasAgua {
  encendido: boolean
  rpc: (args: { p_mensaje_id: string; p_indice: number; p_delta_ml: number }) => Promise<RespuestaRpcAgua>
  /** Quién tiene la sesión (auth.uid()). `null` = no se sabe. */
  usuarioDeLaSesion: () => Promise<string | null>
  fijar: (usuarioId: string, fecha: string, ml: number) => void
  anotarFallo: (aviso: string) => void
  ahora: () => Date
}

const porDefecto = (): DependenciasAgua => ({
  encendido: PRAXIS_AGUA_POR_RPC,
  rpc: async (args) => {
    if (!modoNube) return { data: null, error: { code: 'sin_nube' } }
    const { data, error } = await supabase().rpc(RPC_APLICAR_AGUA, args)
    return { data, error: error ? { code: error.code } : null }
  },
  usuarioDeLaSesion: async () => {
    if (!modoNube) return null
    try { return (await supabase().auth.getSession()).data.session?.user.id ?? null } catch { return null }
  },
  fijar: (usuarioId, fecha, ml) => db.nutricion.fijarHidratacion(usuarioId, fecha, ml),
  anotarFallo: (aviso) => reportarError(new Error(aviso), { donde: 'praxis:agua' }),
  ahora: () => new Date(),
})

/** El día de Bogotá (UTC-5, sin horario de verano), igual que la RPC. 23:30 allá es el día siguiente en UTC. */
export function diaDeBogota(ahora: Date): string {
  return new Date(ahora.getTime() - 5 * 3600_000).toISOString().slice(0, 10)
}

function totalDevuelto(data: unknown): { fecha: string; total: number } | null {
  if (!data || typeof data !== 'object') return null
  const { fecha, total_ml: total } = data as { fecha?: unknown; total_ml?: unknown }
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null
  if (typeof total !== 'number' || !Number.isInteger(total) || total < 0 || total > TOPE_DIA_ML) return null
  return { fecha, total }
}

/**
 * Tras el guardado del servidor: por cada tarjeta de agua que quedó pendiente, aplica la RPC y fija el total.
 * Devuelve los resultados con esas tarjetas en «guardado» cuando la RPC respondió bien. Nunca lanza.
 */
export async function aplicarAguaDePraxis(
  entrada: { usuarioId: string; mensajeId: string; registros: RegistroPropuesto[]; resultados: ResultadoDeRegistro[] },
  deps: Partial<DependenciasAgua> = {},
): Promise<ResultadoDeRegistro[]> {
  const d = { ...porDefecto(), ...deps }
  if (!d.encendido) return entrada.resultados
  try {
    const candidatas = entrada.resultados.filter((r) => r.campo === 'hidratacion' && r.estado === 'pendiente_prerrequisito')
    if (candidatas.length === 0) return entrada.resultados

    const sesion = await d.usuarioDeLaSesion()
    if (!sesion || sesion !== entrada.usuarioId) return entrada.resultados // nunca el agua de otra persona

    const hoy = diaDeBogota(d.ahora())
    const aplicadas = new Set<number>()
    for (const r of candidatas) {
      const reg = entrada.registros[r.indice]
      if (!reg || reg.campo !== 'hidratacion') continue
      const delta = reg.delta_ml
      if (!Number.isInteger(delta) || delta < 1 || delta > TOPE_TARJETA_ML) continue
      if (reg.fecha !== hoy) continue
      const resp = await d.rpc({ p_mensaje_id: entrada.mensajeId, p_indice: r.indice, p_delta_ml: delta })
      const total = resp.error ? null : totalDevuelto(resp.data)
      if (!total) { d.anotarFallo(AVISO_FALLO); continue }
      d.fijar(entrada.usuarioId, total.fecha, total.total)
      aplicadas.add(r.indice)
    }
    return entrada.resultados.map((r) =>
      aplicadas.has(r.indice) && r.campo === 'hidratacion' ? { indice: r.indice, campo: r.campo, estado: 'guardado' as const } : r)
  } catch {
    try { d.anotarFallo(AVISO_FALLO) } catch { /* contar fallos no puede ser un fallo más */ }
    return entrada.resultados
  }
}
