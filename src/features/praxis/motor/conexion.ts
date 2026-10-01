import type { RespuestaDeGuardar, RespuestaDelRegistrador } from '../../../domain/praxis/conversacion'
import type { LoQuePraxisVe } from '../../../domain/praxis/plan/listaBlanca'
import type { QueFalto } from '../../../domain/praxis/plan/responder'
import type { RegistroPropuesto } from '../../../domain/praxis/registro/tipos'
import type { PreguntaConRespuesta, ResultadoDejarPregunta } from '../../../data/praxis/preguntasEnEspera'

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
  /** Hoy en hora local, `YYYY-MM-DD`. */
  hoy: string
  /** Lo que Praxis ve de la persona, YA filtrado por la lista blanca. Se relee en cada turno. */
  leer: () => LoQuePraxisVe
  /** Pide una propuesta al registrador. No guarda. */
  proponer: (frase: string, mensajeId: string) => Promise<RespuestaDelRegistrador>
  /** Guarda lo que la persona confirmó con un toque. */
  guardar: (p: { mensajeId: string; registros: RegistroPropuesto[]; confirmaSesion: boolean }) => Promise<RespuestaDeGuardar>
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
