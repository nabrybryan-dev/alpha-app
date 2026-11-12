/**
 * CLIENTE de la función `praxis-organizar` (fase O2b). APAGADO por construcción: nada lo llama todavía.
 *
 * Consulta al modelo con menú cerrado SOLO cuando la gramática no entendió. Reglas:
 *  - No se llama si la frase habla de salud o de riesgo (`sePuedeConsultarAlModelo`).
 *  - La sesión va como Bearer; el usuario sale del token, nunca del cuerpo.
 *  - La respuesta se valida con las mismas reglas del lector (verbo del menú, pieza del catálogo de la persona).
 *  - Tiempo máximo 3 s. Ante cualquier error, 401/429/502/503 o salida rara, devuelve `null` y no lanza.
 *  - Lo que lee el modelo lleva `confirmar` en traer (lo pone `decidirConLectura`; aquí no se toca).
 */
import { leerSalidaDeOrganizacion, type LecturaDelModelo } from '../domain/praxis/organizacion/lectorModelo'
import { PIEZAS_DE_HOY, PIEZAS_DE_OTRAS_PANTALLAS, piezasPara } from './catalogoDePiezas'
import {
  decidirConLectura,
  decidirOrganizacion,
  sePuedeConsultarAlModelo,
  type DecisionDeOrganizacion,
  type EstadoDeOrganizacion,
} from './organizacionPraxis'
import type { PerfilAcceso } from './rutas'

export const TIEMPO_MAXIMO_ORGANIZAR_MS = 3000

export interface OpcionesDeConsulta {
  /** Token de la sesión (Bearer). Sin él no se llama. */
  token: string
  /** Base de las funciones, p. ej. `https://xxx.supabase.co/functions/v1`. */
  urlFunciones: string
  fetch: typeof fetch
  /** Perfil de la persona: las piezas válidas son SU catálogo. Sin perfil solo valen las piezas del catálogo fijo. */
  perfil?: PerfilAcceso
  /** Solo para pruebas. */
  tiempoMaximoMs?: number
}

export type ConsultaAlModelo = (frase: string) => Promise<LecturaDelModelo | null>

function idsValidos(perfil: PerfilAcceso | undefined): ReadonlySet<string> {
  const piezas = perfil ? piezasPara(perfil) : [...PIEZAS_DE_HOY, ...PIEZAS_DE_OTRAS_PANTALLAS]
  return new Set(piezas.map((p) => p.id))
}

/** `null` = no se consultó, falló o la salida no sirve. Nunca lanza. */
export async function consultarLecturaDeOrganizacion(frase: string, opciones: OpcionesDeConsulta): Promise<LecturaDelModelo | null> {
  if (!sePuedeConsultarAlModelo(frase)) return null
  if (!opciones.token || !opciones.urlFunciones) return null
  const limite = opciones.tiempoMaximoMs ?? TIEMPO_MAXIMO_ORGANIZAR_MS
  const control = new AbortController()
  let temporizador: ReturnType<typeof setTimeout> | undefined
  const agotado = new Promise<null>((resolver) => {
    temporizador = setTimeout(() => {
      control.abort()
      resolver(null)
    }, limite)
  })
  const consulta = (async (): Promise<LecturaDelModelo | null> => {
    const r = await opciones.fetch(`${opciones.urlFunciones.replace(/\/+$/, '')}/praxis-organizar`, {
      method: 'POST',
      headers: { authorization: `Bearer ${opciones.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ frase }),
      signal: control.signal,
    })
    if (!r.ok) return null
    const cuerpo = (await r.json()) as { lectura?: unknown } | null
    const l = cuerpo?.lectura
    if (typeof l !== 'object' || l === null) return null
    // Mismas reglas del lector: se pasa por `leerSalidaDeOrganizacion` en vez de repetirlas.
    return leerSalidaDeOrganizacion(JSON.stringify(l), idsValidos(opciones.perfil))
  })().catch(() => null)
  try {
    return await Promise.race([consulta, agotado])
  } catch {
    return null
  } finally {
    clearTimeout(temporizador)
  }
}

/**
 * Primero la gramática. Solo si ella da `no_es_organizacion` o `rechaza:no_existe` se pregunta al modelo, y su lectura
 * pasa por `decidirConLectura` (mismos candados). Si el modelo no aporta, se queda la decisión de la gramática.
 */
export async function decidirConGramaticaYModelo(
  frase: string,
  perfil: PerfilAcceso,
  estado: EstadoDeOrganizacion,
  consultar: ConsultaAlModelo,
): Promise<DecisionDeOrganizacion> {
  const deGramatica = decidirOrganizacion(frase, perfil, estado)
  const sinEntender = deGramatica.tipo === 'no_es_organizacion' || (deGramatica.tipo === 'rechaza' && deGramatica.motivo === 'no_existe')
  if (!sinEntender || !sePuedeConsultarAlModelo(frase)) return deGramatica
  const lectura = await consultar(frase).catch(() => null)
  if (!lectura) return deGramatica
  const deModelo = decidirConLectura(lectura, perfil, estado)
  // Un «ninguno» del modelo no borra un rechazo que la gramática sí supo dar.
  return deModelo.tipo === 'no_es_organizacion' ? deGramatica : deModelo
}
