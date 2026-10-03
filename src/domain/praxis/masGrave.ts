// Rutas con «.ts»: este módulo lo importa también la Edge Function `praxis-registro` (Deno).
import type { LineaDeAyuda, MarcaDeRiesgo } from './riesgo.ts'

/**
 * «Gana la lectura más grave», de verdad (Bryan, 3-oct: «Sí, arréglalo ya»).
 *
 * Hay dos lectores de riesgo: el filtro por reglas (`filtroDeRiesgo`, en la pantalla y en el
 * servidor) y el lector con modelo (`riesgoModelo.ts`, solo en el servidor). De menos a más grave:
 *
 *     salud (1)  <  cuidado (2)  <  Quieta (3)
 *
 * Antes, si el filtro marcaba CUALQUIER cosa (aunque fuera «salud») se respondía con eso y al
 * modelo no se le preguntaba: «se me hinchó la lengua y me cuesta respirar» quedaba en «salud»
 * aunque el modelo la leyera como urgencia.
 *
 * Ahora:
 *   - filtro en Quieta → no cambia nada: ya es el máximo, el modelo no se consulta y la pantalla
 *     de emergencia no se retrasa;
 *   - filtro en cuidado o salud → se consulta TAMBIÉN al modelo y se responde con la más grave;
 *   - el modelo solo puede SUBIR la marca: nunca la baja ni la quita;
 *   - si el modelo falla, tarda, devuelve algo ilegible o no se puede consultar, se queda la
 *     marca del filtro (nunca un silencio, nunca una marca menor);
 *   - si la más grave es la del modelo, la línea de ayuda es la de lo que leyó el MODELO.
 *
 * INTERRUPTOR DE CONSENTIMIENTO: lo que dice hoy la pantalla de privacidad es lo contrario
 * («lo que suena a riesgo o a salud no sale de este teléfono: no llega a ese servicio»). Mientras
 * Bryan no decida cambiar ese texto, la pantalla NO manda la frase marcada (`LECTURA_DEL_MODELO_SOBRE_MARCADAS`).
 */
export const LECTURA_DEL_MODELO_SOBRE_MARCADAS = false

const GRAVEDAD: Record<MarcaDeRiesgo['tipo'], number> = { salud: 1, cuidado: 2, quieta: 3 }

export function gravedad(m: MarcaDeRiesgo | null): number {
  return m ? GRAVEDAD[m.tipo] : 0
}

/** ¿Hay que preguntarle también al modelo? Solo con el interruptor encendido y una marca MENOR que Quieta. */
export function hayQueConsultarAlModelo(filtro: MarcaDeRiesgo | null, encendido: boolean): filtro is Exclude<MarcaDeRiesgo, { tipo: 'quieta' }> {
  return encendido && filtro !== null && filtro.tipo !== 'quieta'
}

/**
 * La más grave de las dos. El modelo gana solo si es ESTRICTAMENTE más grave: en un empate se
 * conserva la del filtro (con su detalle propio, p. ej. de qué clase de salud). Sin marca del
 * filtro no se inventa una desde aquí: el modelo no puede bajar, y tampoco aparece de la nada.
 */
export function masGrave(filtro: MarcaDeRiesgo, modelo: MarcaDeRiesgo | null): MarcaDeRiesgo {
  return gravedad(modelo) > gravedad(filtro) ? (modelo as MarcaDeRiesgo) : filtro
}

const LINEAS: readonly LineaDeAyuda[] = ['vida', 'pareja', 'nino']

/** Lee la marca que devuelve la función para `releer_riesgo`. Cualquier otra forma → null (no se usa). */
export function leerMarcaDelServidor(datos: unknown): MarcaDeRiesgo | null {
  if (!datos || typeof datos !== 'object') return null
  const m = (datos as { marca?: unknown }).marca
  if (!m || typeof m !== 'object') return null
  const { tipo, linea } = m as { tipo?: unknown; linea?: unknown }
  if (tipo === 'quieta' && typeof linea === 'string' && (LINEAS as readonly string[]).includes(linea)) return { tipo: 'quieta', linea: linea as LineaDeAyuda }
  if (tipo === 'cuidado') return { tipo: 'cuidado' }
  if (tipo === 'salud') return { tipo: 'salud', filtro: 'sintoma' }
  return null
}
