/**
 * El enchufe de la voz natural en la consulta del equipo (etapa B1 del criterio firmado). Todo lo que necesita leer de
 * la base lo lee con el JWT de la persona (RLS) mediante `leer`. Apagado = no lee nada ni llama a nadie.
 *
 * Gana la ficha: si el portero atendió o pidió aclarar, no se hace nada. Si no, y la biblioteca halló un concepto,
 * se leen sus 4 campos de `praxis_conceptos` (solo `aprobada`) y los nombres del equipo y de los asesorados
 * (`usuarios_app.nombre`, para el limpiador), y se llama a `vozDelConcepto`. Nunca lanza.
 */
import type { LecturaPortero } from '../../../../src/domain/praxis/consultas/portero.ts'
import { contadorEnMemoria, vozDelConcepto, type DepsVoz, type EntornoVoz, type ResultadoVoz } from './vozConcepto.ts'

export interface ConsultaParaVoz {
  lectura: LecturaPortero | null
  contestada: unknown | null
  conceptoMejor: { id: string; coseno: number } | null
}

const gastoDeLaInstancia = contadorEnMemoria()

type FilaConcepto = { respuesta?: string; de_que_depende?: unknown; estudios?: string; criterio_de_practica?: string }

/** Los nombres y apellidos sueltos de `usuarios_app` (lista para el limpiador). Si la lectura falla, lista vacía. */
async function nombresConocidos(leer: <T>(ruta: string) => Promise<T | null>): Promise<string[]> {
  const filas = (await leer<{ nombre?: string }[]>('usuarios_app?select=nombre').catch(() => null)) ?? []
  return [...new Set(filas.flatMap((f) => (f.nombre ?? '').split(/\s+/)).filter((n) => n.length >= 2))]
}

/** Las variables de la voz, leídas del entorno de la función. */
export const entornoVoz = (leerVar: (k: string) => string | undefined): Omit<EntornoVoz, 'ANTHROPIC_API_KEY'> => ({
  PRAXIS_REDACTOR: leerVar('PRAXIS_REDACTOR'), DEEPSEEK_API_KEY: leerVar('DEEPSEEK_API_KEY'), PRAXIS_VOZ_AVISO_TOKENS_DIA: leerVar('PRAXIS_VOZ_AVISO_TOKENS_DIA'),
})

/** La redacción aprobada reemplaza la respuesta de hoy; el coach ve de dónde salió. Sin redacción, la propuesta de hoy. */
export function conVoz<P extends { respuesta?: string; notas_coach: string[] }>(resuelta: P, consulta: { voz: ResultadoVoz | null } | null): P {
  const voz = consulta?.voz
  if (!voz?.mostrar) return resuelta
  return { ...resuelta, respuesta: voz.mostrar, notas_coach: [...resuelta.notas_coach, `Praxis redactó desde la biblioteca (${voz.meta.concepto_id}).`] }
}

/** Para `meta`: solo estados y contadores. Apagada, nada. */
export const metaDeVoz = (consulta: { voz: ResultadoVoz | null } | null) => (consulta?.voz ? { voz: consulta.voz.meta } : {})

export async function vozEnLaConsulta(
  d: { entorno: EntornoVoz; fetch: typeof fetch; ahoraMs: () => number },
  leer: <T>(ruta: string) => Promise<T | null>,
  frase: string,
  consulta: ConsultaParaVoz,
  alerta: boolean,
): Promise<ResultadoVoz | null> {
  const modo = d.entorno.PRAXIS_REDACTOR
  if (modo !== 'sombra' && modo !== 'encendido') return null // apagado: ni lee ni registra; la consulta queda como hoy
  try {
    const porteroDecidio = consulta.contestada !== null || consulta.lectura?.decision === 'atender' || consulta.lectura?.decision === 'aclarar'
    const mejor = porteroDecidio ? null : consulta.conceptoMejor
    const filas = mejor ? await leer<FilaConcepto[]>(`praxis_conceptos?id=eq.${encodeURIComponent(mejor.id)}&estado=eq.aprobada&select=respuesta,de_que_depende,estudios,criterio_de_practica`) : null
    const fila = filas?.[0]
    const concepto = mejor && fila ? { id: mejor.id, coseno: mejor.coseno, campos: fila } : null
    const deps: DepsVoz = { ...d, gasto: gastoDeLaInstancia }
    return await vozDelConcepto(deps, { pregunta: frase, porteroDecidio, concepto, alerta, nombresConocidos: concepto ? await nombresConocidos(leer) : [] })
  } catch (e) {
    console.log('praxis-registro: voz error', e instanceof Error ? e.name : 'desconocido')
    return null
  }
}
