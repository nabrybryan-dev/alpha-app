/**
 * Tipos del registro en lenguaje natural de Praxis.
 *
 * Tres familias, y conviene no mezclarlas:
 *
 *  1. `Extraccion`: lo que devuelve el modelo (Haiku). Son CITAS literales de la
 *     frase y etiquetas, nunca números calculados. Su JSON Schema vive en
 *     `esquema.ts` y el TS de abajo lo refleja campo a campo.
 *  2. `ContextoRegistro`: el estado que los resolutores necesitan (la sesión de
 *     hoy, las series hechas, el perfil...). NO viaja entero al modelo: al
 *     modelo solo va el paquete mínimo de `prompt.ts`.
 *  3. `Propuesta`: lo que sale del código. Es lo que pinta la tarjeta y lo único
 *     que se guarda, y solo después de que la persona toque «Guardar».
 *
 * Diseño: DISENO-REGISTRO-NATURAL.md (28-sep-2026), §2 y §3.
 */

export type Confianza = 'alta' | 'media' | 'baja'

/** Cómo se lee `cargaKg` de un ejercicio. `corporal` y `banda` no llevan kilos. */
export type UnidadCarga = 'kg' | 'total' | 'por_mano' | 'por_lado' | 'corporal' | 'banda'

/** La unidad con la que se guarda y se pinta una serie dictada. */
export type UnidadSerie = 'kg' | 'por_mano' | 'por_lado' | 'corporal' | 'banda'

// ---------------------------------------------------------------------------
// 1. Extracción (salida del modelo)
// ---------------------------------------------------------------------------

export type Intencion =
  | 'entreno'
  | 'comida'
  | 'agua'
  | 'vida'
  | 'correccion'
  | 'deshacer'
  | 'respuesta_a_pregunta'
  | 'consulta'
  | 'charla'
  | 'clinico'

export type TipoCarga =
  | 'absoluta'
  | 'barra_sola'
  | 'discos'
  | 'relativa'
  | 'corporal'
  | 'copiar_pauta'
  | 'copiar_semana_anterior'
  | 'copiar_serie_anterior'
  | 'no_dicha'

export type SenalEntreno =
  | 'aproximado'
  | 'no_recuerda'
  | 'autocorreccion'
  | 'maximo_o_minimo'
  | 'reps_y_carga_ambiguas'

export type PorCarga = 'lado' | 'mano' | 'total' | 'no_dicho'

export interface CargaExtraida {
  tipo: TipoCarga
  valor: string | null
  unidad_cita: string | null
  discos: { cantidad: string; peso: string }[] | null
  delta: string | null
  por: PorCarga
}

export interface ReservaExtraida {
  tipo: 'no_dicha' | 'reserva_dicha' | 'fallo' | 'rir_de_pauta'
  cita: string | null
}

export interface BloqueExtraido {
  n_series: string | null
  ordinal: string | null
  reps: string | null
  carga: CargaExtraida
  reserva: ReservaExtraida
  /** Serie de calentamiento: se oye y se descarta, no cuenta como serie ni volumen. */
  es_calentamiento: boolean
  /** Mini-bloques de una técnica de intensidad (drop set, rest-pause). Carga null = la misma. */
  extra: { reps: string; carga: string | null }[]
  senales: SenalEntreno[]
}

export interface EjercicioExtraido {
  ejercicio: {
    cita: string | null
    ref_sugerida: string | null
    implicito: 'no' | 'pantalla' | 'anterior' | 'desconocido'
  }
  bloques: BloqueExtraido[]
  cuando: string | null
}

export interface ItemComidaExtraido {
  alimento: string
  cantidad: string | null
  medida: string | null
  estado: string | null
  senales: ('aproximado' | 'no_recuerda' | 'autocorreccion' | 'pesado')[]
}

