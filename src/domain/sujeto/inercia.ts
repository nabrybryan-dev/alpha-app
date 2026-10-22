import { DE_LEVA, DE_LEVA_CERV, type Sexo } from './deleva'

/**
 * RADIOS DE GIRO para el término inercial de la sentadilla (R-1).
 *
 * LO QUE ESTO ES Y LO QUE NO ES. `deleva.ts` transcribió de la Tabla 4 de de Leva (1996) solo masas, centros de masa y
 * largos, y dejó a propósito sin transcribir los radios de giro porque «los ejes sagital, transverso y longitudinal no
 * se han fijado aún con la fuente». Esta sesión no pudo abrir el PDF (el servidor de la copia no responde desde este
 * equipo), así que los valores de abajo vienen de una FUENTE SECUNDARIA y NO están cotejados contra el artículo:
 *
 *  · hombre: muslo (0,329; 0,329; 0,149), tibia (0,251; 0,246; 0,102), tronco (0,328; 0,306; 0,169) — la tabla de
 *    Visual3D (wiki de HAS-motion, «Adjusted Zatsiorsky-Seluyanov's segment inertia parameters»); los de la tibia los
 *    repite, citando la Tabla 4, un cotejo público contra el artículo (sagital 25,1 %, transverso 24,6 %, longitudinal 10,2 %).
 *  · mujer: muslo (0,369; 0,364; 0,162), tronco (0,307; 0,292; 0,147) — la misma tabla de Visual3D.
 *  · NO leídos: la cabeza (los dos sexos) y la tibia de la mujer.
 *
 * Hay tres cosas que la fuente secundaria no dice y que este módulo NO afirma:
 *  1. Qué eje es cuál: para una flexión en el plano sagital el eje que importa es el mediolateral, y la tabla los llama
 *     «sagital» y «transverso». Por eso cada segmento usa como RANGO los dos valores (el menor y el mayor), no uno solo.
 *  2. Si el radio es respecto del centro de masas del segmento (aquí se supone que sí, que es lo que el término `I·α` pide).
 *  3. Que la fila «tronco» de la tabla secundaria es la misma de extremos CERV-MIDH que usa `DE_LEVA_CERV` (coincide
 *     el centro de masas de los hombres, 0,5138; el de las mujeres no se comparó).
 *
 * Donde no hay valor leído se usa una COTA GEOMÉTRICA que no es una opinión: el radio de giro respecto del centro de
 * masas no puede pasar de la mayor distancia de una partícula del segmento a ese centro, que no excede
 * `max(cm, 1 − cm) · largo`. El rango va de 0 a esa cota. Es ancho a propósito.
 *
 * Estas constantes NO están en `registro.ts` ni en `PROCEDENCIAS.tsv` (pendiente: añadir las filas con estado
 * «secundaria, sin cotejar» y cotejar con el PDF cuando se pueda abrir). Por eso las cifras que las usan lo dicen
 * en `fuente` y `supuestos`.
 */

export interface RadiosLeidos {
  sagital: number
  transverso: number
  longitudinal: number
}

export type SegmentoConInercia = 'tibia' | 'muslo' | 'tronco' | 'cabeza'

export const RADIOS_DE_GIRO_SECUNDARIOS: Readonly<
  Record<Sexo, Partial<Record<SegmentoConInercia, RadiosLeidos>>>
> = {
  h: {
    tronco: { sagital: 0.328, transverso: 0.306, longitudinal: 0.169 },
    muslo: { sagital: 0.329, transverso: 0.329, longitudinal: 0.149 },
    tibia: { sagital: 0.251, transverso: 0.246, longitudinal: 0.102 },
  },
  m: {
    tronco: { sagital: 0.307, transverso: 0.292, longitudinal: 0.147 },
    muslo: { sagital: 0.369, transverso: 0.364, longitudinal: 0.162 },
  },
}

export interface RangoDeRadio {
  /** Fracción del largo del segmento. */
  min: number
  max: number
  origen: 'secundaria_sin_cotejar' | 'cota_geometrica'
}

/** El rango del radio de giro (fracción del largo) para el giro en el plano sagital. */
export function rangoDeRadio(sexo: Sexo, segmento: SegmentoConInercia): RangoDeRadio {
  const leido = RADIOS_DE_GIRO_SECUNDARIOS[sexo][segmento]
  if (leido) {
    return {
      min: Math.min(leido.sagital, leido.transverso),
      max: Math.max(leido.sagital, leido.transverso),
      origen: 'secundaria_sin_cotejar',
    }
  }
  const cm = segmento === 'cabeza' ? DE_LEVA_CERV[sexo].cabeza.cm : segmento === 'tronco' ? DE_LEVA_CERV[sexo].tronco.cm : DE_LEVA[sexo].segmentos[segmento].cm
  return { min: 0, max: Math.max(cm, 1 - cm), origen: 'cota_geometrica' }
}

/** Momento de inercia respecto del centro de masas, en kg·m², de UN segmento (masa y largo ya de la persona). */
export function momentoDeInercia(radio: number, masaKg: number, largoM: number): number {
  return masaKg * (radio * largoM) ** 2
}
