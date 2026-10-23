import { GRAVEDAD } from './convenciones'
import { PCSA_DE_WARD } from './areasDeWard'
import { valoresDeLeva } from './deleva'
import { valoresDeRadios } from './inercia'
import { DOMINIO_DE_SILDER, MUSCULOS_DE_SILDER, SILDER_MEDIA, SILDER_SD } from './pasivo'
import { LIMITES_DE_CORDURA } from './sujeto'
import { FRACCION_TRASERA_BULGARA } from './zancadaBulgara'

/**
 * Todas las constantes numéricas que el dominio del sujeto toma de una fuente, con su id.
 * `scripts/comprobar-procedencias-sujeto.mts` las compara con `PROCEDENCIAS.tsv`.
 * Cada fase añade aquí su tabla; una constante que no está aquí no está vigilada.
 */
/** Las constantes de Silder 2007 (Tabla 4, media y sd; Tabla 2, dominio) con su id. */
function valoresDeSilder(): Record<string, number> {
  const v: Record<string, number> = {}
  for (const m of MUSCULOS_DE_SILDER) {
    for (const c of ['bp', 'bd', 'a'] as const) {
      const media = SILDER_MEDIA[m][c]
      const sd = SILDER_SD[m][c]
      if (media === undefined || sd === undefined) continue
      v[`silder07.${m}.${c}.media`] = media
      v[`silder07.${m}.${c}.sd`] = sd
    }
  }
  for (const [k, x] of Object.entries(DOMINIO_DE_SILDER)) v[`silder07.dominio.${k}`] = x
  // El supuesto que el artículo no cubre: β en 1/rad (1 = por radián, 0 sería por grado). Ver `pasivo.ts`.
  v['pasivo.supuesto.beta_por_radian'] = 1
  return v
}

/** Las áreas de Ward 2009 (Tabla 3, PCSA en cm², media y sd) con su id. */
function valoresDeWard(): Record<string, number> {
  const v: Record<string, number> = {}
  for (const [m, x] of Object.entries(PCSA_DE_WARD)) {
    v[`ward09.${m}.pcsa.media`] = x.media
    v[`ward09.${m}.pcsa.sd`] = x.sd
  }
  return v
}

export const VALORES_REGISTRADOS: Readonly<Record<string, number>> = {
  ...valoresDeLeva(),
  ...valoresDeRadios(),
  ...valoresDeSilder(),
  ...valoresDeWard(),
  // Regla de la búlgara (REPARTO-ZANCADA.md §4): fracción del peso corporal en la pierna trasera.
  'helme20.bulgara.trasera.bw': FRACCION_TRASERA_BULGARA.central,
  'arakawa25.bulgara.trasera.bw_inf': FRACCION_TRASERA_BULGARA.inf,
  'arakawa25.bulgara.trasera.bw_sup': FRACCION_TRASERA_BULGARA.sup,
  'convenciones.gravedad': GRAVEDAD,
  'sujeto.limite.talla_min': LIMITES_DE_CORDURA.tallaMin,
  'sujeto.limite.talla_max': LIMITES_DE_CORDURA.tallaMax,
  'sujeto.limite.masa_min': LIMITES_DE_CORDURA.masaMin,
  'sujeto.limite.masa_max': LIMITES_DE_CORDURA.masaMax,
}