export interface ComidaExtraida {
  comida_cita: string | null
  cuando: string | null
  segun_plan: 'no_dicho' | 'como_el_plan' | 'parcial' | 'fuera_del_plan'
  items: ItemComidaExtraido[]
  plato: { alimento: string; fraccion: string | null }[] | null
  cocinado_por_ella: 'si' | 'no' | 'no_dicho'
  aceite: string | null
  sal: string | null
  /** «Lo mismo de ayer»: copia la comida equivalente de ayer, si existe. Opcional. */
  referencia?: 'no' | 'igual_que_ayer'
  /** Citas de lo que quita de esa copia: «sin el huevo» => ["el huevo"]. */
  sin?: string[]
}

export type CampoEscala =
  | 'cansancio'
  | 'estres'
  | 'ganas_de_entrenar'
  | 'animo'
  | 'hambre'
  | 'rendimiento'
  | 'alimentacion'

export interface VidaExtraida {
  sueno_horas: string | null
  hora_acostarse: string | null
  hora_levantarse: string | null
  calidad_sueno: string | null
  pasos: string | null
  actividad_sin_numero: string | null
  agua: { cantidad: string; medida: string | null } | null
  escalas: { campo: CampoEscala; cita: string }[]
  senales: ('aproximado' | 'no_recuerda')[]
  /** Lo que marcó la báscula, si dice que se pesó: «78 y medio». Opcional: el modelo puede omitirlo. */
  peso_corporal?: string | null
  /** Qué pasó con el entreno de HOY cuando no fue la pauta tal cual (no entrenó, descanso, cambió). */
  dia_de_entreno?: DiaDeEntrenoExtraido | null
  /** Tiempos sueltos que no tienen campo propio (caminata, siesta, pantalla): van a comentarios, citados. */
  tiempos?: { actividad: 'caminata' | 'siesta' | 'pantalla'; duracion: string }[]
  /** Cita de la AUSENCIA explícita de dolor («no me duele nada»). El dolor con síntoma sigue siendo del filtro clínico. */
  sin_dolor?: string | null
}

export interface DiaDeEntrenoExtraido {
  estado: 'no_entreno' | 'descanso' | 'cambio'
  /** Cita del porqué, si lo dijo («el jefe me sacó tarde»). */
  motivo: string | null
  /** Cita de lo que hizo en lugar de la pauta («brazos»), solo con `cambio`. */
  hizo: string | null
}

export interface CorreccionExtraida {
  objetivo: 'ultimo_registro' | 'serie_ordinal' | 'comida_ultima' | 'sueno' | 'no_claro'
  campo: string | null
  nuevo_valor: string | null
  ordinal: string | null
}

export interface AclaracionExtraida {
  motivo: 'frase_incompleta' | 'numeros_sin_papel' | 'dos_lecturas' | 'otro'
  opciones_citadas: string[]
}

/** Lo que se dice de la sesión entera (test posterior), no de un ejercicio. */
export interface SesionExtraida {
  rpe: string | null
  duracion: string | null
  /** Citas de ejercicios que la persona dice EXPLÍCITAMENTE que no hizo. */
  omitidos: string[]
  /** Duración del bloque de cardio: «20 minutos». */
  cardio: string | null
  /** Citas de las partes de la preparación que dice haber hecho: «la movilidad». */
  preparacion: string[]
}

export interface Extraccion {
  intencion: Intencion[]
  entreno: EjercicioExtraido[]
  comida: ComidaExtraida | null
  vida: VidaExtraida | null
  sesion: SesionExtraida | null
  correccion: CorreccionExtraida | null
  aclaracion: AclaracionExtraida | null
  clinico: { hay: boolean; cita: string | null }
  fuera_de_alcance: boolean
}

// ---------------------------------------------------------------------------
// 2. Contexto (estado local que usan los resolutores)
// ---------------------------------------------------------------------------

export interface SerieHecha {
  orden: number
  cargaKg: number
  reps?: number
  rir?: number
}

export interface SeriePauta {
  orden: number
  reps: number
  cargaKg: number
}

export interface EjercicioCtx {
  id: string
  nombre: string
  sesionId: string
  sets: number
  unidad: UnidadCarga | null
  /** Rango de repeticiones tal como lo escribió el coach ("8-12"), solo para avisos. */
  rango?: string
  /** La pauta. NUNCA viaja al modelo: solo la lee el resolutor cuando la persona pide copiarla. */
  seriesPrescritas?: SeriePauta[]
  cargaKg?: number
  repsDiana?: number
  series: SerieHecha[]
}

