import type {
  Competencia,
  NivelAlfa,
  RequisitoNivel,
  RutaAsesorado,
} from '../../domain/rutaEntrenamiento'

/**
 * Contenido de la vista Ruta mientras no exista su tabla en Supabase.
 *
 * Ojo con lo que hay aquí: los umbrales de la Escala Alfa y las notas de
 * competencia son una PROPUESTA basada en literatura de programación, no una
 * valoración firmada por el coach (así lo dejó dicho el handoff de diseño). El
 * día que el coach evalúe de verdad, esto se reemplaza por lo suyo — por eso
 * vive detrás de `rutaRepo` y no incrustado en la pantalla.
 */

export const ESCALA_ALFA: NivelAlfa[] = [
  {
    numero: '01',
    nombre: 'FUNDAMENTO',
    rango: '0–6 meses',
    descripcion:
      'Adaptación anatómica: patrones básicos, rango completo y hábito de entrenar 3 veces por semana.',
    estado: 'superado',
  },
  {
    numero: '02',
    nombre: 'ESTRUCTURA',
    rango: '6–18 meses',
    descripcion:
      'Hipertrofia con progresión lineal: aprendes a fallar cerca, a registrar cargas y a comer para crecer.',
    estado: 'superado',
  },
  {
    numero: '03',
    nombre: 'RENDIMIENTO',
    rango: '18–36 meses',
    descripcion:
      'Periodización por bloques: acumulación, intensificación y deload. Tu volumen ya se dosifica por grupo.',
    estado: 'actual',
  },
  {
    numero: '04',
    nombre: 'AVANZADO',
    rango: '3–6 años',
    descripcion:
      'Autorregulación real: ajustas la sesión por fatiga, velocidad de barra y contexto de vida.',
    estado: 'bloqueado',
  },
  {
    numero: '05',
    nombre: 'ÉLITE',
    rango: '+6 años',
    descripcion:
      'Especialización: picos planificados, gestión de puntos débiles y competencia o objetivo estético de alto nivel.',
    estado: 'elite',
  },
]

const COMPETENCIAS: Competencia[] = [
  {
    id: 'tecnica',
    nombre: 'Técnica y patrones',
    pct: 88,
    nota: 'Dominas sentadilla, bisagra, empuje y tracción con control excéntrico de 2 s.',
  },
  {
    id: 'autorregulacion',
    nombre: 'Autorregulación (RIR/RPE)',
    pct: 70,
    nota: 'Tu RIR reportado se desvía 1,2 puntos del estimado por velocidad. Objetivo: menos de 0,8.',
  },
  {
    id: 'volumen',
    nombre: 'Tolerancia al volumen',
    pct: 55,
    nota: '18 series semanales por grupo. El nivel 04 exige sostener 20–22 sin perder rendimiento.',
  },
  {
    id: 'fuerza-relativa',
    nombre: 'Fuerza relativa',
    pct: 62,
    nota: 'Sentadilla 1,42× · press banca 1,05× · peso muerto 1,80× de tu peso corporal.',
  },
  {
    id: 'recuperacion',
    nombre: 'Recuperación y fatiga',
    pct: 74,
    nota: 'Sueño 7,1 h y HRV estable. Aún dependes del deload cada 4 semanas.',
  },
  {
    id: 'nutricion',
    nombre: 'Nutrición aplicada',
    pct: 80,
    nota: '2,0 g/kg de proteína sostenidos 11 semanas. Falta autonomía en ajuste de calorías.',
  },
  {
    id: 'consistencia',
    nombre: 'Consistencia',
    pct: 94,
    nota: '48 de 51 sesiones completadas en 13 semanas. Racha actual de 12 días.',
  },
]

const REQUISITOS: RequisitoNivel[] = [
  {
    id: 'meses',
    cumplido: true,
    texto: '24 meses de entrenamiento continuo con registro de cargas',
    metrica: '26 / 24 meses · cumplido',
  },
  {
    id: 'tecnica-video',
    cumplido: true,
    texto: 'Técnica validada en video por tu coach en los 4 patrones base',
    metrica: '4 / 4 patrones · validado en M6',
  },
  {
    id: 'series-semana',
    cumplido: false,
    texto: 'Sostener 20 series semanales por grupo muscular durante un mesociclo completo',
    metrica: '18 / 20 series · faltan 2',
  },
  {
    id: 'error-rir',
    cumplido: false,
    texto: 'Estimar tu RIR con error menor a 0,8 en las series pesadas',
    metrica: '1,2 de error · faltan 0,4',
  },
  {
    id: 'sentadilla',
    cumplido: false,
    texto: 'Alcanzar 1,60× tu peso corporal en sentadilla',
    metrica: '1,42× / 1,60× · faltan 11 kg',
  },
]

/** Ruta por defecto mientras no haya valoración propia de la persona. */
export function rutaPorDefecto(usuarioId: string): RutaAsesorado {
  const nivelActual = ESCALA_ALFA[2]
  return {
    usuarioId,
    nivelActual,
    siguienteNivel: ESCALA_ALFA[3],
    pctAlSiguiente: 62,
    estadisticas: [
      { valor: '26', etiqueta: 'Meses entrenando' },
      { valor: '1,42×', etiqueta: 'Sentadilla / PC' },
      { valor: '18', etiqueta: 'Series / grupo sem.' },
    ],
    bloque: {
      nombre: 'Acumulación · Mesociclo 2',
      detalle: 'Semana 3 de 4 · deload en M9',
      semana: 3,
      semanasTotales: 4,
    },
    competencias: COMPETENCIAS,
    requisitos: REQUISITOS,
    escala: ESCALA_ALFA,
  }
}
