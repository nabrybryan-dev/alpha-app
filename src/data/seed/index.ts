import type {
  AdherenciaNutricional,
  CheckinDiario,
  Contenido,
  Cuestionario,
  Mensaje,
  Microciclo,
  Perfil,
  PlanNutricional,
  PerfilNutricion,
  PreferenciaEstado,
  PruebaCalibracion,
  PremiacionCoach,
  RegistroComida,
  RegistroHidratacion,
  Respuesta,
  Usuario,
  VisibilidadAsesorado,
} from '../../domain/types'
import {
  adherenciasValentina,
  checkinsValentina,
  coach,
  microciclosValentina,
  perfilValentina,
  planValentina,
  valentina,
} from './valentina'
import { checkinsOtros, mateo, microciclosOtros, perfilMateo, perfilSara, sara } from './otros'
import { cuestionarios, respuestas } from './cuestionarios'
import { contenidos } from './contenidos'
import { mensajes, premiaciones } from './mensajes'

import type { FilaRanking } from '../../domain/ranking'

export interface SeedDb {
  usuarios: Usuario[]
  perfiles: Perfil[]
  microciclos: Microciclo[]
  checkins: CheckinDiario[]
  planes: PlanNutricional[]
  adherencias: AdherenciaNutricional[]
  /** Opcional: snapshots viejos en localStorage no traen esta clave. */
  hidratacion?: RegistroHidratacion[]
  /** Opcional por lo mismo: el registro de comidas llegó después. */
  perfilesNutricion?: PerfilNutricion[]
  visibilidades?: VisibilidadAsesorado[]
  pruebasCalibracion?: PruebaCalibracion[]
  registrosComida?: RegistroComida[]
  preferenciasEstado?: PreferenciaEstado[]
  /** Solo en modo nube: lo llena la RPC ranking_disciplina al iniciar sesión. */
  ranking?: FilaRanking[]
  mensajes: Mensaje[]
  cuestionarios: Cuestionario[]
  respuestas: Respuesta[]
  contenidos: Contenido[]
  premiaciones: PremiacionCoach[]
}

export const seedDb: SeedDb = {
  usuarios: [coach, valentina, mateo, sara],
  perfiles: [perfilValentina, perfilMateo, perfilSara],
  microciclos: [...microciclosValentina, ...microciclosOtros],
  checkins: [...checkinsValentina, ...checkinsOtros],
  planes: [planValentina],
  adherencias: adherenciasValentina,
  hidratacion: [],
  // Valentina lleva meses: su encuesta esta respondida y ve Nutricion entera.
  // Mateo y Sara no la han contestado, asi que a ellos les sale la compuerta.
  // Los dos caminos existen en el seed a proposito, para poder verlos.
  perfilesNutricion: [
    {
      usuarioId: 'u-valentina',
      completadaEn: '2026-07-01T10:00:00.000Z',
      respuestas: {
        genero: 'M',
        fechaNacimiento: '1998-03-14',
        pesoKg: 62,
        alturaCm: 165,
        cuelloCm: 31,
        cinturaCm: 71,
        caderaCm: 96,
        pasosDiarios: 9500,
        diasEntreno: 4,
        alergias: ['ninguna'],
        condicionesMedicas: ['ninguna'],
        excluye: ['nada'],
        comeVisceras: 'algunas',
        noLeGustan: 'la remolacha',
        lugarCompra: 'supermercado',
        frecuenciaCocina: 'casi_siempre',
        sinAcceso: '-',
        tieneBascula: 'si',
        cicloMenstrual: 'regular',
      },
    },
  ],
  visibilidades: [],
  pruebasCalibracion: [],
  registrosComida: [],
  preferenciasEstado: [],
  mensajes,
  cuestionarios,
  respuestas,
  contenidos,
  premiaciones,
}
