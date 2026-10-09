/**
 * Lo que dice la vitrina de `/interesados`: la presentación que ve el seguidor de un
 * creador ANTES del formulario. Diseño: `docs/specs/2026-10-05-vitrina-interesados-diseno.md`.
 *
 * Dos reglas que vigila el test de al lado:
 *   - cada frase de RESPALDO lleva su fuente, y la fuente es revisada por pares;
 *   - ninguna frase promete resultados (es salud: decimos qué hacemos, no qué le va a pasar).
 *
 * La nutrición NO se nombra como parte del servicio hasta que Bryan lo decida (OPERACION §3:
 * sin el profesional de nutrición firmado, el ciclo va sin nutrición individualizada).
 */

export interface Respaldo {
  /** La frase, en palabras de la calle. */
  frase: string
  /** Lo que dice la evidencia, en una línea. */
  detalle: string
  /** Quién lo dice: autores o institución, y revista. */
  fuente: string
}

export const TITULAR = 'Entrena con un coach de verdad, desde tu celular'

export const BAJADA =
  'Tu plan vive en la app y un coach lo ajusta contigo cada semana, según lo que registras.'

export const QUE_RECIBES: readonly string[] = [
  'Tu plan de entrenamiento en la app, sesión por sesión, con las cargas y las repeticiones de cada día.',
  'Un coach que revisa lo que registras y ajusta tu plan cada semana.',
  'Chat con tu coach para tus dudas.',
  'Tu progreso a la vista: cargas, constancia y logros.',
]

export const RESPALDO: readonly Respaldo[] = [
  {
    frase: 'Dos días a la semana, bien hechos, ya cuentan.',
    detalle:
      'Lo que más pesa es pasar de no entrenar a entrenar con regularidad: desde 2 sesiones de fuerza por semana.',
    fuente: 'American College of Sports Medicine, posición sobre entrenamiento de fuerza (Med Sci Sports Exerc, 2026)',
  },
  {
    frase: 'No hace falta entrenar hasta no poder más.',
    detalle:
      'Para la mayoría de las personas sanas, llegar siempre al límite no cambió de forma consistente los resultados, y la fuerza mejora igual dejando repeticiones en reserva. Para ganar músculo, acercarse un poco más al límite ayuda algo: por eso tu coach lo ajusta. Medimos cuánto te queda en el tanque en cada serie.',
    fuente:
      'American College of Sports Medicine (Med Sci Sports Exerc, 2026); Robinson, Pelland, Refalo et al. (Sports Medicine, 2024)',
  },
  {
    frase: 'Con un coach humano, la constancia suele ser mayor que con una app sola.',
    detalle:
      'En unas 65.000 personas de una app de salud, quienes tenían además un coach humano registraron más y perdieron más peso en tres meses que quienes solo tenían el entrenador automático. Es un estudio observacional: muestra una asociación, no asegura lo que te pasará a ti.',
    fuente: 'Kapoor, Narayanan y Manchanda (Marketing Science)',
  },
]

/** Precio de lista del plan (Bryan, 29-sep). Se confirma con Bryan antes de cada cambio. */
export const PRECIO_MENSUAL_COP = 225_000

/** «$225.000», como se escribe un precio en Colombia. */
export function formatearPrecio(cop: number): string {
  return `$${Math.round(cop).toLocaleString('es-CO')}`
}
