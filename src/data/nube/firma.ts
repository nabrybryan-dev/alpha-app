import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Lo que una tabla dice de sí misma sin entregar una sola fila: cuántas ve
 * quien pregunta, y cuándo cambió la última.
 *
 * El conteo no es un adorno al lado de la fecha. Es lo que detecta los
 * BORRADOS, y por eso la firma es correcta donde un delta por fila no lo sería:
 * una fila borrada no se modificó, dejó de existir, así que no aparece en
 * ningún «dame lo cambiado desde…». Pero el conteo baja.
 *
 * Diecisiete de las veintiuna tablas hidratadas permiten borrado real y solo
 * cuatro tienen borrado lógico. Ver
 * `docs/specs/2026-08-27-sincronizacion-incremental.md`.
 */
export interface FirmaDeTabla {
  filas: number
  /** `null` si la tabla está vacía: no hay ninguna fecha que sea la última. */
  ultimo: string | null
}

/** Una entrada por tabla hidratada, más la vista `checkins_nutricion`. */
export type FirmaSync = Record<string, FirmaDeTabla>

interface FilaFirma {
  tabla: string
  filas: number | string
  ultimo_cambio: string | null
}

/**
 * Pide la firma al servidor.
 *
 * Devuelve `undefined` ante CUALQUIER problema, y eso es deliberado: mientras
 * la migración 0049 no esté aplicada el RPC no existe, y quien llama tiene que
 * comportarse como siempre —descargarlo todo— en vez de deducir que no ha
 * cambiado nada. Una firma que falla tiene que costar rendimiento, nunca
 * frescura.
 */
export async function pedirFirma(sb: SupabaseClient): Promise<FirmaSync | undefined> {
  let data: unknown
  try {
    const r = await sb.rpc('firma_de_sincronizacion')
    if (r.error) return undefined
    data = r.data
  } catch {
    // Sin red, o el RPC no está. Las dos se resuelven igual: descargar.
    return undefined
  }
  if (!Array.isArray(data)) return undefined

  const firma: FirmaSync = {}
  for (const f of data as FilaFirma[]) {
    if (typeof f?.tabla !== 'string') return undefined
    // PostgREST devuelve `bigint` como texto: `count(*)` llega '24', no 24.
    const filas = Number(f.filas)
    if (!Number.isFinite(filas)) return undefined
    firma[f.tabla] = { filas, ultimo: f.ultimo_cambio ?? null }
  }
  // Una firma vacía no dice nada; se trata como si no hubiera.
  return Object.keys(firma).length > 0 ? firma : undefined
}

/**
 * ¿Puede saltarse la descarga?
 *
 * Solo si las dos firmas son idénticas tabla por tabla. Se compara en LAS DOS
 * DIRECCIONES: si al servidor le apareciera una tabla que la copia local no
 * tiene -una migración nueva- comparar solo las locales diría «igual» y esa
 * tabla no se bajaría nunca.
 *
 * Ante la duda, `false`. Decir «no cambió» de más sirve datos viejos; decirlo
 * de menos solo cuesta una descarga.
 */
export function sinCambios(nueva: FirmaSync, previa: FirmaSync | undefined): boolean {
  if (!previa) return false

  const tablas = new Set([...Object.keys(nueva), ...Object.keys(previa)])
  for (const t of tablas) {
    const a = nueva[t]
    const b = previa[t]
    if (!a || !b) return false
    if (a.filas !== b.filas) return false
    if (a.ultimo !== b.ultimo) return false
  }
  return true
}
