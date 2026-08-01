import type { Confianza } from './nutricion/dia'

export type Rol = 'asesorado' | 'coach' | 'nutricionista'

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

/** Prescripción de una serie concreta cuando el ejercicio viene ondulado. */
export interface SeriePrescrita {
  orden: number
  reps: number
  rir: number
  cargaKg: number
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
  /** Ondulación del microciclo: reps a la baja y carga al alza, set a set.
   *  Sin definir, todas las series comparten `repsDiana` y `rirObjetivo` — que
   *  es como quedaban los microciclos antes de que la ondulación se guardara. */
  seriesPrescritas?: SeriePrescrita[]
  contenidoDemoId?: string
  /** Etiqueta de cada serie cuando el esquema no es uniforme
   *  (p. ej. ["TOP", "BACK-OFF", "BACK-OFF"] o ["PESADA", "MYO-REPS"]).
   *  Sin definir, todas las series son iguales. */
  etiquetasSeries?: string[]
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
  /** Día de la semana programado ("LUNES"…"DOMINGO"). Si falta, se intenta
   *  deducir del nombre de la sesión (p. ej. "FULL BODY A (LUNES)"). */
  dia?: string
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
  /** Nombres visibles de los tipos de día cuando el plan usa otro esquema
   *  (p. ej. ALTO→"PIERNA", CHEAT→"TORSO"). Sin definir, se muestra la clave. */
  etiquetasDia?: Partial<Record<TipoDia, string>>
  menus: MenuDia[]
  equivalencias: Equivalencia[]
  listaCompras: string[]
  suplementacion: string[]
  seccionesEspeciales: { titulo: string; contenido: string }[]
}

export interface RegistroHidratacion {
  id: string
  usuarioId: string
  fecha: string
  ml: number
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
  /** 'alpha' = respuesta automatica del Centro de Respuestas. Sin definir = humano. */
  origen?: 'humano' | 'alpha'
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

// ── Registro de comidas ─────────────────────────────────────────────────────
// Espejo de las tablas de la migración 0015. La app nombra en camelCase y la
// base en snake_case; la traducción vive en `nube/`, no aquí.

export type TipoComida = 'desayuno' | 'almuerzo' | 'cena' | 'snack'

/** Los seis estados que puede tener un alimento del catálogo. */
export type EstadoAlimento = 'crudo' | 'cocido' | 'seco' | 'listo' | 'preparado' | 'en_lata'

export interface RegistroItem {
  id: string
  alimentoId: string
  gramos: number
  /** Lo pesó de verdad, frente a haberlo estimado a ojo. Manda sobre la
   *  confianza de la comida: una comida estimada puede tener un ítem pesado. */
  fuePesado: boolean
  estadoAsumido: EstadoAlimento
}

export interface RegistroComida {
  id: string
  usuarioId: string
  /** ISO completo. La hora importa: ordena el día y sitúa cada comida. */
  momentoIso: string
  comida: TipoComida
  /** Si no cocinó él, no se le pregunta por aceite ni sal: no los puede saber. */
  cocinadoPorEl: boolean
  /** Gramos de aceite de toda la comida. `null` = no se preguntó, distinto de 0
   *  = se preguntó y no lleva. Misma regla que los nulos del catálogo. */
  aceiteG: number | null
  salG: number | null
  confianza: Confianza
  items: RegistroItem[]
}

/**
 * Qué contestó el asesorado a «¿crudo o cocido?» para una familia de alimentos.
 * Se recuerda para no volver a preguntárselo cada vez que registre arroz.
 */
export interface PreferenciaEstado {
  usuarioId: string
  familia: string
  estado: 'crudo' | 'cocido' | 'seco'
}
