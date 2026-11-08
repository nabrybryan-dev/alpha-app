import type { RespuestaDeGuardar, RespuestaDelRegistrador } from '../../../domain/praxis/conversacion'
import type { LoQuePraxisVe } from '../../../domain/praxis/plan/listaBlanca'
import type { QueFalto } from '../../../domain/praxis/plan/responder'
import type { ContextoCharla } from '../../../domain/praxis/charla/modelo'
import type { MarcaDeRiesgo } from '../../../domain/praxis/riesgo'
import type { RegistroPropuesto } from '../../../domain/praxis/registro/tipos'
import type { RespuestaDeElegir } from '../../../data/praxis/deshacer'
import type { ResultadoDeshacer, TarjetaFirmada } from '../../../domain/praxis/deshacer/pantalla'
import type { PreguntaConRespuesta, ResultadoDejarPregunta } from '../../../data/praxis/preguntasEnEspera'
import type { ResultadoAnotar, ResultadoGuardarCheckin } from '../../../data/praxis/checkin'
import type { Anotacion } from '../../../domain/praxis/registro/anotaciones'
import type { FormaAprendida } from '../../../domain/praxis/registro/lexicoPersona'
import type { CampoCheckin } from '../../../domain/praxis/registro/mensajeLargo'
import type { Confirmado } from '../../../domain/praxis/registro/tarjetaCheckin'

/**
 * La conexión de la escena con los datos y el cerebro reales.
 *
 * El motor no habla con la base ni con la red: recibe estas funciones al montarse
 * (`PraxisPage` las arma con la capa de datos) y las llama. Así la escena se prueba con
 * dobles, y la regla del repo se cumple: la pantalla no habla con Supabase directamente.
 *
 * Sin conexión, la escena es la de EJEMPLO de la maqueta: solo la montan las pruebas.
 */
export interface ConexionPraxis {
  usuarioId: string
  /** El nombre de pila, si existe: Praxis lo usa de vez en cuando al charlar. */
  nombre?: string | null
  /** Hoy en hora local, `YYYY-MM-DD`. */
  hoy: string
  /** Lo que Praxis ve de la persona, YA filtrado por la lista blanca. Se relee en cada turno. */
  leer: () => LoQuePraxisVe
  /**
   * Pide una propuesta al registrador. No guarda. `contexto.pantallaEjercicioId` es el
   * ejercicio que la persona eligió con un toque cuando Praxis preguntó cuál fue: el
   * registrador lo usa para no volver a preguntar.
   */
  proponer: (frase: string, mensajeId: string, contexto?: { pantallaEjercicioId?: string; charla?: ContextoCharla; memoria?: { charlaId: string; turno: number } }) => Promise<RespuestaDelRegistrador>
  /**
   * «Gana la lectura más grave»: relee con el modelo una frase que el filtro marcó como cuidado o salud y devuelve la marca
   * más grave (o `null`). AUSENTE = el interruptor de consentimiento está apagado y la frase marcada NO sale del teléfono.
   * Nunca lanza.
   */
  releerRiesgo?: (frase: string) => Promise<MarcaDeRiesgo | null>
  /** Guarda lo que la persona confirmó con un toque. */
  guardar: (p: { mensajeId: string; registros: RegistroPropuesto[]; confirmaSesion: boolean }) => Promise<RespuestaDeGuardar>
  /**
   * «Deshacer» (apagado en el servidor con `PRAXIS_LIBRO`): `elegir` pide la tarjeta de UN candidato; `confirmar` quita, y solo se
   * llama tras el toque en «Sí, quitar». AUSENTE = la pantalla no puede quitar nada. Nunca lanzan.
   */
  deshacer?: {
    elegir: (registroId: string) => Promise<RespuestaDeElegir>
    confirmar: (p: { tarjeta: TarjetaFirmada; mensajeId: string }) => Promise<ResultadoDeshacer>
  }
  /**
   * El check-in desde lo que la persona cuenta (conectores; `CONECTORES_EN_TARJETA`). AUSENTE = apagado: la frase sigue el
   * camino de siempre. `yaHoy` = cuáles de los 8 ya están llenos hoy; `lexico` = lo aprendido de quien tiene la sesión;
   * `guardar` solo se llama tras el toque en «Anotar». Nunca lanzan.
   */
  checkin?: {
    yaHoy: () => CampoCheckin[]
    lexico: () => Promise<FormaAprendida[]>
    guardar: (p: { mensajeId: string; confirmado: Confirmado; aprendizajes: { campo: CampoCheckin; forma: string; valor: string }[] }) => Promise<ResultadoGuardarCheckin>
    /** Cuaderno de la persona (0176). AUSENTE = la tarjeta no ofrece anotaciones. Solo tras su toque. */
    anotar?: (p: { mensajeId: string; anotaciones: Anotacion[] }) => Promise<ResultadoAnotar>
  }
  /** Deja una «pregunta en espera». Solo se llama con el «sí» de la persona. */
  preguntar: (p: { frase: string; queFalto: QueFalto; citas: string[] }) => Promise<ResultadoDejarPregunta>
  /** Las preguntas en espera de la persona: las abiertas y las ya respondidas. */
  preguntas: () => Promise<PreguntaConRespuesta[]>
  /** Lleva al formulario de siempre. `null` si esta persona no tiene formulario (el coach no llena check-in). */
  irAlFormulario: (() => void) | null
}

let actual: ConexionPraxis | null = null

export function fijarConexion(c: ConexionPraxis | null): void { actual = c }
export function conexion(): ConexionPraxis | null { return actual }
export function conectada(): boolean { return actual !== null }
