export interface OrdenDeConsola {
  tipo: string
  objetivo?: { usuario_id?: string; semana_inicio?: string }
  creada_en: string
}
export function personasDetenidas(ordenes: OrdenDeConsola[], semana: string): Set<string>
export function personasConRiesgo(ordenes: OrdenDeConsola[], semana: string): Set<string>
export function armarEntradaDelAgente(p: {
  manifiesto: { semana: string; encargos: object[] }
  fichas?: { usuario_id?: string; ejes?: object[]; microciclo_activo?: number }[]
  roster?: { usuario_id: string; slug: string }[]
  ordenes?: OrdenDeConsola[]
}): { version: 1; semana: string; personas: Record<string, unknown>[] }
export function aplicarSalidaDelAgente(p: {
  manifiesto: { semana: string; encargos: { usuarioId: string; guion?: string; archivoGuion?: string; nombre?: string }[] }
  salida: { agente?: string; entrada_sha256?: string; mensajes?: Record<string, unknown>[] } | null
  riesgos?: Set<string>
}): {
  manifiesto: Record<string, unknown> & { encargos: Record<string, unknown>[] }
  textos: { archivoGuion: string; texto: string }[]
  avisos: { id: string; tipo: string; mensaje: string }[]
  ignorados: string[]
  resumen: { publicar: number; bandeja_humana: number; omitir: number; sin_respuesta: number }
}
export function marcarSinAgente<T extends { encargos: object[] }>(manifiesto: T, motivo: string): T & { mensajeSemanal: Record<string, unknown> }
