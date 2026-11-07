// Rutas con «.ts»: este módulo lo importa también la Edge Function `praxis-registro` (Deno).
/**
 * La memoria de la charla entre días (migración 0166, aplicada el 7-nov-2026; decisión de Bryan: la charla completa).
 * Aquí solo se decide QUÉ se guarda de cada frase; lo manda el servidor con service_role (`praxis-registro/memoria.ts`).
 * Esqueleto: el red de las pruebas se escribe antes que la regla (CLAUDE.md §5).
 */
export const MAX_TEXTO_MEMORIA = 2000 // el check de `texto` en la 0166

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

export function leerMarcaCharla(_bruto: unknown): MarcaCharla | null {
  return null
}

export function filasDeTurno(_t: {
  usuarioId: string; marca: MarcaCharla; frase: string; respuesta: string | null; clinico: boolean; aviso: boolean
}): FilaTurno[] {
  return []
}
