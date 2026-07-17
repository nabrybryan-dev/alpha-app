export type Rol = 'asesorado' | 'coach'

export interface Usuario {
  id: string
  nombre: string
  rol: Rol
  avatarIniciales: string
}

export type NivelVolumen = 'Muy Bajo' | 'Bajo' | 'Normal' | 'Alto' | 'Muy Alto'

export interface MedidaCorporal {
  fecha: string
  pesoKg: number
  alturaCm: number
  perimetros: Record<string, number>
  pgPct?: number
  masaMagraKg?: number
}

export interface Perfil {
  usuarioId: string
  objetivos: string
  edad: number
  diasEntrenamiento: number
  tiempoSesionMin: number
  somatotipo: string
  volumenSemanal: Record<string, NivelVolumen>
  medidas: MedidaCorporal[]
}

export interface SerieRegistrada {
  orden: number
  cargaKg: number
  reps: number
  rir: number
}

export interface TestPostSesion {
  duracionMin: number
  rpeSesion: number
  prsEntrada: number
}

export interface EjercicioPrescrito {
  id: string
  categoria: string
  nombre: string
  cues: string
  prescripcion: string
  descansoMin: number
  sets: number
  rango: string
  repsDiana: number
  rirObjetivo: number
  contenidoDemoId?: string
  series: SerieRegistrada[]
}

export type TipoPreparacion = 'calentamiento' | 'movilidad'

export interface ItemMarcable {
  id: string
  titulo: string
  indicaciones: string
  duracionMin?: number
  contenidoDemoId?: string
  hechoEn?: string
}

export interface PartePreparacion extends ItemMarcable {
  tipo: TipoPreparacion
}

export interface Sesion {
  id: string
  nombre: string
  orden: number
  tipo?: 'fuerza' | 'metabolica'
  preparacion?: PartePreparacion[]
  bloquesCardio?: ItemMarcable[]
  ejercicios: EjercicioPrescrito[]
  testPost?: TestPostSesion
}

export interface Microciclo {
  id: string
  usuarioId: string
  numero: number
  cadenciaDias: 8 | 15
  estado: 'activo' | 'cerrado' | 'propuesto'
  fechaInicio: string
  sesiones: Sesion[]
}

export type Cualitativo3 = 'MALA' | 'REGULAR' | 'BUENA'
export type Cantidad3 = 'POCO' | 'REGULAR' | 'MUCHO'

export interface CheckinDiario {
  id: string
  usuarioId: string
  fecha: string
  pesoKg?: number
  pasos?: number
  entreno?: string
  rendimiento?: Cualitativo3
  motivacion?: Cantidad3
  hambre?: Cantidad3
  cansancio?: Cantidad3
  estres?: Cantidad3
  horasSueno?: number
  calidadSueno?: Cualitativo3
  alimentacion?: Cualitativo3
  comentarios?: string
}

export type TipoDia = 'ALTO' | 'BAJO' | 'CHEAT'

export interface Macros {
  kcal: number
  proteinaG: number
  carbosG: number
  grasaG: number
}

export interface Comida {
  hora: string
  titulo: string
  alimentos: string[]
  nota?: string
}

export interface MenuDia {
  nombre: string
  tipoDia: TipoDia
  comidas: Comida[]
}

export interface Equivalencia {
  grupo: string
  base: string
  opciones: string[]
}

export interface PlanNutricional {
  id: string
  usuarioId: string
  analisis: string
  macrosPorDia: Record<TipoDia, Macros>
  menus: MenuDia[]
  equivalencias: Equivalencia[]
  listaCompras: string[]
  suplementacion: string[]
  seccionesEspeciales: { titulo: string; contenido: string }[]
}

export type EstadoAdherencia = 'si' | 'parcial' | 'no'

export interface AdherenciaNutricional {
  id: string
  usuarioId: string
  fecha: string
  estado: EstadoAdherencia
  comentario?: string
}

export interface Mensaje {
  id: string
  deId: string
  paraId: string
  fechaIso: string
  texto: string
  adjuntoUrl?: string
  leido: boolean
}

export type TipoPregunta = 'si_no' | 'escala_1_5' | 'opcion_multiple' | 'texto'

export interface Pregunta {
  id: string
  tipo: TipoPregunta
  enunciado: string
  opciones?: string[]
}

export interface Cuestionario {
  id: string
  titulo: string
  descripcion: string
  preguntas: Pregunta[]
  asignadoA: string[]
}

export interface Respuesta {
  id: string
  cuestionarioId: string
  usuarioId: string
  fechaIso: string
  valores: Record<string, string>
}

export type TipoContenido = 'video' | 'imagen' | 'articulo'

export interface Contenido {
  id: string
  tipo: TipoContenido
  categoria: string
  titulo: string
  descripcion: string
  url: string
  patronMovimiento?: string
}

export interface PremiacionCoach {
  id: string
  usuarioId: string
  titulo: string
  fecha: string
  nota?: string
}
