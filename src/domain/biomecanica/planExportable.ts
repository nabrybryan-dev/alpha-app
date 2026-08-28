/**
 * El plan de medida con la forma exacta que come el encoder de cámara.
 *
 * `planDeMedida` devuelve la ficha entera: la tabla completa de cada eje, el
 * perfil del implemento, los textos para la pantalla. El encoder no necesita
 * casi nada de eso — necesita saber **qué ejes calcular, contra qué línea, y
 * qué no puede prometer**— y lo que sobra en una costura entre dos repos no es
 * inocente: cada campo de más es un campo que alguien puede leer allí y que
 * aquí cambia sin avisar.
 *
 * Esta proyección vive en el dominio, y no dentro del script que la imprime,
 * porque hay **dos** consumidores: `scripts/exportar-plan.mjs`, que la escribe
 * para mirarla o guardarla, y `scripts/medir-palancas.mjs`, que se la pasa al
 * encoder sin que nadie la vea. Escribirla dos veces es cómo dos salidas que
 * tienen que ser idénticas dejan de serlo.
 *
 * La frontera con el encoder es de DATOS, no de código: allí es JavaScript en
 * otro repositorio y no importa nada de aquí. Lo que cruza es este JSON.
 */

import type { Grupo } from '../taxonomia'
import { planDeMedida } from './palancas'
import type { Accion, Articulacion, Protagonismo, Vista } from './tipos'

/** Lo que el encoder mira de cada eje. La ficha completa se queda en la app. */
export interface EjeExportable {
  articulacion: Articulacion
  protagonismo: Protagonismo
  accion: Accion
  motores: readonly Grupo[]
  /** El músculo, cuando no tiene grupo en el PANEL: muñeca y dorsiflexión. */
  motorSinGrupo?: string
  brazoInternoMm: readonly [number, number]
  regla?: { tipo: 'neutralizar' | 'congelar'; regla: string; toleranciaMm: number }
}

export interface PlanExportable {
  categoria: string
  nombre: string
  grupoObjetivo?: Grupo
  ejeObjetivo?: Articulacion
  ejes: readonly EjeExportable[]
  marcas: readonly Articulacion[]
  linea: { origen: string; nota?: string }
  vista: Vista
  alineacion: { regla: string; toleranciaMm: number; porQue: string }
  implemento?: string
  unilateral: boolean
  brazoPorDistanciaHorizontal: boolean
  necesitaRepartoDeApoyos: boolean
  /** Lo que con este patrón y este implemento NO se puede prometer. */
  limites: readonly string[]
  fueraDeVista: readonly string[]
}

/**
 * El plan de un ejercicio listo para cruzar la frontera, o `undefined` si su
 * patrón no tiene palanca que medir.
 *
 * `undefined` es una respuesta, no un fallo: hay patrones sin modelo a
 * propósito —PREV/REHAB, acondicionamiento, movilidad— y devolver un plan por
 * defecto ahí sería exactamente cómo el encoder acabaría midiendo una
 * movilidad de hombro con el modelo del press.
 */
export function planExportable(categoria: string, nombre = ''): PlanExportable | undefined {
  const plan = planDeMedida(categoria, nombre)
  if (!plan) return undefined

  return {
    categoria,
    nombre,
    grupoObjetivo: plan.grupoObjetivo,
    ejeObjetivo: plan.ejeObjetivo,
    ejes: plan.ejes.map((e) => ({
      articulacion: e.articulacion,
      protagonismo: e.protagonismo,
      accion: e.accion,
      motores: e.motores,
      motorSinGrupo: e.motorSinGrupo,
      brazoInternoMm: e.brazoInternoMm,
      regla: e.regla
        ? { tipo: e.regla.tipo, regla: e.regla.regla, toleranciaMm: e.regla.toleranciaMm }
        : undefined,
    })),
    marcas: plan.marcas,
    linea: plan.linea,
    vista: plan.vista,
    alineacion: plan.alineacion,
    implemento: plan.implemento,
    unilateral: plan.unilateral,
    brazoPorDistanciaHorizontal: plan.brazoPorDistanciaHorizontal,
    necesitaRepartoDeApoyos: plan.necesitaRepartoDeApoyos,
    limites: plan.limites,
    fueraDeVista: plan.fueraDeVista,
  }
}
