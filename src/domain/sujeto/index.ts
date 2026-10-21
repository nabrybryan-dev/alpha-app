/**
 * PUNTO DE ENTRADA PÚBLICO DEL SUJETO ANATÓMICO PROPIO.
 *
 * Es lo que importa el laboratorio anatómico local (repo `laboratorio-anatomico`, visor `lab-visor`) sin
 * arrastrar React ni el resto de la app. Solo REEXPORTA: no define nada ni cambia ningún comportamiento.
 * Una prueba de frontera (`frontera.test.ts`) falla si algo de esta carpeta importa React, `features/`,
 * el DOM o Supabase. Documento para quien lo consume: `API-DEL-SUJETO-PARA-EL-LABORATORIO.md`.
 *
 * Lo que NO se exporta a propósito: `capaDeMomentos` y `repartoDeSentadilla` (son la decisión de qué se
 * dibuja y qué se dice en el salón de la app; el laboratorio decide lo suyo), y `registro`/`procedencias`
 * (arneses del libro de procedencias, no del cálculo).
 *
 * Unidades SI y plano sagital con z hacia donde mira el sujeto e y hacia arriba (ver `convenciones.ts`).
 */

// Convenciones: estados de una cifra, unidades, versión del modelo, gravedad.
export {
  ESTADOS,
  GRAVEDAD,
  UNIDADES,
  VERSION_DEL_MODELO,
  type EstadoDeCifra,
  type Punto,
  type Unidad,
} from './convenciones'

// Contrato de una cifra: valor + unidad + estado + fuente + banda + versión.
export {
  noAfirmable,
  verificarCifra,
  verificarCifras,
  type Banda,
  type Cifra,
  type CodigoDeError,
  type ErrorDeCifra,
} from './contrato'

// Segmentos de de Leva 1996 y el sujeto escalado a medidas reales.
export {
  DE_LEVA,
  DE_LEVA_CERV,
  SEGMENTOS,
  SEGMENTOS_PARES,
  type ParametrosDeSegmento,
  type Segmento,
  type Sexo,
  type TablaDeLeva,
} from './deleva'
export {
  LIMITES_DE_CORDURA,
  construirSujeto,
  masaDeLosSegmentos,
  type EntradaDelSujeto,
  type SegmentoDelSujeto,
  type Sujeto,
} from './sujeto'

// Dinámica inversa estática de la sentadilla con barra.
export {
  geometriaSagital,
  momentosDeSentadilla,
  momentosEstaticos,
  type EntradaDeSentadilla,
  type Geometria,
  type MasaPuntual,
  type MomentosEstaticos,
  type PoseSagital,
  type ResultadoDeSentadilla,
} from './dinamica'

// Bandas p5-p95 por Monte Carlo de esos momentos.
export {
  SIN_INCERTIDUMBRE,
  bandasDeSentadilla,
  type Incertidumbre,
  type OpcionesDeBanda,
} from './bandas'

// Momento pasivo (Silder 2007), con su dominio de validez.
export {
  DOMINIO_DE_SILDER,
  SILDER_MEDIA,
  SILDER_SD,
  angulosDeLaPose,
  dominioDeSilder,
  momentosDeSilder,
  momentosPasivosDeLaPose,
  type AngulosArticulares,
  type ParametrosDeSilder,
} from './pasivo'

// Proporciones de área entre los extensores de cadera (Ward 2009).
export {
  GRUPOS_QUE_EXTIENDEN_LA_CADERA,
  proporcionesCentrales,
  proporcionesDeAreaDeCadera,
  type GrupoDeCadera,
} from './areasDeWard'
