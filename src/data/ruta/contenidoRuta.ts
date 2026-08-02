import type { Competencia, NivelAlfa, RutaAsesorado } from '../../domain/rutaEntrenamiento'

/**
 * Contenido de la vista Ruta mientras no exista su tabla en Supabase.
 *
 * Los cinco peldaños son de presentación; lo que manda es el `nivelMetodo`, que
 * son los tres niveles con los que programa el método (Pérez-Córdoba:
 * principiante gana por vía neural, intermedio sobre todo estructural, avanzado
 * por ambas). Los rangos de tiempo son orientativos: el método NO clasifica por
 * los años que lleves entrenando.
 *
 * Validado contra `wiki/conocimiento/programacion-por-niveles.md` y
 * `wiki/motor-decision/01,02,03,06,07` el 2026-08-01. Lo que se cayó en esa
 * revisión y no debe volver: umbrales de fuerza por peso corporal (no hay
 * ninguno en el Cerebro), "sostener 20-22 series un mesociclo entero" (es vivir
 * en MRV, justo lo que el motor manda descargar) y medir el RIR contra la
 * velocidad (el VBT solo existe si la persona tiene encoder o MyLift).
 */

export const ESCALA_ALFA: NivelAlfa[] = [
  {
    numero: '01',
    nombre: 'FUNDAMENTO',
    nivelMetodo: 'principiante',
    descripcion:
      'Adaptación anatómica: patrones básicos, rango completo y hábito de entrenar. La fuerza sube sobre todo por vía neural.',
    estado: 'superado',
  },
  {
    numero: '02',
    nombre: 'ESTRUCTURA',
    nivelMetodo: 'principiante',
    descripcion:
      'Progresión lineal con esfuerzo moderado (RPE 5–6) y 10–14 series por grupo: aprendes a registrar cargas y a comer para crecer.',
    estado: 'superado',
  },
  {
    numero: '03',
    nombre: 'RENDIMIENTO',
    nivelMetodo: 'intermedio',
    descripcion:
      'Periodización por bloques (acumulación, transmutación, realización) y volumen dosificado por grupo entre MEV y MRV, con descarga al final.',
    estado: 'actual',
  },
  {
    numero: '04',
    nombre: 'AVANZADO',
    nivelMetodo: 'avanzado',
    descripcion:
      'Autorregulación real: ajustas la sesión por fatiga, readiness y contexto de vida, y toleras hasta 22 series por grupo en la cima de la onda.',
    estado: 'bloqueado',
  },
  {
    numero: '05',
    nombre: 'PRECISIÓN',
    nivelMetodo: 'avanzado',
    descripcion:
      'La carga se regula por velocidad de barra, no por sensación: con encoder, la pérdida de velocidad marca cuándo cortar la serie (10–20% para potencia, 20–40% para hipertrofia).',
    estado: 'bloqueado',
  },
  {
    numero: '06',
    nombre: 'ESPECIALIZACIÓN',
    nivelMetodo: 'avanzado',
    descripcion:
      'Bloques ATR completos —acumulación, transmutación, realización— con progresión ondulada inter e intra sesión y ataque dirigido a tus puntos débiles.',
    estado: 'bloqueado',
  },
  {
    numero: '07',
    nombre: 'PICO',
    nivelMetodo: 'avanzado',
    descripcion:
      'Taper para una fecha objetivo: bajar volumen 30–70% manteniendo la intensidad. No se llega descansado, se llega con el mejor balance fitness-fatiga.',
    estado: 'bloqueado',
  },
  {
    numero: '08',
    nombre: 'ÉLITE',
    nivelMetodo: 'avanzado',
    descripcion:
      'Rendimiento sostenido en el tiempo: monitorización completa (1RM estimado, velocidad, VFC, cuestionarios) y la selección de ejercicios gobernada por tu objetivo, no por el catálogo.',
    estado: 'elite',
  },
]

/**
 * Valoración del coach. Vacía a propósito: técnica, fuerza relativa,
 * recuperación y nutrición aplicada las juzga él mirando la ejecución, y hasta
 * que las cargue es más honesto no pintar la tarjeta que enseñar un número
 * igual para todos.
 */
const COMPETENCIAS_COACH: Competencia[] = []

/** Ruta por defecto mientras no haya valoración propia de la persona. */
export function rutaPorDefecto(usuarioId: string): RutaAsesorado {
  const nivelActual = ESCALA_ALFA[2]
  return {
    usuarioId,
    nivelActual,
    siguienteNivel: ESCALA_ALFA[3],
    bloque: {
      nombre: 'Acumulación',
      detalle: 'Volumen en ascenso hacia la descarga',
      semana: 3,
      semanasTotales: 4,
    },
    competenciasCoach: COMPETENCIAS_COACH,
    escala: ESCALA_ALFA,
  }
}
