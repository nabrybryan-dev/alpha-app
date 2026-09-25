/**
 * Los errores del navegador de la cartera, leídos para el panel del coach.
 *
 * La tabla (`public.errores_navegador`, migración 0078) la escribe cada teléfono desde
 * `src/data/errores/reportarError.ts` y SOLO la lee el coach. Aquí vive la lectura y el agrupado;
 * la vista es `ErroresDelNavegador.tsx`.
 */
import { supabase } from '../../data/supabase'

/** Lo que el panel mira. Una semana basta para ver una avería y no arrastra fósiles. */
export const DIAS_VENTANA = 7

/**
 * Tope de filas leídas. El cliente manda como mucho 20 por sesión, así que 2.000 son muchas
 * sesiones con fallos: si se llega aquí el panel ya dice lo que tiene que decir.
 */
const LIMITE = 2000

export interface FilaErrorLeida {
  usuario_id: string
  creado_en: string
  mensaje: string
}

export interface GrupoDeError {
  mensaje: string
  veces: number
  personas: number
  ultimoVisto: string
}

/**
 * La tabla todavía no está en la base: la 0078 sin aplicar. No es una avería del panel, así que
 * la vista lo dice con calma en vez de pintar un error.
 */
export class TablaSinAplicar extends Error {
  constructor() {
    super('La tabla errores_navegador no existe todavía (migración 0078 sin aplicar)')
  }
}

export async function leerErroresRecientes(ahora: Date = new Date()): Promise<FilaErrorLeida[]> {
  const desde = new Date(ahora.getTime() - DIAS_VENTANA * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase()
    .from('errores_navegador')
    .select('usuario_id,creado_en,mensaje')
    .gte('creado_en', desde)
    .order('creado_en', { ascending: false })
    .limit(LIMITE)
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') throw new TablaSinAplicar()
    throw new Error(error.message)
  }
  return (data ?? []) as FilaErrorLeida[]
}

/**
 * Un grupo por mensaje: cuántas veces, a cuántas personas, cuándo fue la última.
 *
 * Primero lo que le pasa a MÁS PERSONAS: un fallo de muchos es una avería de la app, y uno de
 * una sola persona muchas veces suele ser su teléfono. A igualdad, lo más reciente.
 */
export function agruparErrores(filas: FilaErrorLeida[]): GrupoDeError[] {
  const porMensaje = new Map<string, { veces: number; personas: Set<string>; ultimoVisto: string }>()
  for (const f of filas) {
    const g = porMensaje.get(f.mensaje)
    if (!g) {
      porMensaje.set(f.mensaje, { veces: 1, personas: new Set([f.usuario_id]), ultimoVisto: f.creado_en })
      continue
    }
    g.veces += 1
    g.personas.add(f.usuario_id)
    if (Date.parse(f.creado_en) > Date.parse(g.ultimoVisto)) g.ultimoVisto = f.creado_en
  }
  return [...porMensaje.entries()]
    .map(([mensaje, g]) => ({ mensaje, veces: g.veces, personas: g.personas.size, ultimoVisto: g.ultimoVisto }))
    .sort((a, b) => b.personas - a.personas || Date.parse(b.ultimoVisto) - Date.parse(a.ultimoVisto))
}