export interface BloqueCardioCtx {
  id: string
  nombre: string
  duracionMin?: number
}

export interface ParteCtx {
  id: string
  nombre: string
  /** Ya está marcada: `marcarParte` alterna, así que no se vuelve a enviar. */
  hecha: boolean
}

export interface SesionCtx {
  id: string
  nombre: string
  ejercicios: EjercicioCtx[]
  bloquesCardio?: BloqueCardioCtx[]
  preparacion?: ParteCtx[]
}

export interface ItemComidaCtx {
  alimento: string
  gramos: number | null
  medida_nombre?: string | null
  medida_cantidad?: number | null
  fuente_medida?: string | null
  estado?: string | null
}

export interface ComidaCtx {
  comida: 'desayuno' | 'almuerzo' | 'cena' | 'snack'
  items: ItemComidaCtx[]
}

export interface ContextoRegistro {
  /** Hora local del teléfono, ISO con zona: `2026-09-28T18:40:00-05:00`. */
  ahora: string
  microciclo: { id: string; numero?: number; vencido?: boolean } | null
  /** La sesión de hoy, o null si no hay una clara. */
  sesionHoyId: string | null
  sesiones: SesionCtx[]
  /** Lo que la persona tiene abierto en la app. */
  pantalla: { ejercicioId: string | null }
  /** La última serie guardada y hace cuánto: para «otra igual» y para el reenvío. */
  ultimoTocado: { ejercicioId: string; minutosAtras: number } | null
  /** Series del mismo ejercicio.id en el microciclo anterior. */
  semanaAnterior: Record<string, SerieHecha[]>
  perfil: { pesoBarraKg: number | null; verComposicion?: boolean | null }
  /** Lo que comió ayer (para «lo mismo de ayer»). Lo manda la app: el servidor no lo lee. */
  comidasAyer?: ComidaCtx[]
  /** Los ítems de la tarjeta de comida que la persona todavía no confirmó (para «no, fueron dos arepas»). */
  comidaPendiente?: ItemComidaCtx[]
  /** Lo que ya trae el check-in de hoy (para mostrar «antes → ahora»). */
  checkinHoy?: Record<string, unknown>
  /** ml de agua ya registrados hoy. */
  hidratacionHoyMl?: number
  /** Duración del cronómetro local de la sesión, en minutos. */
  cronometroMin?: number | null
}

// ---------------------------------------------------------------------------
// 3. Propuesta (salida del código)
// ---------------------------------------------------------------------------

export interface SerieDictada {
  orden: number
  cargaKg: number
  reps?: number
  rir?: number
  extra?: { reps: number; cargaKg: number }[]
}

export type OrigenCopia = 'copiado_de_pauta' | 'copiado_de_semana_anterior' | 'copiado_de_serie_anterior'

export interface RegistroSeries {
  campo: 'series'
  ejercicio_id: string
  ejercicio_nombre: string
  sesion_id: string
  valor: SerieDictada[]
  unidad: UnidadSerie
  confianza: Confianza
  origen?: OrigenCopia
  reemplaza?: { orden: number; antes: { cargaKg: number; reps?: number } }
  dicho?: { valor: number; unidad: string }
  /** «20 + 40 = 60 kg», «barra sola = 20 kg»... para que la persona lo verifique. */
  desglose?: string
  /** Texto libre visible en la tarjeta («banda roja», «+10 kg de lastre»). */
  detalle?: string
  /** Cuántas series le quedan al ejercicio después de guardar esto. */
  quedan?: number
  avisos: string[]
}

export interface RegistroSesionCampo {
  campo: 'testPost.rpeSesion' | 'testPost.duracionMin'
  sesion_id: string
  valor: number
  unidad: 'rpe' | 'min'
  confianza: Confianza
  fuente?: 'dicho'
}

/** `bloquesCardio[cd1].duracionRealMin`: lo que la persona hizo de un bloque de cardio. */
export interface RegistroCardio {
  campo: `bloquesCardio[${string}].duracionRealMin`
  sesion_id: string
  bloque_id: string
  bloque_nombre: string
  valor: number
  unidad: 'min'
  confianza: Confianza
}

