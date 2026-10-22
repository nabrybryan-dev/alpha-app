/**
 * RADIOS DE GIRO para el término inercial de la sentadilla (R-1).
 *
 * `deleva.ts` transcribió de la Tabla 4 de de Leva (1996) masas, centros de masa y largos, y dejó los radios de giro
 * sin transcribir porque «los ejes sagital, transverso y longitudinal no se han fijado aún con la fuente». Aquí se
 * transcriben los de los cuatro segmentos con inercia propia que usa la cadena sagital, con los MISMOS extremos que
 * `DE_LEVA_CERV` y la tibia KJC-AJC:
 *   cabeza VERT-CERV · tronco CERV-MIDH · muslo HJC-KJC · tibia KJC-AJC.
 *
 * FUENTE: el texto extraído con pypdf de la Tabla 4 del PDF
 * `cerebro-alpha/herramientas/encoder-camara/articulos/DeLeva_1996_J_Biomech_segment_parameters.pdf` (un OCR del escaneo),
 * leído el 22-oct-2026. En la segunda parte de la tabla (extremos alternativos) el OCR separa las columnas: el radio
 * «sagital» está en la fila, el «transverso» de las mujeres en una columna suelta y el de los hombres con el
 * «longitudinal»; se emparejó por orden de filas y las cifras que se pueden cruzar caen donde deben (la fila del tronco
 * CERV-MIDH da 32,8 / 30,6 / 16,9 para hombres, igual que la tabla de Visual3D y que el banco virtual del laboratorio,
 * que las leyó por su cuenta). Cada radio es una fracción del largo del segmento y se mide respecto de su centro de masas.
 *
 * LO QUE SIGUE SIN FIJARSE: qué eje es el que importa en el plano sagital. La flexión gira alrededor del eje
 * mediolateral; el artículo rotula tres columnas («Sagittal r», «Transverse r», «Longitudinal r») sin decir en la
 * tabla cuál es ese eje. Por eso cada segmento entra como RANGO [menor, mayor] de los dos radios (sagital, transverso),
 * y la banda del término rotacional abarca ambos. El banco virtual usa el transverso y mide la alternativa aparte.
 *
 * Estas constantes todavía no están en `registro.ts` ni en `PROCEDENCIAS.tsv` (están en otro repositorio): pendiente
 * añadir las filas con estado «leído del PDF por OCR» y comprobarlas contra la imagen de la página.
 */

export interface RadiosLeidos {
  sagital: number
  transverso: number
  longitudinal: number
}

export type SegmentoConInercia = 'tibia' | 'muslo' | 'tronco' | 'cabeza'
export type SexoConInercia = 'h' | 'm'

export const RADIOS_DE_GIRO: Readonly<Record<SexoConInercia, Readonly<Record<SegmentoConInercia, RadiosLeidos>>>> = {
  h: {
    cabeza: { sagital: 0.303, transverso: 0.315, longitudinal: 0.261 },
    tronco: { sagital: 0.328, transverso: 0.306, longitudinal: 0.169 },
    muslo: { sagital: 0.329, transverso: 0.329, longitudinal: 0.149 },
    tibia: { sagital: 0.251, transverso: 0.246, longitudinal: 0.102 },
  },
  m: {
    cabeza: { sagital: 0.271, transverso: 0.295, longitudinal: 0.261 },
    tronco: { sagital: 0.307, transverso: 0.292, longitudinal: 0.147 },
    muslo: { sagital: 0.369, transverso: 0.364, longitudinal: 0.162 },
    tibia: { sagital: 0.267, transverso: 0.263, longitudinal: 0.092 },
  },
}

export interface RangoDeRadio {
  /** Fracción del largo del segmento. */
  min: number
  max: number
}

/** El rango del radio de giro (fracción del largo) para el giro en el plano sagital: entre «sagital» y «transverso». */
export function rangoDeRadio(sexo: SexoConInercia, segmento: SegmentoConInercia): RangoDeRadio {
  const r = RADIOS_DE_GIRO[sexo][segmento]
  return { min: Math.min(r.sagital, r.transverso), max: Math.max(r.sagital, r.transverso) }
}

/** Momento de inercia respecto del centro de masas, en kg·m², de UN segmento (masa y largo ya de la persona). */
export function momentoDeInercia(radio: number, masaKg: number, largoM: number): number {
  return masaKg * (radio * largoM) ** 2
}
