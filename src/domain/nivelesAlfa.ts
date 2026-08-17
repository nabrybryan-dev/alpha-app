import {
  LANDMARK_MEV,
  type DatosRuta,
  type RequisitoNivel,
} from './rutaEntrenamiento'

/**
 * Qué hace falta para subir a cada peldaño de la Escala Alfa.
 *
 * Hasta ahora los requisitos eran los MISMOS para todos los peldaños: subir de
 * 01 a 02 pedía exactamente lo mismo que subir de 07 a 08. Aquí cada salto tiene
 * su listón, y aparecen ejes nuevos cuando la etapa del método los pide.
 *
 * Validado contra `wiki/conocimiento/clasificacion-nivel-y-educacion.md`.
 */

export const PELDANO_MAXIMO = 7

/**
 * Suelo del error de RIR que se puede exigir.
 *
 * La literatura sitúa el error de un lifter experimentado en 1–2 repeticiones y
 * el de un novato en 4–5. Pedir menos de esto no mide dominio, mide suerte: el
 * requisito anterior —desviación < 0,5— estaba por debajo de la precisión humana
 * documentada y no lo cruzaba nadie.
 */
export const ERROR_RIR_MINIMO = 0.8

/**
 * Tope de volumen exigible. Vivir en MRV (~22 series) es justo lo que el motor
 * manda descargar, así que pedirlo como requisito empujaría contra la propia
 * regla del método.
 */
const SERIES_MAXIMO_EXIGIBLE = 20

export interface UmbralPeldano {
  consistenciaPct: number
  /** Sin definir en el primer salto: a un novato el error grande le es normal. */
  errorRirMaximo?: number
  seriesPorGrupo: number
  /** Proporción de ejercicios que suben su 1RM estimado. Sin definir = no se pide. */
  fuerzaAlAlza?: number
  tecnicaPct: number
}

/** Clave = peldaño de DESTINO. Para llegar al 03 hay que cumplir `UMBRALES[3]`. */
export const UMBRALES: Record<number, UmbralPeldano> = {
  2: { consistenciaPct: 60, seriesPorGrupo: 8, tecnicaPct: 40 },
  3: { consistenciaPct: 75, errorRirMaximo: 2.0, seriesPorGrupo: 12, fuerzaAlAlza: 0.3, tecnicaPct: 55 },
  4: { consistenciaPct: 85, errorRirMaximo: 1.5, seriesPorGrupo: 16, fuerzaAlAlza: 0.5, tecnicaPct: 70 },
  5: { consistenciaPct: 90, errorRirMaximo: 1.2, seriesPorGrupo: 18, fuerzaAlAlza: 0.5, tecnicaPct: 80 },
  6: { consistenciaPct: 92, errorRirMaximo: 1.0, seriesPorGrupo: SERIES_MAXIMO_EXIGIBLE, fuerzaAlAlza: 0.6, tecnicaPct: 85 },
  7: { consistenciaPct: 95, errorRirMaximo: ERROR_RIR_MINIMO, seriesPorGrupo: SERIES_MAXIMO_EXIGIBLE, fuerzaAlAlza: 0.6, tecnicaPct: 90 },
}

/** Desde qué peldaño de destino se empieza a pedir cada eje propio de la etapa. */
const DESDE_AUTORREGULACION = 4
const DESDE_DESCARGA = 6
const DESDE_ESTABILIDAD = 7

const GRUPOS_PRIORITARIOS = 3

function medianaDeGruposPrioritarios(seriesPorGrupo: readonly number[]): number | undefined {
  const top = [...seriesPorGrupo].sort((a, b) => b - a).slice(0, GRUPOS_PRIORITARIOS)
  if (top.length === 0) return undefined
  const medio = Math.floor(top.length / 2)
  return top.length % 2 === 0 ? (top[medio - 1] + top[medio]) / 2 : top[medio]
}

function pctSesiones(datos: DatosRuta): number | undefined {
  if (datos.sesionesTotales === 0) return undefined
  return Math.round((datos.sesionesRegistradas / datos.sesionesTotales) * 100)
}

const coma = (n: number) => n.toString().replace('.', ',')

/**
 * Los requisitos para llegar a `destino`, ya situados con los datos de la
 * persona. El criterio define el peldaño; dónde va cada uno sale de su registro.
 */
