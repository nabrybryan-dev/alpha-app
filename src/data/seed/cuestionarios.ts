import type { Cuestionario, Respuesta } from '../../domain/types'

export const cuestionarios: Cuestionario[] = [
  {
    id: 'q-dolor-articular',
    titulo: 'Chequeo de dolor articular',
    descripcion: 'Ayúdanos a detectar molestias a tiempo para ajustar tu programación antes de que se vuelvan un problema.',
    asignadoA: ['u-valentina', 'u-mateo', 'u-sara'],
    preguntas: [
      { id: 'p1', tipo: 'si_no', enunciado: '¿Sentiste dolor (no agujetas) en alguna articulación esta semana?' },
      { id: 'p2', tipo: 'opcion_multiple', enunciado: 'Si hubo molestia, ¿dónde?', opciones: ['Hombro', 'Codo', 'Muñeca', 'Cadera', 'Rodilla', 'Zona lumbar', 'No aplica'] },
      { id: 'p3', tipo: 'escala_1_5', enunciado: 'Del 1 al 5, ¿qué tan intensa fue la molestia en su peor momento?' },
      { id: 'p4', tipo: 'si_no', enunciado: '¿La molestia apareció durante un ejercicio específico?' },
      { id: 'p5', tipo: 'texto', enunciado: 'Cuéntanos en qué ejercicio y en qué parte del movimiento la sentiste' },
    ],
  },
  {
    id: 'q-adherencia-bloque',
    titulo: 'Adherencia y disfrute del bloque',
    descripcion: 'Tu opinión define el siguiente bloque: lo que disfrutas se sostiene, y lo que se sostiene da resultados.',
    asignadoA: ['u-valentina', 'u-mateo', 'u-sara'],
    preguntas: [
      { id: 'p1', tipo: 'escala_1_5', enunciado: '¿Qué tan sostenible sientes el plan de entrenamiento actual?' },
      { id: 'p2', tipo: 'escala_1_5', enunciado: '¿Qué tan sostenible sientes el plan de nutrición actual?' },
      { id: 'p3', tipo: 'opcion_multiple', enunciado: '¿Qué sesión disfrutas más?', opciones: ['LEG A', 'UPPER A', 'LEG B', 'UPPER B', 'FULL C'] },
      { id: 'p4', tipo: 'texto', enunciado: '¿Qué cambiarías del bloque actual?' },
    ],
  },
]

export const respuestas: Respuesta[] = [
  {
    id: 'r-valentina-adherencia',
    cuestionarioId: 'q-adherencia-bloque',
    usuarioId: 'u-valentina',
    fechaIso: '2026-07-05T18:30:00',
    valores: {
      p1: '5',
      p2: '4',
      p3: 'LEG A',
      p4: 'Me gustaría meter más trabajo directo de hombro, siento que responde bien',
    },
  },
]
