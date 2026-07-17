import type {
  AdherenciaNutricional,
  CheckinDiario,
  Contenido,
  Cuestionario,
  Mensaje,
  Microciclo,
  Perfil,
  PlanNutricional,
  PremiacionCoach,
  RegistroHidratacion,
  Respuesta,
  Usuario,
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

export interface SeedDb {
  usuarios: Usuario[]
  perfiles: Perfil[]
  microciclos: Microciclo[]
  checkins: CheckinDiario[]
  planes: PlanNutricional[]
  adherencias: AdherenciaNutricional[]
  /** Opcional: snapshots viejos en localStorage no traen esta clave. */
  hidratacion?: RegistroHidratacion[]
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
  mensajes,
  cuestionarios,
  respuestas,
  contenidos,
  premiaciones,
}
