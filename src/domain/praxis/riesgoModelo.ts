// Rutas con «.ts»: este módulo lo importa también la Edge Function `praxis-registro` (Deno).
import type { MarcaDeRiesgo } from './riesgo.ts'
import { PROMPT_RIESGO, SHA16_PROMPT_RIESGO } from './riesgoModeloPrompt.ts'

export { PROMPT_RIESGO, SHA16_PROMPT_RIESGO }

/**
 * El lector de riesgo con modelo de Praxis: la segunda mitad de «diccionario + modelo en cada
 * mensaje», la decisión firmada por Bryan el 29-sep.
 *
 * El diccionario (`riesgo.ts`) sigue corriendo primero y en la pantalla. En el servidor, a cada
 * frase que el diccionario deja pasar, Haiku la lee con un prompt propio y corto. A las que el
 * diccionario SÍ marca como cuidado o salud también se les consulta, con el interruptor de
 * `masGrave.ts` encendido (hoy apagado), y sale la más grave de las dos; a las Quieta no. El prompt es copia byte a byte del que se midió en
 * `lenguaje/herramientas/prompt_riesgo_modelo.md` (su sha va en `riesgoModeloPrompt.ts` y lo
 * comprueba un test).
 *
 * LO QUE SE MIDIÓ, y no se disimula (recibos en `lenguaje/bateria/recibos/`): en el examen
 * reservado del 2-oct, que no había visto, el diccionario solo llegó al 47 % de las frases de
 * riesgo y diccionario + modelo al 76,5 %, con 2,9 % de falsos positivos. El piso es 100 %.
 * Por eso Praxis sigue cerrada a asesorados: esto sube la protección, no la completa. La versión
 * que corre aquí es la 5 (sha 9c27e300…): da 100 % y 0,9 % de falsos positivos en las 184 frases
 * firmadas, pero esas ya se vieron al corregirla. Su examen honesto es uno sellado nuevo
 * (escrito por Gemini y firmado por Bryan) antes de abrir nada.
 */
export const NIVELES_MODELO = [
  'URGENTE_FISICO', 'RIESGO_VIDA', 'RIESGO_VIOLENCIA', 'RIESGO_MENOR',
  'AMBIGUO_VIDA', 'PREGUNTAR_ANTES_DE_ENTRENAR', 'DERIVAR', 'NINGUNO',
] as const
export type NivelModelo = (typeof NIVELES_MODELO)[number]

export interface LecturaModelo {
  nivel: NivelModelo
  cita: string
}

/**
 * Lee la respuesta del modelo. Devuelve null si no es un JSON con un nivel conocido: quien llama
 * NO sigue sin cribado (la función responde «inténtalo de nuevo»), nunca la toma por NINGUNO.
 */
export function leerSalidaRiesgo(texto: string): LecturaModelo | null {
  const m = /\{[\s\S]*\}/.exec(texto)
  if (!m) return null
  let j: unknown
  try {
    j = JSON.parse(m[0])
  } catch {
    return null
  }
  if (!j || typeof j !== 'object') return null
  const { nivel, cita } = j as { nivel?: unknown; cita?: unknown }
  if (typeof nivel !== 'string' || !(NIVELES_MODELO as readonly string[]).includes(nivel)) return null
  return { nivel: nivel as NivelModelo, cita: typeof cita === 'string' ? cita.slice(0, 200) : '' }
}

/**
 * De nivel del modelo a la marca que ya entiende la pantalla.
 *   URGENTE_FISICO y RIESGO_VIDA → Quieta con las líneas 123 y 106 (como el ACV de `riesgo.ts`);
 *   RIESGO_VIOLENCIA → Quieta con la 155; RIESGO_MENOR → Quieta con la 141;
 *   AMBIGUO_VIDA → la pregunta de cuidado;
 *   PREGUNTAR_ANTES_DE_ENTRENAR y DERIVAR → salud (no se guarda como dato, se sugiere el
 *   profesional y se avisa al coach). PROVISIONAL: la pregunta propia de «antes de entrenar»
 *   (decisión de Bryan del 2-oct) todavía no tiene pantalla; mientras tanto va por salud, que
 *   protege y NUNCA le pregunta a alguien con un pie aplastado si piensa hacerse daño.
 */
export function marcaDesdeModelo(nivel: NivelModelo): MarcaDeRiesgo | null {
  switch (nivel) {
    case 'URGENTE_FISICO':
    case 'RIESGO_VIDA':
      return { tipo: 'quieta', linea: 'vida' }
    case 'RIESGO_VIOLENCIA':
      return { tipo: 'quieta', linea: 'pareja' }
    case 'RIESGO_MENOR':
      return { tipo: 'quieta', linea: 'nino' }
    case 'AMBIGUO_VIDA':
      return { tipo: 'cuidado' }
    case 'PREGUNTAR_ANTES_DE_ENTRENAR':
    case 'DERIVAR':
      return { tipo: 'salud', filtro: 'sintoma' }
    default:
      return null
  }
}
