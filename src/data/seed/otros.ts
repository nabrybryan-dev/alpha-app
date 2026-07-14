import type { CheckinDiario, Microciclo, Perfil, Usuario } from '../../domain/types'

export const mateo: Usuario = {
  id: 'u-mateo',
  nombre: 'Mateo Ríos',
  rol: 'asesorado',
  avatarIniciales: 'MR',
}

export const sara: Usuario = {
  id: 'u-sara',
  nombre: 'Sara Duque',
  rol: 'asesorado',
  avatarIniciales: 'SD',
}

export const perfilMateo: Perfil = {
  usuarioId: 'u-mateo',
  objetivos: 'Ganancia de masa muscular general / fuerza en básicos',
  edad: 31,
  diasEntrenamiento: 4,
  tiempoSesionMin: 90,
  somatotipo: 'Ectomorfo',
  volumenSemanal: {
    Pecho: 'Alto',
    Espalda: 'Alto',
    Cuádriceps: 'Normal',
    Isquios: 'Normal',
    Hombros: 'Normal',
    Bíceps: 'Bajo',
    Tríceps: 'Bajo',
    Glúteo: 'Bajo',
  },
  medidas: [
    { fecha: '2026-06-20', pesoKg: 68.4, alturaCm: 176, perimetros: { Brazos: 32.1, Pecho: 96.0 } },
    { fecha: '2026-07-04', pesoKg: 69.1, alturaCm: 176, perimetros: { Brazos: 32.4, Pecho: 96.8 } },
  ],
}

export const perfilSara: Perfil = {
  usuarioId: 'u-sara',
  objetivos: 'Pérdida de grasa manteniendo masa muscular / salud metabólica',
  edad: 35,
  diasEntrenamiento: 3,
  tiempoSesionMin: 75,
  somatotipo: 'Endomorfa',
  volumenSemanal: {
    Glúteo: 'Alto',
    Espalda: 'Normal',
    Pecho: 'Normal',
    Cuádriceps: 'Normal',
    Isquios: 'Normal',
    Hombros: 'Bajo',
    Bíceps: 'Bajo',
    Tríceps: 'Bajo',
  },
  medidas: [
    { fecha: '2026-06-27', pesoKg: 74.2, alturaCm: 160, perimetros: { 'Abdomen medio': 88.0, Glúteos: 104.0 }, pgPct: 31.2 },
    { fecha: '2026-07-11', pesoKg: 73.1, alturaCm: 160, perimetros: { 'Abdomen medio': 86.9, Glúteos: 103.8 }, pgPct: 30.4 },
  ],
}

function sesionSimple(id: string, nombre: string, orden: number) {
  return {
    id,
    nombre,
    orden,
    ejercicios: [
      {
        id: `${id}-e1`,
        categoria: 'EMPUJE HORIZONTAL',
        nombre: 'Press de banca con barra',
        cues: 'Escápulas retraídas, pies firmes, baja al pecho con control',
        prescripcion: '60KG A 8 REPS; 3 SERIES (RIR 2). PROGRESA +2.5KG',
        descansoMin: 3,
        sets: 3,
        rango: '(6-10)',
        repsDiana: 8,
        rirObjetivo: 2,
        contenidoDemoId: 'c-empuje-h',
        series: [],
      },
      {
        id: `${id}-e2`,
        categoria: 'TRACCIÓN VERTICAL',
        nombre: 'Dominadas asistidas',
        cues: 'Pecho a la barra, controla la bajada completa',
        prescripcion: 'ASISTENCIA 15KG A 8 REPS; 3 SERIES (RIR 2)',
        descansoMin: 3,
        sets: 3,
        rango: '(6-10)',
        repsDiana: 8,
        rirObjetivo: 2,
        contenidoDemoId: 'c-traccion',
        series: [],
      },
    ],
  }
}

export const microciclosOtros: Microciclo[] = [
  {
    id: 'm8-mateo',
    usuarioId: 'u-mateo',
    numero: 8,
    cadenciaDias: 8,
    estado: 'activo',
    fechaInicio: '2026-07-08',
    sesiones: [sesionSimple('s-m8-full-a', 'FULL A', 1), sesionSimple('s-m8-full-b', 'FULL B', 2)],
  },
  {
    id: 'm15-sara',
    usuarioId: 'u-sara',
    numero: 15,
    cadenciaDias: 15,
    estado: 'activo',
    fechaInicio: '2026-07-05',
    sesiones: [sesionSimple('s-m15-full-a', 'FULL A', 1), sesionSimple('s-m15-full-b', 'FULL B', 2)],
  },
]

export const checkinsOtros: CheckinDiario[] = [
  { id: 'ck-sara-1', usuarioId: 'u-sara', fecha: '2026-07-12', pesoKg: 73.2, pasos: 8100, entreno: 'FULL A', rendimiento: 'BUENA', motivacion: 'REGULAR', hambre: 'MUCHO', cansancio: 'REGULAR', estres: 'REGULAR', horasSueno: 6.5, calidadSueno: 'REGULAR', alimentacion: 'BUENA' },
  { id: 'ck-sara-2', usuarioId: 'u-sara', fecha: '2026-07-13', pesoKg: 73.1, pasos: 9200, entreno: 'Descanso', rendimiento: 'BUENA', motivacion: 'MUCHO', hambre: 'REGULAR', cansancio: 'POCO', estres: 'POCO', horasSueno: 7.5, calidadSueno: 'BUENA', alimentacion: 'BUENA' },
]
