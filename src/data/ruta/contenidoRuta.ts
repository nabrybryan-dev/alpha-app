import type { NivelAlfa } from '../../domain/rutaEntrenamiento'

/**
 * Los peldaños de la Escala Alfa. Contenido, no dato de la persona: se actualiza
 * con la app.
 *
 * Lo que manda de verdad es el `nivelMetodo`, que son los tres niveles con los
 * que programa el método (Pérez-Córdoba: el principiante gana por vía neural, el
 * intermedio sobre todo estructural, el avanzado por ambas). Los peldaños son
 * siete porque una escalera larga se recorre mejor, pero cada uno declara a qué
 * nivel real pertenece.
 *
 * **Los rangos de tiempo son descripción, no requisito.** Ninguna de las tres
 * referencias que clasifican —el marco de McKay (2022), la posición del ACSM
 * (2009) y el propio Pérez-Córdoba— usa los años como criterio: McKay clasifica
 * por volumen de entrenamiento y rendimiento, y Pérez-Córdoba por vía de
 * adaptación. Ver `wiki/conocimiento/clasificacion-nivel-y-educacion.md`.
 *
 * Revisado el 2026-08-02. Lo que se cayó y no debe volver: umbrales de fuerza por
 * peso corporal (los datos normativos existen, pero describen a gente que eligió
 * competir: es el techo alcanzable, no una norma), y la velocidad de barra como
 * puerta (solo existe si la persona tiene encoder).
 */
export const ESCALA_ALFA: NivelAlfa[] = [
  {
    numero: '01',
    nombre: 'FUNDAMENTO',
    nivelMetodo: 'principiante',
    descripcion:
      'Adaptación anatómica: patrones básicos, rango completo y hábito de entrenar. La fuerza sube sobre todo por vía neural.',
    estado: 'bloqueado',
  },
  {
    numero: '02',
    nombre: 'ESTRUCTURA',
    nivelMetodo: 'principiante',
    descripcion:
      'Progresión lineal con esfuerzo moderado (RPE 5–6) y 10–14 series por grupo: aprendes a registrar cargas y a comer para crecer.',
    estado: 'bloqueado',
  },
  {
    numero: '03',
    nombre: 'RENDIMIENTO',
    nivelMetodo: 'intermedio',
    descripcion:
      'Periodización por bloques (acumulación, transmutación, realización) y volumen dosificado por grupo entre MEV y MRV, con descarga al final.',
    estado: 'bloqueado',
  },
  {
    numero: '04',
    nombre: 'AVANZADO',
    nivelMetodo: 'avanzado',
    descripcion:
      'Autorregulación real: ajustas la sesión por fatiga, readiness y contexto de vida, y sostienes la parte alta de la onda sin perder rendimiento.',
    estado: 'bloqueado',
  },
  {
    numero: '05',
    nombre: 'ESPECIALIZACIÓN',
    nivelMetodo: 'avanzado',
    descripcion:
      'Bloques ATR completos —acumulación, transmutación, realización— con progresión ondulada y ataque dirigido a tus puntos débiles. Si tienes encoder, aquí la velocidad de barra afina la carga; sin él, la afinan tus registros.',
    estado: 'bloqueado',
  },
  {
    numero: '06',
    nombre: 'PICO',
    nivelMetodo: 'avanzado',
    descripcion:
      'Llevar el rendimiento a su punto más alto en la ventana que elijas: bajar volumen manteniendo intensidad y que la fuerza suba después de la descarga, no solo que aguantes.',
    estado: 'bloqueado',
  },
  {
    numero: '07',
    nombre: 'ÉLITE',
    nivelMetodo: 'avanzado',
    descripcion:
      'Sostenerlo bloque tras bloque: no una buena racha, sino rendimiento estable en el tiempo, con la selección de ejercicios gobernada por tu objetivo y no por el catálogo.',
    estado: 'elite',
  },
]

/**
 * La escala con el estado de cada peldaño para ESTA persona.
 *
 * Antes había una `rutaPorDefecto` que recibía el `usuarioId` y lo ignoraba:
 * devolvía siempre el peldaño 03, así que todos los asesorados veían
 * "NIVEL 03 · RENDIMIENTO" el día que entraban y dos años después.
 */
export function escalaPara(peldanoActual: number): NivelAlfa[] {
  return ESCALA_ALFA.map((nivel, i) => {
    const numero = i + 1
    if (numero < peldanoActual) return { ...nivel, estado: 'superado' as const }
    if (numero === peldanoActual) return { ...nivel, estado: 'actual' as const }
    if (numero === ESCALA_ALFA.length) return { ...nivel, estado: 'elite' as const }
    return { ...nivel, estado: 'bloqueado' as const }
  })
}

/** El peldaño en el que está, por su número (1–7). */
export function nivelDe(peldano: number): NivelAlfa {
  const indice = Math.max(0, Math.min(ESCALA_ALFA.length - 1, peldano - 1))
  return ESCALA_ALFA[indice]
}

/** El siguiente peldaño, o `undefined` si ya está en la cima. */
export function siguienteNivelDe(peldano: number): NivelAlfa | undefined {
  return peldano >= ESCALA_ALFA.length ? undefined : ESCALA_ALFA[peldano]
}
