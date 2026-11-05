import { leerPropuestaDeshacer, leerResultadoDeshacer, type PropuestaDeshacerPantalla, type ResultadoDeshacer, type TarjetaFirmada } from '../../domain/praxis/deshacer/pantalla'
import type { SesionDeFunciones } from './registrador'

/**
 * «Deshacer» de Praxis, lado cliente: `POST /praxis-registro/deshacer` (Edge Function, apagada con `PRAXIS_LIBRO`).
 *
 *   elegirParaDeshacer → `{elegir: id}`: la tarjeta de ESE candidato. No deshace nada.
 *   deshacerRegistro   → `{tarjeta, confirmado:true, mensaje_id}`: SOLO se llama tras el toque en «Sí, quitar».
 *
 * Nunca lanzan. A diferencia de `registrador.ts`, aquí el cuerpo de un 4xx también se lee: el servidor dice en él qué pasó
 * (venció, es de otro día…) y la pantalla lo cuenta en una frase.
 */
const RUTA = '/functions/v1/praxis-registro/deshacer'

async function enviar(sesion: SesionDeFunciones | null, cuerpo: unknown): Promise<{ status: number; datos: unknown } | null> {
  if (!sesion?.access_token || !sesion.url) return null
  try {
    const r = await fetch(`${sesion.url}${RUTA}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${sesion.access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
    return { status: r.status, datos: await r.json().catch(() => null) }
  } catch {
    return null
  }
}

export type RespuestaDeElegir = { ok: true; propuesta: Extract<PropuestaDeshacerPantalla, { accion: 'confirmar_deshacer' }> } | { ok: false }

export async function elegirParaDeshacer(sesion: SesionDeFunciones | null, registroId: string): Promise<RespuestaDeElegir> {
  const r = await enviar(sesion, { elegir: registroId })
  const d = r?.datos as { tipo?: unknown; propuesta?: unknown } | null | undefined
  if (!r || r.status < 200 || r.status >= 300 || d?.tipo !== 'deshacer') return { ok: false }
  const p = leerPropuestaDeshacer(d.propuesta)
  return p?.accion === 'confirmar_deshacer' ? { ok: true, propuesta: p } : { ok: false }
}

export async function deshacerRegistro(sesion: SesionDeFunciones | null, p: { tarjeta: TarjetaFirmada; mensajeId: string }): Promise<ResultadoDeshacer> {
  const r = await enviar(sesion, { tarjeta: p.tarjeta, confirmado: true, mensaje_id: p.mensajeId })
  return r ? leerResultadoDeshacer(r.status, r.datos) : 'no_se_pudo'
}
