// Rutas con «.ts»: este módulo lo importa también la Edge Function `praxis-registro` (Deno).
/**
 * La memoria de la charla entre días (migración 0166, aplicada el 7-nov-2026; decisión de Bryan: la charla completa).
 * Aquí solo se decide QUÉ se guarda de cada frase que llega al servidor; lo manda `praxis-registro/memoria.ts` con
 * service_role (la tabla no deja insertar a nadie más) y solo con el interruptor PRAXIS_GUARDAR_CHARLA=1.
 *
 * - El cliente manda `memoria_charla: { charla_id, turno }`: a qué charla pertenece la frase y el número de turno de la
 *   persona en esa sesión. Nada más: el usuario sale de la sesión validada, nunca del cuerpo.
 * - Cada turno son dos filas, en orden `2·turno` (la persona) y `2·turno + 1` (Praxis). Un reintento del mismo turno
 *   choca con la clave única y se ignora.
 * - Las frases que el filtro deriva se guardan igual, con `marcado_clinico` y `aviso_coach` (la 0166: charla completa;
 *   solo las leen Bryan y los agentes).
 * - Lo que NO llega al servidor no se guarda: la charla local de 0 ms (saludos con libreto), la Quieta y el cuidado
 *   que la pantalla resuelve sola. Tampoco, por ahora: «deshaz lo último», el respaldo sin modelo y lo que choca con el
 *   tope por hora (salen de `proponer` antes de contestar con el modelo).
 */
export const MAX_TEXTO_MEMORIA = 2000 // el check de `texto` en la 0166
const MAX_TURNO = 4999 // n = 2·turno + 1 tiene que caber en el check de la 0166 (0..9999)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface MarcaCharla { charlaId: string; turno: number }

export interface FilaTurno {
  usuario_id: string
  charla_id: string
  n: number
  rol: 'persona' | 'praxis'
  texto: string
  marcado_clinico: boolean
  aviso_coach: boolean
}

/** La marca que manda el cliente, o null si falta o no es válida (entonces no se guarda nada). */
export function leerMarcaCharla(bruto: unknown): MarcaCharla | null {
  if (!bruto || typeof bruto !== 'object') return null
  const o = bruto as { charla_id?: unknown; turno?: unknown }
  if (typeof o.charla_id !== 'string' || !UUID.test(o.charla_id)) return null
  if (typeof o.turno !== 'number' || !Number.isInteger(o.turno) || o.turno < 0 || o.turno > MAX_TURNO) return null
  return { charlaId: o.charla_id.toLowerCase(), turno: o.turno }
}

const recortar = (t: string | null): string => (t ?? '').trim().slice(0, MAX_TEXTO_MEMORIA)

/** Las filas de un turno: la frase y, si la hubo, la respuesta de Praxis. Frase vacía = nada. */
export function filasDeTurno(t: {
  usuarioId: string; marca: MarcaCharla; frase: string; respuesta: string | null; clinico: boolean; aviso: boolean
}): FilaTurno[] {
  const frase = recortar(t.frase)
  if (!frase) return []
  const fila = (n: number, rol: FilaTurno['rol'], texto: string): FilaTurno => ({
    usuario_id: t.usuarioId, charla_id: t.marca.charlaId, n, rol, texto, marcado_clinico: t.clinico, aviso_coach: t.aviso,
  })
  const respuesta = recortar(t.respuesta)
  const n = t.marca.turno * 2
  return respuesta ? [fila(n, 'persona', frase), fila(n + 1, 'praxis', respuesta)] : [fila(n, 'persona', frase)]
}
