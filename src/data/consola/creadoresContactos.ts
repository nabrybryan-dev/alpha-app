import { modoNube, supabase } from '../supabase'
import { leerTodasLasPaginas, type Lectura } from './creadores'

/**
 * Lectura de `creadores_contactos` (migración 0178): una fila por contacto que un creador dejó
 * en el PRAXIS de la landing (WhatsApp o correo, con su valor). Va aparte de `creadores.ts`
 * porque es DATO PERSONAL: no viaja en el select del tablero, se pide solo al abrir un candidato.
 *
 * SOLO LECTURA: la escribe `creadores_landing_registrar` con service_role. RLS deja leer al coach
 * y a quien tiene `revisar_creadores` (`puede_ver_creadores()`).
 *
 * Funciona aunque la 0178 no esté aplicada: la consulta falla, `contactosDe` devuelve el fallo
 * (nunca lanza) y la tarjeta simplemente no muestra contacto. Las columnas salen de aquí y las
 * pruebas las comparan contra el SQL de la 0178.
 */
export const TABLA_CREADORES_CONTACTOS = 'creadores_contactos'
export const COLUMNAS_CREADORES_CONTACTOS = ['id', 'creador_id', 'tipo', 'valor', 'origen', 'recibido_en'] as const

export type TipoContacto = 'whatsapp' | 'correo'

export const NOMBRE_TIPO_CONTACTO: Record<TipoContacto, string> = {
  whatsapp: 'WhatsApp',
  correo: 'Correo',
}

export interface ContactoCreador {
  id: string
  creadorId: string
  tipo: TipoContacto
  valor: string
  recibidoEn: string
}

interface FilaContacto {
  id: string
  creador_id: string
  tipo: string
  valor: string | null
  origen: string
  recibido_en: string
}

/** Una fila con tipo desconocido o sin valor se descarta (no se disfraza de contacto). */
export function aContacto(fila: FilaContacto): ContactoCreador | null {
  if (!Object.hasOwn(NOMBRE_TIPO_CONTACTO, fila.tipo)) return null
  if (typeof fila.valor !== 'string' || fila.valor.trim() === '') return null
  return {
    id: fila.id,
    creadorId: fila.creador_id,
    tipo: fila.tipo as TipoContacto,
    valor: fila.valor,
    recibidoEn: fila.recibido_en,
  }
}

/** Los contactos de un creador, el más reciente primero. Nunca lanza. En demo, un vacío confirmado. */
export async function contactosDe(creadorId: string): Promise<Lectura<ContactoCreador[]>> {
  if (!modoNube || !creadorId) return { ok: true, datos: [] }
  try {
    const r = await leerTodasLasPaginas<FilaContacto>(
      (despuesDe, tam) => {
        let q = supabase().from(TABLA_CREADORES_CONTACTOS).select(COLUMNAS_CREADORES_CONTACTOS.join(',')).eq('creador_id', creadorId)
        if (despuesDe !== null) q = q.gt('id', despuesDe)
        return q.order('id', { ascending: true }).limit(tam)
      },
      () => supabase().from(TABLA_CREADORES_CONTACTOS).select('id', { count: 'exact', head: true }).eq('creador_id', creadorId),
      (f) => f.id,
    )
    if (!r.ok) return r
    const datos = r.datos.map(aContacto).filter((c): c is ContactoCreador => c !== null)
    datos.sort((a, b) => b.recibidoEn.localeCompare(a.recibidoEn) || a.id.localeCompare(b.id))
    return { ok: true, datos }
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'la consulta falló' }
  }
}

/** «WhatsApp · +57…» / «Correo · …». */
export function textoContacto(c: ContactoCreador): string {
  return `${NOMBRE_TIPO_CONTACTO[c.tipo]} · ${c.valor}`
}
