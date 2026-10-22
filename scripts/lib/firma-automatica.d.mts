export function elegirParaFirmar(p: {
  manifiesto: { encargos: { usuarioId: string; guion?: string; omitido?: boolean; mensaje?: { estado?: string } }[] }
  filas: { usuario_id: string; guion: string | null; aprobado_en: string | null }[]
}): { usuarios: string[]; noFirmadas: { usuarioId: string; motivo: string }[] }
export function firmarRevisionesAutomaticas(
  supabase: { rpc(nombre: string, args: object): PromiseLike<{ data: unknown; error: { message: string } | null }> },
  p: { semana: string; usuarios: string[] },
): Promise<{ firmadas: number; pedidas: number }>
export function banderaDeFirmaEncendida(p?: { argumento?: unknown; archivo?: string }): boolean
