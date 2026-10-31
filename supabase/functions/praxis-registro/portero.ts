import { fichasNecesarias, leerPortero, respuestaDeConsulta, type FichaParaPraxis, type LecturaPortero, type RespuestaDeConsulta } from '../../../src/domain/praxis/consultas/portero.ts'
import type { Propuesta } from '../../../src/domain/praxis/registro/index.ts'

const TIMEOUT_PORTERO_MS = 4000

/** Qué pasó con la consulta (I2 de REVISION-CALIDAD-PRAXIS-BETTATECH): las caídas a «lo de antes» no deben ser silenciosas. */
export type ResultadoPortero = 'atender' | 'aclarar' | 'ninguna' | 'sin_ficha_contestable' | 'ilegible' | 'sin_secretos' | `http_${number}` | `error_${string}`

interface EntornoPortero {
  entorno: { PORTERO_URL?: string; PORTERO_CLAVE?: string }
  fetch: typeof fetch
}

/**
 * Pregunta al portero qué ficha contesta la consulta y arma la respuesta con `fichas_respuesta` (leída con el
 * JWT de la persona: solo las publicadas). Cualquier fallo (sin secretos, portero apagado, tiempo, ficha de
 * salud) deja la consulta como antes. Siempre deja UNA línea de registro con el resultado; nunca la frase.
 */
export async function consultarAlPortero(d: EntornoPortero, frase: string, leerFichas: (ruta: string) => Promise<FichaParaPraxis[] | null>) {
  let leida: LecturaPortero | null = null
  const fin = (resultado: ResultadoPortero, contestada: RespuestaDeConsulta | null = null) => {
    console.log('praxis-registro: portero', resultado)
    return { resultado, contestada, lectura: leida }
  }
  const { PORTERO_URL: url, PORTERO_CLAVE: clave } = d.entorno
  if (!url || !clave) return fin('sin_secretos')
  try {
    const r = await d.fetch(`${url.replace(/\/+$/, '')}/enrutar`, {
      method: 'POST',
      headers: { 'x-clave': clave, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_PORTERO_MS),
      body: JSON.stringify({ texto: frase }),
    })
    if (!r.ok) return fin(`http_${r.status}`)
    const lectura = leerPortero(await r.json().catch(() => null))
    if (!lectura) return fin('ilegible')
    leida = lectura
    const ids = fichasNecesarias(lectura)
    if (ids.length === 0) return fin('ninguna')
    const filas = await leerFichas(`fichas_respuesta?id=in.(${ids.join(',')})&select=id,titulo,bandera_salud,cuerpo`)
    const contestada = respuestaDeConsulta(lectura, new Map((filas ?? []).map((f) => [f.id, f])))
    return contestada ? fin(lectura.decision, contestada) : fin('sin_ficha_contestable')
  } catch (e) {
    return fin(`error_${e instanceof Error ? e.name : 'desconocido'}`)
  }
}

/** La respuesta del portero cuando Claude no respondió: tiene la misma forma que una consulta contestada. */
export function propuestaDeRespaldo(c: RespuestaDeConsulta): Propuesta {
  return { accion: 'nada', motivo: 'consulta', registros: [], descartado: [], notas_coach: [c.nota], citas_invalidas: [], respuesta: c.respuesta } as Propuesta
}
