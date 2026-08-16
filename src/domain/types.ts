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
  /**
   * Pauta del bloque actual, la que se resume en Hoy. Los tres son opcionales
   * a propósito: son prescripción del coach, no cálculo de la app. Mientras no
   * los cargue, la tarjeta no se pinta — antes que enseñar un número inventado.
   *
   * Viajan dentro de `perfiles.datos` (JSONB), así que no necesitan migración.
   */
  faseEnergetica?: string
  proteinaGkg?: number
  pasosObjetivo?: number
  /**
   * Lo que el coach valora mirando la ejecución y la app no puede deducir
   * (hoy, la técnica). El resto de competencias de la Ruta se calculan solas.
   */
  valoraciones?: ValoracionCompetencia[]
  /**
   * Peldaño de la Escala Alfa, 1–7. Sin definir = todavía no se ha calculado y
   * se deduce de sus datos.
   *
   * Antes no existía: la Ruta devolvía el peldaño 03 para todo el mundo.
   */
  peldanoAlfa?: number
  /** Cuándo subió por última vez, para poder avisárselo en la Ruta. */
  ascensoIso?: string
}

/** Nota del coach a una competencia concreta de la Ruta. */
export interface ValoracionCompetencia {
  /** Coincide con el id del catálogo de competencias del coach. */
  id: string
  /** 0–100. */
  pct: number
  /** Qué vio el coach. Es lo que de verdad le sirve al asesorado. */
  nota: string
  /** Fecha ISO en que se puso, para saber si está vieja. */
  fecha: string
}

export interface SerieRegistrada {
  orden: number
  cargaKg: number
  /**
   * Opcionales porque hay trabajo que no se mide así y forzarlo inventa datos.
   *
   * Una plancha isométrica no tiene repeticiones en reserva, y un foam roller
   * tampoco. Hasta el 2026-08-15 la base guardaba ahí las palabras «Isometría»,
   * «Control», «Movilidad» y «Suave» —81 series— porque el tipo exigía un
   * número y no había dónde poner «esto no lleva RIR». Eso rompía cualquier
   * promedio: un `avg` sobre RIR reventaba al toparse con el texto.
   *
   * Ausente significa **no aplica**, no «cero». Quien los lea tiene que
   * saltarse las series sin dato en vez de contarlas como 0, que sería
   * decir que se llegó al fallo.
   */
  reps?: number
  rir?: number
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
  /**
   * Cómo se preguntaba el hambre antes: POCO / REGULAR / MUCHO.
   *
   * Se conserva SOLO para los check-ins ya guardados. No se convierte a la
   * escala nueva: «MUCHO» no es un 8, y traducirlo fabricaría una precisión que
   * nadie midió. Los registros viejos se leen tal como se respondieron y no
   * entran en la regla de días, que necesita el número.
   */
  hambre?: Cantidad3
  /**
   * El hambre del día, de 1 a 10. Es lo que se pregunta desde ahora.
   *
   * Con tres categorías no se distinguía un 7 de un 9 — que es justo la
   * diferencia entre esperar cinco días y actuar en dos. La regla de la
   * nutricionista existía y no se podía ejecutar por eso.
   */
  hambreEscala?: number
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
  /**
   * Ruta del objeto dentro del bucket privado. NO es una URL: el bucket no es
   * publico, asi que se firma al pintarla y se deja caducar.
   *
   * Sustituye al viejo `adjuntoUrl`, que guardaba el nombre que el archivo tenia
   * en el telefono -y nada mas: no habia archivo detras de ese nombre-.
   */
  adjuntoPath?: string
  adjuntoTipo?: 'imagen' | 'video'
  /**
   * Solo local, no viaja a la base: dice si el archivo de ESTE dispositivo ya
   * subio. Para cualquier otro dispositivo la respuesta siempre es que si.
   */
  adjuntoEstado?: 'subiendo' | 'listo'
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
 * La decisión de la nutricionista sobre qué cifras ve un asesorado.
 *
 * La `nota` va aparte en la base -tabla propia, solo staff- porque es clínica y
 * el asesorado sí puede leer sus interruptores. Aquí viajan juntas porque quien
 * carga este objeto es siempre staff.
 */
/**
 * Un alimento que esta persona no debe comer, marcado por la nutricionista.
 *
 * ES LA TRADUCCIÓN QUE FALTABA. La encuesta recoge las alergias en texto libre
 * —«soy alérgica a los mariscos»— y este repo se niega a interpretarlas: no hay
 * forma fiable de convertir una frase en una lista de ids, y equivocarse ahí es
 * proponerle a alguien lo que le hace daño. Quien traduce es Manuela, que para
 * eso conoce a la persona; esto es donde escribe el resultado.
 *
 * NO BLOQUEA REGISTRAR, NUNCA. Es la regla R6 y no tiene excepciones: si
 * alguien con alergia al marisco se comió marisco, lo que hace falta es que
 * quede anotado y que el coach lo VEA, no que el diario se lo impida y el dato
 * se pierda. Esto solo decide qué se le PROPONE.
 *
 * El motivo es opcional a propósito: exigirlo convertiría un veto de treinta
 * segundos en un formulario, y un veto sin escribir protege menos que uno
 * escrito sin motivo.
 */
export interface VetoAlimento {
  usuarioId: string
  alimentoId: string
  motivo?: string
}

export interface VisibilidadAsesorado {
  usuarioId: string
  verComposicion: boolean
  verObjetivoCalorico: boolean
  verContadorKcal: boolean
  estado: 'automatico' | 'en_espera' | 'decidido'
  nota?: string
  decididoPor?: string
  decididoEn?: string
}

/**
 * Lo que el asesorado respondió en la encuesta que abre Nutrición.
 *
 * Se guarda tal cual, en crudo. Las cifras que salen de aquí -grasa, TDEE,
 * macros- NO se guardan: se recalculan siempre desde estas respuestas. Así, el
 * día que se corrija una fórmula, los perfiles viejos se corrigen solos en vez
 * de arrastrar para siempre un número hecho con la versión anterior.
 */
export interface PerfilNutricion {
  usuarioId: string
  respuestas: Record<string, string | number | string[]>
  /** Cuándo terminó de responder. Sin esto, la encuesta sigue pendiente. */
  completadaEn?: string
}

/**
 * Una vez que el asesorado estimó primero y pesó después.
 *
 * El orden importa y es lo que hace que la prueba valga: si pesa antes de
 * estimar, ya no está midiendo su ojo, está copiando la báscula.
 */
export interface PruebaCalibracion {
  id: string
  usuarioId: string
  fecha: string
  alimentoId: string
  gramosEstimados: number
  gramosReales: number
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
