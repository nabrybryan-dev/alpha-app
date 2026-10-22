export interface RevisionAFirmar {
  usuario_id: string
  version: number
  guion_sha256: string
}
export function huellaDelGuion(guion: string | null | undefined): string
export function elegirParaFirmar(p: {
  manifiesto: { encargos: { usuarioId: string; guion?: string; omitido?: boolean; mensaje?: { estado?: string } }[] }
  filas: { usuario_id: string; guion: string | null; version?: number; aprobado_en: string | null }[]
}): { usuarios: string[]; revisiones: RevisionAFirmar[]; noFirmadas: { usuarioId: string; motivo: string }[] }
export function firmarRevisionesAutomaticas(
  supabase: { rpc(nombre: string, args: object): PromiseLike<{ data: unknown; error: { message: string } | null }> },
  p: { semana: string; revisiones: RevisionAFirmar[] },
): Promise<{ firmadas: number; pedidas: number }>
export function banderaDeFirmaEncendida(p?: { argumento?: unknown; archivo?: string }): boolean