export function requisitosParaPeldano(destino: number, datos: DatosRuta): RequisitoNivel[] {
  const umbral = UMBRALES[destino]
  if (!umbral) return []

  const requisitos: RequisitoNivel[] = []
  const consistencia = pctSesiones(datos)
  const series = medianaDeGruposPrioritarios(datos.seriesPorGrupo)
  const desvio = datos.desviacionRir === undefined ? undefined : Math.abs(datos.desviacionRir)

  requisitos.push({
    id: 'consistencia',
    cumplido: consistencia !== undefined && consistencia >= umbral.consistenciaPct,
    texto: `Registrar al menos el ${umbral.consistenciaPct}% de las sesiones que te pauta el coach`,
    metrica:
      consistencia === undefined
        ? 'Sin sesiones pautadas todavía'
        : `${datos.sesionesRegistradas} / ${datos.sesionesTotales} sesiones · ${consistencia}%`,
  })

  if (umbral.errorRirMaximo !== undefined) {
    requisitos.push({
      id: 'error-rir',
      cumplido: desvio !== undefined && desvio <= umbral.errorRirMaximo,
      texto: `Estimar tu RIR con una desviación media de ${coma(umbral.errorRirMaximo)} o menos`,
      metrica:
        desvio === undefined
          ? 'Aún sin series registradas para medirlo'
          : `${coma(desvio)} de desviación media`,
    })
  }

  requisitos.push({
    id: 'volumen',
    cumplido: series !== undefined && series >= umbral.seriesPorGrupo,
    texto: `Sostener ${umbral.seriesPorGrupo} series por grupo en tus grupos prioritarios, sin perder rendimiento`,
    metrica:
      series === undefined
        ? 'Sin volumen pautado todavía'
        : `Mediana de ${series} series · objetivo ${umbral.seriesPorGrupo} (MEV ≈${LANDMARK_MEV})`,
  })

  if (umbral.fuerzaAlAlza !== undefined) {
    const fuerza = datos.progresoFuerza
    const proporcion =
      fuerza && fuerza.comparados > 0 ? fuerza.mejoraron / fuerza.comparados : undefined
    requisitos.push({
      id: 'fuerza',
      cumplido: proporcion !== undefined && proporcion >= umbral.fuerzaAlAlza,
      texto: `Que al menos ${Math.round(umbral.fuerzaAlAlza * 100)}% de tus ejercicios suba su 1RM estimado`,
      metrica:
        fuerza && fuerza.comparados > 0
          ? `${fuerza.mejoraron} / ${fuerza.comparados} al alza vs M${fuerza.microcicloPrevio}`
          : 'Aún sin dos microciclos con series para comparar',
    })
  }

  // La compuerta humana del ascenso automático: la app no ve ejecución.
  requisitos.push({
    id: 'tecnica',
    cumplido: (datos.tecnicaPct ?? 0) >= umbral.tecnicaPct,
    texto: 'Ejecutar tus patrones con la soltura que pide este nivel',
    metrica:
      datos.tecnicaPct === undefined
        ? 'Lo valora tu coach viendo tu ejecución'
        : `${datos.tecnicaPct} / ${umbral.tecnicaPct} según tu coach`,
  })

  if (destino >= DESDE_AUTORREGULACION) {
    requisitos.push({
      id: 'autorregulacion-real',
      cumplido: datos.autorregulaConReadiness === true,
      texto: 'Bajar la carga los días que entras cansado, en vez de sostenerla igual',
      metrica: datos.autorregulaConReadiness ? 'Lo estás haciendo' : 'Todavía no se ve en tus registros',
    })
  }

  if (destino >= DESDE_DESCARGA) {
    requisitos.push({
      id: 'descarga',
      cumplido: datos.respondeADescarga === true,
      texto: 'Que tu fuerza suba después de una descarga, no solo que aguantes',
      metrica: datos.respondeADescarga ? 'Tu 1RM estimado subió tras la descarga' : 'Sin descarga con datos para compararla',
    })
  }

  if (destino >= DESDE_ESTABILIDAD) {
    requisitos.push({
      id: 'estabilidad',
      cumplido: datos.estableEntreBloques === true,
      texto: 'Sostener todo lo anterior dos bloques seguidos, no una buena racha',
      metrica: datos.estableEntreBloques ? 'Dos bloques sostenidos' : 'Aún sin dos bloques seguidos',
    })
  }

  return requisitos
}

function cumpleTodo(destino: number, datos: DatosRuta): boolean {
  const requisitos = requisitosParaPeldano(destino, datos)
  return requisitos.length > 0 && requisitos.every((r) => r.cumplido)
}

/**
 * El peldaño más alto cuyos requisitos ya cumple. Se usa al asignar el nivel por
 * primera vez: nadie arranca en el 03 porque sí, que es lo que pasaba antes.
 */
export function peldanoAlcanzado(datos: DatosRuta): number {
  let alcanzado = 1
  for (let destino = 2; destino <= PELDANO_MAXIMO; destino += 1) {
    if (!cumpleTodo(destino, datos)) break
    alcanzado = destino
  }
  return alcanzado
}

/**
 * El peldaño después de cerrar un microciclo.
 *
 * Sube de uno en uno: subir tres de golpe no es una celebración, es un error de
 * datos. Y no baja nunca —un mes malo no borra lo que la persona llegó a
 * dominar, y bajarla castigaría justo cuando más necesita quedarse, que choca
 * con la adherencia—.
 */
export function peldanoTrasMicrociclo(actual: number, datos: DatosRuta): number {
  if (actual >= PELDANO_MAXIMO) return PELDANO_MAXIMO
  return cumpleTodo(actual + 1, datos) ? actual + 1 : actual
}
