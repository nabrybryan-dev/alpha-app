/**
 * Investigación de mercadeo, de lo macro a lo concreto (pedido de Bryan, 30-sep).
 *
 * Manuela se forma en mercadeo y algoritmos; necesita ver lo que investiga el agente. Hay cuatro
 * temas: tendencias, videos, ganchos y diseños visuales. Los datos salen de la sección «mercadeo»
 * del tablero (`admin_tablero`, migración 0102), sin tabla nueva: una FILA pertenece a un tema si
 * su `id` empieza por el prefijo del tema (`tendencias-…`, `videos-…`, `ganchos-…`, `disenos-…`).
 * Ese prefijo es un acuerdo con quien carga el tablero; hasta que exista, cada tema sale FALTA.
 *
 * Regla de oro: sin dato o sin fuente, gris y «FALTA» con quién lo trae. Nunca un cero, un verde
 * ni un texto inventado. «No se pudo leer» y «sin datos» se dicen distinto.
 *
 * Sin React, sin red, sin fecha del sistema.
 */
import { nombreDueno, type FilaDetalle, type SeccionLeida } from './adminTablero'

export const TEMAS_INVESTIGACION = ['tendencias', 'videos', 'ganchos', 'disenos'] as const
export type TemaInvestigacion = (typeof TEMAS_INVESTIGACION)[number]

/** Nombre de la tarjeta, lo que explica y quién trae el dato, en el orden de lo general a lo concreto. */
export const TEMA_INVESTIGACION: Record<TemaInvestigacion, { nombre: string; frase: string; falta: string }> = {
  tendencias: {
    nombre: 'Tendencias',
    frase: 'Qué está subiendo ahora en redes.',
    falta: 'las tendencias que investiga el agente de mercadeo; las carga Bryan en el resumen de mercadeo',
  },
  videos: {
    nombre: 'Videos: estructura, loops y cortes',
    frase: 'Cómo se arman los videos que funcionan: su estructura, sus loops y sus cortes.',
    falta: 'el análisis de videos del agente de mercadeo; lo carga Bryan en el resumen de mercadeo',
  },
  ganchos: {
    nombre: 'Ganchos usados (hooks)',
    frase: 'Los ganchos de texto y los ganchos visuales que se están usando.',
    falta: 'los ganchos que encontró el agente de mercadeo; los carga Bryan en el resumen de mercadeo',
  },
  disenos: {
    nombre: 'Diseños visuales',
    frase: 'Referencias visuales y qué de ellas funciona.',
    falta: 'las referencias de diseño que reúne el agente de mercadeo; las carga Bryan en el resumen de mercadeo',
  },
}

/** Los estados que puede tener un hallazgo. La tabla de hoy no trae este dato, así que hoy sale FALTA. */
export const ESTADOS_HALLAZGO = ['pendiente', 'en_proceso', 'resultado', 'fallo'] as const
export type EstadoHallazgo = (typeof ESTADOS_HALLAZGO)[number]
export const NOMBRE_ESTADO_HALLAZGO: Record<EstadoHallazgo, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  resultado: 'Resultado',
  fallo: 'Fallo',
}

/** Un hallazgo listo para pintar. Lo que no viene en la fila queda `null` y la pantalla dice FALTA. */
export interface Hallazgo {
  id: string
  frase: string
  /** Qué archivo lo escribió, o `null` si la fila no lo dice. */
  fuente: string | null
  fecha: string | null
  estado: EstadoHallazgo | null
  dueno: string
}

/** Cómo quedó un tema: lo que la pantalla puede decir, una sola cosa a la vez. */
export type TarjetaInvestigacion =
  | { tema: TemaInvestigacion; estado: 'pendiente_de_activar' }
  | { tema: TemaInvestigacion; estado: 'fallo_de_lectura'; error: string }
  | { tema: TemaInvestigacion; estado: 'dato_no_valido'; motivo: string }
  | { tema: TemaInvestigacion; estado: 'falta'; quien: string }
  | { tema: TemaInvestigacion; estado: 'con_datos'; hallazgos: Hallazgo[] }

/** ¿De qué tema es la fila? Por el prefijo de su id; `null` si no es de ninguno. */
export function temaDeFila(id: string): TemaInvestigacion | null {
  const minuscula = id.trim().toLowerCase()
  return TEMAS_INVESTIGACION.find((t) => minuscula.startsWith(`${t}-`) || minuscula === t) ?? null
}

/** Una fila sin frase no se pinta como hallazgo: sería una tarjeta sin nada que decir. */
export function hallazgoDeFila(fila: FilaDetalle): Hallazgo | null {
  const frase = fila.titulo.trim()
  if (frase === '') return null
  const archivo = fila.fuente.archivo.trim()
  const corte = fila.fuente.corte.trim()
  return {
    id: fila.id,
    frase,
    fuente: archivo === '' ? null : archivo,
    fecha: corte === '' ? null : corte,
    estado: null,
    dueno: nombreDueno(fila.dueno),
  }
}

/**
 * Las cuatro tarjetas, en orden. `lectura`:
 *   · `'pendiente'`  → sin el permiso o sin la tabla (migración 0102),
 *   · `{ error }`    → la lectura falló (se dice como fallo, no como «sin datos»),
 *   · `{ seccion }`  → la sección de mercadeo, o `undefined` si no vino.
 */
export function tarjetasDeInvestigacion(
  lectura: 'pendiente' | { error: string } | { seccion: SeccionLeida | undefined },
): TarjetaInvestigacion[] {
  return TEMAS_INVESTIGACION.map((tema): TarjetaInvestigacion => {
    if (lectura === 'pendiente') return { tema, estado: 'pendiente_de_activar' }
    if ('error' in lectura) return { tema, estado: 'fallo_de_lectura', error: lectura.error }
    const s = lectura.seccion
    const falta: TarjetaInvestigacion = { tema, estado: 'falta', quien: TEMA_INVESTIGACION[tema].falta }
    if (!s || s.estado === 'sin_corte') return falta
    if (s.estado === 'invalida') return { tema, estado: 'dato_no_valido', motivo: s.motivo }
    const hallazgos = s.datos.filas
      .filter((f) => temaDeFila(f.id) === tema)
      .map(hallazgoDeFila)
      .filter((h): h is Hallazgo => h !== null)
    return hallazgos.length === 0 ? falta : { tema, estado: 'con_datos', hallazgos }
  })
}
