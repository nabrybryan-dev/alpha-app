import type { TarjetaConfirmarDeshacer } from './proponer'
import type { RegistroLibro } from './tipos'

/**
 * Libro de registros SIMULADO en memoria (paso D1). No es producción: el libro real
 * (`praxis_registros_aplicados`) espera su migración (paso D2). Imita lo que el servidor
 * hará en D3: validar la tarjeta, comprobar el dueño, marcar `deshechoEn` y nada más.
 */
export type RespuestaConfirmacion =
  | { ok: true; registro: RegistroLibro }
  | { ok: false; motivo: 'vencida' | 'ya_usada' | 'otro_usuario' | 'no_existe' | 'ya_deshecho' }

export interface LibroSimulado {
  /** Copia de solo lectura del estado actual. */
  registros(): readonly RegistroLibro[]
  /** Cuántas escrituras ha recibido (la orden por sí sola debe dejarlas en 0). */
  escrituras(): number
  /** El usuario pulsa «Sí, quitar». Idempotente: un doble toque revierte una sola vez. */
  confirmar(tarjeta: TarjetaConfirmarDeshacer, usuarioId: string, ahora: Date): RespuestaConfirmacion
}

export function crearLibroSimulado(inicial: readonly RegistroLibro[]): LibroSimulado {
  let filas: readonly RegistroLibro[] = inicial.map((r) => ({ ...r }))
  let escrituras = 0
  const tarjetasUsadas = new Set<string>()
  const llave = (t: TarjetaConfirmarDeshacer) => `${t.registroId}|${t.venceEn}`

  return {
    registros: () => filas.map((r) => ({ ...r })),
    escrituras: () => escrituras,
    confirmar(tarjeta, usuarioId, ahora) {
      if (ahora.getTime() > new Date(tarjeta.venceEn).getTime()) return { ok: false, motivo: 'vencida' }
      if (tarjetasUsadas.has(llave(tarjeta))) return { ok: false, motivo: 'ya_usada' }
      const fila = filas.find((r) => r.id === tarjeta.registroId)
      if (!fila) return { ok: false, motivo: 'no_existe' }
      if (fila.usuarioId !== usuarioId || tarjeta.usuarioId !== usuarioId) return { ok: false, motivo: 'otro_usuario' }
      if (fila.deshechoEn !== null) return { ok: false, motivo: 'ya_deshecho' }
      tarjetasUsadas.add(llave(tarjeta))
      const marcada: RegistroLibro = { ...fila, deshechoEn: ahora.toISOString() }
      filas = filas.map((r) => (r.id === fila.id ? marcada : r))
      escrituras += 1
      return { ok: true, registro: { ...marcada } }
    },
  }
}
