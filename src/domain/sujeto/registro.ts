import { GRAVEDAD } from './convenciones'
import { valoresDeLeva } from './deleva'
import { LIMITES_DE_CORDURA } from './sujeto'

/**
 * Todas las constantes numéricas que el dominio del sujeto toma de una fuente, con su id.
 * `scripts/comprobar-procedencias-sujeto.mts` las compara con `PROCEDENCIAS.tsv`.
 * Cada fase añade aquí su tabla; una constante que no está aquí no está vigilada.
 */
export const VALORES_REGISTRADOS: Readonly<Record<string, number>> = {
  ...valoresDeLeva(),
  'convenciones.gravedad': GRAVEDAD,
  'sujeto.limite.talla_min': LIMITES_DE_CORDURA.tallaMin,
  'sujeto.limite.talla_max': LIMITES_DE_CORDURA.tallaMax,
  'sujeto.limite.masa_min': LIMITES_DE_CORDURA.masaMin,
  'sujeto.limite.masa_max': LIMITES_DE_CORDURA.masaMax,
}
