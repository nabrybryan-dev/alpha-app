import type {
  AdherenciaNutricional,
  CheckinDiario,
  Contenido,
  Cuestionario,
  EstadoAdherencia,
  Mensaje,
  Microciclo,
  Perfil,
  PlanNutricional,
  PremiacionCoach,
  Respuesta,
  SerieRegistrada,
  TestPostSesion,
  Usuario,
} from '../domain/types'

export interface UsuariosRepo {
  list(): Usuario[]
  byId(id: string): Usuario | undefined
  asesorados(): Usuario[]
}

export interface PerfilesRepo {
  byUsuario(usuarioId: string): Perfil | undefined
}

export interface MicrociclosRepo {
  byUsuario(usuarioId: string): Microciclo[]
  registrarSerie(microcicloId: string, ejercicioId: string, serie: SerieRegistrada): void
  guardarTestPost(microcicloId: string, sesionId: string, test: TestPostSesion): void
}

export interface BienestarRepo {
  byUsuario(usuarioId: string): CheckinDiario[]
  guardar(checkin: CheckinDiario): void
}

export interface NutricionRepo {
  planByUsuario(usuarioId: string): PlanNutricional | undefined
  adherenciasByUsuario(usuarioId: string): AdherenciaNutricional[]
  marcarAdherencia(usuarioId: string, fecha: string, estado: EstadoAdherencia, comentario?: string): void
}

export interface MensajesRepo {
  hilo(usuarioA: string, usuarioB: string): Mensaje[]
  enviar(mensaje: { deId: string; paraId: string; texto: string; adjuntoUrl?: string }): void
  marcarLeidos(paraId: string, deId: string): void
  noLeidosPara(usuarioId: string): number
  noLeidosDe(paraId: string, deId: string): number
}

export interface CuestionariosRepo {
  asignadosA(usuarioId: string): Cuestionario[]
  respuestasDe(usuarioId: string): Respuesta[]
  responder(cuestionarioId: string, usuarioId: string, valores: Record<string, string>): void
}

export interface ContenidosRepo {
  list(): Contenido[]
  byId(id: string): Contenido | undefined
}

export interface PremiacionesRepo {
  byUsuario(usuarioId: string): PremiacionCoach[]
}

export interface Db {
  usuarios: UsuariosRepo
  perfiles: PerfilesRepo
  microciclos: MicrociclosRepo
  bienestar: BienestarRepo
  nutricion: NutricionRepo
  mensajes: MensajesRepo
  cuestionarios: CuestionariosRepo
  contenidos: ContenidosRepo
  premiaciones: PremiacionesRepo
}
