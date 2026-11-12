/**
 * Deshacer por frase (paso D1, diseño DISENO-DESHACER-REAL-20261104). Dominio puro.
 *
 * El «libro» real (`praxis_registros_aplicados`) necesita una migración que aún no
 * está aplicada (paso D2). Aquí solo se define lo mínimo que el diseño pide de una
 * fila de ese libro, para elegir candidatos y redactar la confirmación.
 */

/** Los únicos tipos que entran al libro (diseño §5): nunca alertas ni avisos. */
export type TipoRegistroLibro = 'series' | 'testPost' | 'adherencia' | 'hidratacion' | 'comida' | 'checkin'

export interface RegistroLibro {
  id: string
  usuarioId: string
  tipo: TipoRegistroLibro
  /** Descripción corta y sin texto libre del asesorado: «+250 ml», «almuerzo, 3 alimentos». */
  descripcion: string
  /** Instante en que Praxis lo aplicó (ISO 8601 con zona). */
  creadoEn: string
  /** Nulo mientras siga vigente; el libro no borra, marca. */
  deshechoEn: string | null
}

/** Ventana de decisión de Bryan (4-nov): 24 h Y solo registros del mismo día local. */
export const VENTANA_HORAS = 24
/** Tope de botones al haber varios candidatos. */
export const MAX_CANDIDATOS = 3
/** La tarjeta de confirmación caduca a los 2 minutos (diseño §4). */
export const VIGENCIA_CONFIRMACION_MIN = 2
/** Zona de las personas de Alpha. Colombia no tiene horario de verano. */
export const ZONA_BOGOTA = 'America/Bogota'