/** `preparacion[pr1].hechoEn`: una parte del calentamiento o la movilidad marcada como hecha. */
export interface RegistroPreparacion {
  campo: `preparacion[${string}].hechoEn`
  sesion_id: string
  parte_id: string
  parte_nombre: string
  valor: string
  unidad: 'iso'
  confianza: Confianza
}

export interface RegistroAdherencia {
  campo: 'adherencia'
  fecha: string
  estado: 'si' | 'parcial' | 'no'
  confianza: Confianza
}

export interface RegistroCheckin {
  campo: 'checkin'
  fecha: string
  parche: Record<string, string | number>
  confianza_por_campo: Record<string, Confianza>
  antes?: Record<string, string | number | null>
  /** Dato de hoy dicho de noche que pertenece a la fila de mañana (pasos). */
  diferido?: boolean
}

export interface RegistroHidratacion {
  campo: 'hidratacion'
  fecha: string
  delta_ml: number
  confianza: Confianza
  detalle?: string
}

export interface ItemComidaPropuesto {
  alimento: string
  gramos: number | null
  medida_nombre: string | null
  medida_cantidad: number | null
  estado_asumido: string | null
  fuente_medida: string | null
  confianza: Confianza
  editable: boolean
  nota?: string
}

export interface RegistroComida {
  campo: 'comida'
  comida: 'desayuno' | 'almuerzo' | 'cena' | 'snack'
  fecha: string
  items: ItemComidaPropuesto[]
  confianza_registro: 'estimado' | 'pesado' | 'ajeno'
  aceite_g?: number | null
  sal_g?: number | null
}

export type RegistroPropuesto =
  | RegistroSeries
  | RegistroSesionCampo
  | RegistroCardio
  | RegistroPreparacion
  | RegistroAdherencia
  | RegistroCheckin
  | RegistroHidratacion
  | RegistroComida

export interface Pregunta {
  texto: string
  /** Máximo 3; más «Otro», que abre el campo. Vacío = respuesta libre. */
  opciones: string[]
  /** Qué dato falta: decide el destino o el valor. */
  campo_bloqueante: string
}

export type AccionPropuesta = 'tarjeta' | 'preguntar' | 'derivar' | 'nada'

/** Por qué no hay nada que guardar (accion `nada`). */
export type MotivoNada =
  | 'microciclo_vencido'
  | 'no_soportado'
  | 'omitidos'
  | 'consulta'
  | 'charla'
  | 'sin_datos'

export interface Propuesta {
  accion: AccionPropuesta
  sesion_id?: string
  fecha_real?: string
  registros: RegistroPropuesto[]
  pregunta?: Pregunta
  /** Lo que ya se entendió y queda esperando la respuesta a la pregunta. */
  borrador_pendiente?: Record<string, unknown>
  aviso?: string
  requiere_confirmacion_de_sesion?: boolean
  /** Lo que se oyó y NO se guarda, visible en la tarjeta. */
  descartado: { cita: string; motivo: string }[]
  /** Avisos para Bryan ("dijo fallo", "reps fuera de rango"). */
  notas_coach: string[]
  motivo?: MotivoNada | 'clinico'
  respuesta?: string
  /** Una duda secundaria que no bloquea la tarjeta. */
  seguimiento?: Pregunta
  /** Marca de la derivación clínica. */
  filtro?: 'dolor' | 'lesion' | 'sintoma' | 'crisis' | 'medicamento' | 'conducta_alimentaria' | 'animo'
  urgencia?: 'alta'
  /**
   * Lo que marcó el filtro de riesgo (`domain/praxis/riesgo.ts`), el MISMO que corre en la
   * pantalla: la Quieta con su línea de ayuda, o la pregunta de cuidado. La pantalla lo usa
   * tal cual: así una frase de pareja lleva a la 155 y no a la línea genérica.
   */
  riesgo?: { tipo: 'quieta'; linea: 'vida' | 'pareja' | 'nino' } | { tipo: 'cuidado' }
  citas_invalidas: string[]
}
