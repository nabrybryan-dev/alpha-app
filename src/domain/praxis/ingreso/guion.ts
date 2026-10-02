/**
 * El guion MIXTO del cuestionario de ingreso de la landing, llevado por Praxis.
 *
 * FORMA (Bryan, 2-oct-2026): lo abierto se HABLA (`voz`), lo cerrado se TOCA (`toque`), y al final la
 * persona revisa el formulario ya lleno y confirma. Nada se envía sin ese visto bueno.
 *
 * REGLA DURA. Todo dato de salud (el PAR-Q, lesiones, medicación, alergias, antecedente alimentario, ciclo,
 * ejercicios limitados) es `toque` con un sí/no explícito. Nunca se deduce de lo que la persona dijo
 * hablando: si en la voz asoma algo de salud, `extraer.ts` lo MARCA y aquí se convierte en la pregunta que
 * hay que hacer con toque (`PREGUNTAS_POR_TEMA`); el campo no se rellena. El texto de detalle de un sí
 * (qué lesión, qué medicamento) se escribe con teclado: es un `toque` con `detalle: 'teclado'`.
 *
 * DE DÓNDE SALE LA LISTA. Unión de tres fuentes, solo lectura:
 *  - `alpha-app/src/domain/nutricion/importarIntake.ts` (lo que el importador lee del intake),
 *  - `cerebro-alpha/agentes/cribado.py` (los tres `parq_*`, `medicacion`, `edad`),
 *  - el corpus sintético `1000_encuestas_complejas_v2.json` (`client_intake.answers`, 1000 encuestas).
 * Las opciones de un campo son las que aparecen en el corpus. `conocimiento` dice cuánto se sabe de ellas:
 *  - 'completas': el corpus las agota (p. ej. 8 objetivos, 6 tiempos de entreno, 7 trabajos);
 *  - 'parciales': las del corpus son una MUESTRA (p. ej. 6 países) o la etiqueta exacta no se conoce;
 *    la landing real puede tener más;
 *  - 'ninguna': no hay lista conocida (texto o número libre).
 * `enCorpus: false` = lo pide `importarIntake.ts`/`cribado.py` pero ninguna de las 1000 encuestas lo trae, así
 * que el simulacro no puede medirlo.
 */

export type Modo = 'voz' | 'toque'
export type TipoCampo = 'opcion' | 'numero' | 'texto' | 'si_no' | 'fecha'
export type ConocimientoOpciones = 'completas' | 'parciales' | 'ninguna'

export type TurnoId = 'sobre_ti' | 'objetivo' | 'historia_entreno' | 'trabajo_horarios' | 'comida'

export interface CampoIngreso {
  id: string
  etiqueta: string
  modo: Modo
  tipo: TipoCampo
  /** Dato de salud: SIEMPRE `toque`, nunca se rellena desde la voz. */
  salud: boolean
  opciones?: readonly string[]
  conocimiento: ConocimientoOpciones
  /** Solo voz: el turno hablado donde se pregunta. */
  turno?: TurnoId
  /** Solo número: unidad y rango plausible (fuera del rango, la voz se descarta y se pregunta). */
  unidad?: string
  rango?: readonly [number, number]
  /** Solo toque: la pregunta tal como se dice y se muestra. */
  pregunta?: string
  /** Un sí en un toque de salud abre este detalle, que se escribe con teclado. */
  detalle?: 'teclado'
  /** Solo se pregunta si esto se cumple (id de otro campo y su valor). */
  condicion?: { campo: string; valor: string }
  /** ¿Lo trae alguna de las 1000 encuestas del corpus? */
  enCorpus: boolean
  /** Solo voz: cómo entender el campo (va al prompt del extractor). */
  ayuda?: string
  nota?: string
}

export interface TurnoVoz {
  id: TurnoId
  /** Lo que dice Praxis. Español colombiano, en tú, corto. */
  pregunta: string
  campos: readonly string[]
}

const SI_NO = ['Sí', 'No'] as const

export const OBJETIVOS = [
  'Volver a entrenar tras una parada',
  'Fuerza y Potencia (Deportista)',
  'Pérdida de grasa',
  'Salud general',
  'Recomposición corporal',
  'Rendimiento y Fuerza Máxima',
  'Salud, evitar cirugías',
  'Hipertrofia / estética',
] as const

export const TIEMPOS_ENTRENANDO = [
  'Menos de 6 meses',
  '6 meses a 1 año',
  '1 a 2 años',
  '2 a 3 años',
  'Más de 3 años ininterrumpidos',
  'Más de 1 año',
] as const

export const TIPOS_TRABAJO = [
  'oficina sentado 9 h',
  'obra, cargando peso',
  'profesor de pie 6 h',
  'teletrabajo',
  'conduzco todo el día',
  'turnos rotativos de enfermería',
  'madre a tiempo completo',
] as const

export const NIVELES = ['Principiante', 'Intermedio', 'Avanzado'] as const

/** `importarIntake.ts` mapea por subcadena ('mayoría', 'mitad'/'veces', 'compro'/'domicilio'): solo una etiqueta exacta se conoce. */
export const COCINA_O_COMPRA = [
  'Cocino la mayoría de mis comidas',
  'Cocino la mitad y compro la otra mitad',
  'Casi siempre compro hecho o pido domicilio',
] as const

const MEDIDAS_CINTA = ['medida_cuello_cm', 'medida_cintura_natural_cm', 'medida_cintura_ombligo_cm', 'medida_cadera_cm'] as const

export const CAMPOS_INGRESO: readonly CampoIngreso[] = [
  // ───────────── VOZ: lo abierto, agrupado en cinco turnos ─────────────
  {
    id: 'ciudad', etiqueta: 'Ciudad', modo: 'voz', tipo: 'texto', salud: false, conocimiento: 'ninguna',
    turno: 'sobre_ti', enCorpus: true,
    nota: 'El corpus trae 12 ciudades dependientes del país; el texto se guarda tal cual lo dijo.',
  },
  {
    id: 'edad', etiqueta: 'Edad', modo: 'voz', tipo: 'numero', salud: false, conocimiento: 'ninguna',
    turno: 'sobre_ti', unidad: 'años', rango: [10, 100], enCorpus: true,
    nota: 'cribado.py usa `edad`; importarIntake.ts lee `fecha_nacimiento`. Hay que decidir cuál pide la landing real.',
  },
  {
    id: 'altura_cm', etiqueta: 'Altura', modo: 'voz', tipo: 'numero', salud: false, conocimiento: 'ninguna',
    turno: 'sobre_ti', unidad: 'cm', rango: [120, 230], enCorpus: true,
  },
  {
    id: 'peso_actual_kg', etiqueta: 'Peso actual', modo: 'voz', tipo: 'numero', salud: false, conocimiento: 'ninguna',
    turno: 'sobre_ti', unidad: 'kg', rango: [30, 250], enCorpus: true,
  },
  {
    id: 'objetivo_principal', etiqueta: 'Objetivo principal', modo: 'voz', tipo: 'opcion', salud: false,
    opciones: OBJETIVOS, conocimiento: 'completas', turno: 'objetivo', enCorpus: true,
    ayuda: 'lo que quiere lograr; elegir la opción que mejor lo resume solo si es clara',
  },
  {
    id: 'parte_a_mejorar', etiqueta: 'Qué quiere mejorar', modo: 'voz', tipo: 'texto', salud: false, conocimiento: 'ninguna',
    turno: 'objetivo', enCorpus: true,
    nota: 'Texto libre mezclado con categorías cortas («Espalda y postura»). Si lo dicho trae dolor o lesión, esa parte NO se guarda aquí: se marca para el toque de salud.',
    ayuda: 'zona del cuerpo, aspecto o meta concreta que quiere mejorar, con sus palabras; nunca un dolor ni una lesión',
  },
  {
    id: 'peso_objetivo_kg', etiqueta: 'Peso al que quiere llegar', modo: 'voz', tipo: 'numero', salud: false, conocimiento: 'ninguna',
    turno: 'objetivo', unidad: 'kg', rango: [30, 250], enCorpus: true,
    ayuda: 'el peso al que quiere llegar (no el actual)',
  },
  {
    id: 'tiempo_entrenando', etiqueta: 'Hace cuánto entrena', modo: 'voz', tipo: 'opcion', salud: false,
    opciones: TIEMPOS_ENTRENANDO, conocimiento: 'completas', turno: 'historia_entreno', enCorpus: true,
    nota: '«Más de 1 año» y «1 a 2 años» se solapan en el corpus: ambigüedad de la propia encuesta.',
    ayuda: 'cuánto tiempo lleva entrenando de forma regular',
  },
  {
    id: 'nivel_fuerza', etiqueta: 'Nivel de fuerza', modo: 'voz', tipo: 'opcion', salud: false,
    opciones: NIVELES, conocimiento: 'parciales', turno: 'historia_entreno', enCorpus: true,
    nota: 'En el corpus viene como «Avanzado» o «Avanzado - 130kg Sentadilla, 63kg Press Banca»; 97 de 1000 vienen vacíos.',
    ayuda: 'nivel según lo que levanta o su experiencia real; solo si lo dice o se deduce de sus pesos dichos',
  },
  {
    id: 'marcas_fuerza', etiqueta: 'Marcas de fuerza', modo: 'voz', tipo: 'texto', salud: false, conocimiento: 'ninguna',
    turno: 'historia_entreno', enCorpus: true,
    nota: 'Es la cola «130kg Sentadilla, 63kg Press Banca» de nivel_fuerza, separada para poder medirla.',
    ayuda: 'los pesos que levanta (ej. «130 kilos en sentadilla»), con sus palabras',
  },
  {
    id: 'nivel_autopercibido', etiqueta: 'Cómo se ve a sí misma/o', modo: 'voz', tipo: 'opcion', salud: false,
    opciones: NIVELES, conocimiento: 'parciales', turno: 'historia_entreno', enCorpus: true,
    nota: 'Solo aparece el valor «Avanzado» (164 de 1000); las otras etiquetas se suponen.',
    ayuda: 'cómo se describe ella o él mismo de nivel, con sus palabras (principiante, intermedio, avanzado)',
  },
  {
    id: 'tipo_trabajo', etiqueta: 'Trabajo', modo: 'voz', tipo: 'opcion', salud: false,
    opciones: TIPOS_TRABAJO, conocimiento: 'completas', turno: 'trabajo_horarios', enCorpus: true,
    ayuda: 'a qué se dedica y cómo es su jornada de trabajo',
  },
  {
    id: 'dia_tipo_alimentacion', etiqueta: 'Cómo es su día (horarios y comida)', modo: 'voz', tipo: 'texto', salud: false,
    conocimiento: 'ninguna', turno: 'trabajo_horarios', enCorpus: true,
    nota: 'Solo 170 de 1000 lo traen; son frases de disponibilidad («turnos de 24 h, entreno dos días»).',
    ayuda: 'cómo es su día o su semana: turnos, horarios, cuándo puede entrenar o comer',
  },
  {
    id: 'vasos_agua', etiqueta: 'Agua al día', modo: 'voz', tipo: 'texto', salud: false, conocimiento: 'ninguna',
    turno: 'comida', enCorpus: true,
    nota: 'Solo 203 de 1000 lo traen; el corpus tiene 3 respuestas («2 o 3», «ni idea», «no tomo agua pura coca cola»).',
    ayuda: 'cuánta agua toma al día, tal como lo dice',
  },
  {
    id: 'cocina_o_compra', etiqueta: 'Cocina o compra hecho', modo: 'voz', tipo: 'opcion', salud: false,
    opciones: COCINA_O_COMPRA, conocimiento: 'parciales', turno: 'comida', enCorpus: false,
    nota: 'Lo lee importarIntake.ts por subcadena; solo «Cocino la mayoría de mis comidas» está literal ahí. Las otras dos etiquetas son una suposición.',
    ayuda: 'si cocina sus comidas o las compra hechas',
  },

  // ───────────── TOQUE: lo cerrado ─────────────
  {
    id: 'genero', etiqueta: 'Sexo', modo: 'toque', tipo: 'opcion', salud: false, opciones: ['Femenino', 'Masculino'],
    conocimiento: 'completas', pregunta: '¿Eres mujer u hombre?', enCorpus: true,
  },
  {
    id: 'pais', etiqueta: 'País', modo: 'toque', tipo: 'opcion', salud: false,
    opciones: ['Colombia', 'Chile', 'España', 'México', 'Argentina', 'Perú'], conocimiento: 'parciales',
    pregunta: '¿En qué país vives?', enCorpus: true,
  },
  {
    id: 'dias_por_semana', etiqueta: 'Días por semana', modo: 'toque', tipo: 'opcion', salud: false,
    opciones: ['1', '2', '3', '4', '5', '6', '7'], conocimiento: 'parciales',
    pregunta: '¿Cuántos días a la semana puedes entrenar?', enCorpus: true,
    nota: 'El corpus trae 2 a 6, y 102 de 1000 con basura («todos los q pueda bro», «los que salgan», vacío): el toque obliga a elegir un número.',
  },
  {
    id: 'cadencia_revision', etiqueta: 'Cada cuántos días revisamos', modo: 'toque', tipo: 'opcion', salud: false,
    opciones: ['8', '15'], conocimiento: 'completas', pregunta: '¿Cada cuánto quieres que revisemos tu plan: 8 o 15 días?', enCorpus: true,
  },
  {
    id: 'fecha_nacimiento', etiqueta: 'Fecha de nacimiento', modo: 'toque', tipo: 'fecha', salud: false, conocimiento: 'ninguna',
    pregunta: '¿Cuándo naciste?', enCorpus: false,
    nota: 'La pide importarIntake.ts; el corpus trae `edad` en su lugar. Si la landing real pide fecha, `edad` sale del toque y no de la voz.',
  },
  ...MEDIDAS_CINTA.map(
    (id): CampoIngreso => ({
      id, etiqueta: id.replace('medida_', '').replace('_cm', '').replace(/_/g, ' '), modo: 'toque', tipo: 'numero', salud: false,
      conocimiento: 'ninguna', unidad: 'cm', rango: [20, 200], pregunta: 'Con la cinta: ¿cuánto marca?', enCorpus: false,
      nota: 'Los pide importarIntake.ts (US Navy); ninguna encuesta del corpus los trae. Se miden con cinta: teclado numérico, no voz.',
    }),
  ),

  // ───────────── TOQUE: SALUD (sí/no explícito, nunca desde la voz) ─────────────
  {
    id: 'parq_enfermedad_cardiaca', etiqueta: 'PAR-Q: corazón', modo: 'toque', tipo: 'si_no', salud: true, opciones: SI_NO,
    conocimiento: 'completas', pregunta: '¿Algún médico te ha dicho que tienes un problema del corazón y que solo hagas ejercicio con supervisión?', enCorpus: true,
  },
  {
    id: 'parq_medicamento_presion', etiqueta: 'PAR-Q: medicamento para la presión', modo: 'toque', tipo: 'si_no', salud: true, opciones: SI_NO,
    conocimiento: 'completas', pregunta: '¿Tomas medicamentos para la presión o el corazón?', enCorpus: true,
  },
  {
    id: 'parq_huesos_articulaciones', etiqueta: 'PAR-Q: huesos o articulaciones', modo: 'toque', tipo: 'si_no', salud: true, opciones: SI_NO,
    conocimiento: 'completas', pregunta: '¿Tienes algún problema de huesos o articulaciones que el ejercicio pueda empeorar?', enCorpus: true,
  },
  {
    id: 'lesiones', etiqueta: 'Lesiones', modo: 'toque', tipo: 'si_no', salud: true, opciones: SI_NO, conocimiento: 'completas',
    pregunta: '¿Tienes o has tenido alguna lesión?', detalle: 'teclado', enCorpus: true,
    nota: 'En el corpus es texto («No», «Ninguna», «Hernia discal L5-S1»): el sí/no se toca y el detalle se escribe.',
  },
  {
    id: 'ejercicios_limitados', etiqueta: 'Ejercicios que no puede hacer', modo: 'toque', tipo: 'si_no', salud: true, opciones: SI_NO,
    conocimiento: 'completas', pregunta: '¿Hay ejercicios que tu médico o fisio te haya prohibido?', detalle: 'teclado',
    condicion: { campo: 'parq_huesos_articulaciones', valor: 'Sí' }, enCorpus: true,
    nota: 'En el corpus solo existe cuando parq_huesos_articulaciones es Sí (338 de 1000).',
  },
  {
    id: 'medicacion', etiqueta: 'Medicación', modo: 'toque', tipo: 'si_no', salud: true, opciones: SI_NO, conocimiento: 'completas',
    pregunta: '¿Tomas algún medicamento?', detalle: 'teclado',
    condicion: { campo: 'parq_medicamento_presion', valor: 'Sí' }, enCorpus: true,
    nota: 'En el corpus solo existe cuando parq_medicamento_presion es Sí (180 de 1000). cribado.py la usa para la zona mínima (C-43, C-58): en la landing real conviene preguntarla siempre.',
  },
  {
    id: 'alergias_restricciones', etiqueta: 'Alergias o restricciones', modo: 'toque', tipo: 'si_no', salud: true, opciones: SI_NO,
    conocimiento: 'completas', pregunta: '¿Tienes alguna alergia o algo que no puedas comer?', detalle: 'teclado', enCorpus: false,
    nota: 'importarIntake.ts: el texto viaja entero y lo codifica la nutricionista; no se interpreta.',
  },
  {
    id: 'tca_historia', etiqueta: 'Antecedente alimentario', modo: 'toque', tipo: 'si_no', salud: true, opciones: SI_NO,
    conocimiento: 'completas', pregunta: '¿Has tenido alguna vez dificultades con la comida (atracones, restricciones extremas)?', enCorpus: false,
    nota: 'importarIntake.ts lo lee como señal; ninguna encuesta del corpus lo trae.',
  },
  {
    id: 'solo_mujeres_ciclo', etiqueta: 'Ciclo menstrual', modo: 'toque', tipo: 'opcion', salud: true,
    opciones: ['regular', 'irregular', 'ausente', 'no aplica'], conocimiento: 'completas',
    pregunta: '¿Cómo es tu ciclo?', condicion: { campo: 'genero', valor: 'Femenino' }, enCorpus: false,
  },
]

export const TURNOS_VOZ: readonly TurnoVoz[] = [
  {
    id: 'sobre_ti',
    pregunta: 'Cuéntame un poco de ti: ¿de qué ciudad eres, cuántos años tienes, cuánto mides y cuánto pesas hoy?',
    campos: ['ciudad', 'edad', 'altura_cm', 'peso_actual_kg'],
  },
  {
    id: 'objetivo',
    pregunta: '¿Qué quieres lograr con Alpha? Cuéntame qué parte de ti quieres mejorar y, si lo tienes claro, cuánto te gustaría pesar.',
    campos: ['objetivo_principal', 'parte_a_mejorar', 'peso_objetivo_kg'],
  },
  {
    id: 'historia_entreno',
    pregunta: 'Hablemos de tu entreno: ¿hace cuánto entrenas, cómo te ves de nivel y qué pesos manejas en sentadilla o press banca?',
    campos: ['tiempo_entrenando', 'nivel_fuerza', 'marcas_fuerza', 'nivel_autopercibido'],
  },
  {
    id: 'trabajo_horarios',
    pregunta: 'Cuéntame de tu trabajo y tus horarios: ¿qué haces y cómo es un día normal tuyo?',
    campos: ['tipo_trabajo', 'dia_tipo_alimentacion'],
  },
  {
    id: 'comida',
    pregunta: '¿Cómo comes? Dime si cocinas tú o compras hecho, y cuánta agua tomas al día.',
    campos: ['cocina_o_compra', 'vasos_agua'],
  },
]

/** Lo que dice Praxis al pasar de la voz a los toques y de los toques a la revisión. */
export const FRASES_DE_PASO = {
  aToques: 'Gracias. Ahora unas preguntas rápidas: solo toca la respuesta.',
  aSalud: 'Ahora las de salud. Cada una la contestas tú con un toque, sí o no.',
  aRevision: 'Listo. Mira cómo quedó tu formulario y corrige lo que haga falta. No se envía nada hasta que lo confirmes.',
} as const

/** Temas de salud que `extraer.ts` puede marcar al oírlos, y los toques que se les hacen. */
export const TEMAS_SALUD = ['lesion', 'dolor', 'medicacion', 'cardiaco', 'alimentario', 'alergia', 'ciclo', 'otro'] as const
export type TemaSalud = (typeof TEMAS_SALUD)[number]

export const PREGUNTAS_POR_TEMA: Record<TemaSalud, readonly string[]> = {
  lesion: ['lesiones', 'parq_huesos_articulaciones'],
  dolor: ['lesiones', 'parq_huesos_articulaciones'],
  medicacion: ['medicacion', 'parq_medicamento_presion'],
  cardiaco: ['parq_enfermedad_cardiaca', 'parq_medicamento_presion'],
  alimentario: ['tca_historia'],
  alergia: ['alergias_restricciones'],
  ciclo: ['solo_mujeres_ciclo'],
  otro: ['parq_enfermedad_cardiaca', 'parq_medicamento_presion', 'parq_huesos_articulaciones', 'lesiones'],
}

const PORID = new Map(CAMPOS_INGRESO.map((c) => [c.id, c]))
export const campoPorId = (id: string): CampoIngreso | undefined => PORID.get(id)

export const camposDeVoz = (): CampoIngreso[] => CAMPOS_INGRESO.filter((c) => c.modo === 'voz')
export const camposDeSalud = (): CampoIngreso[] => CAMPOS_INGRESO.filter((c) => c.salud)

/** Campos que hay que preguntar con toque después de oír estos temas de salud (sin repetir, en orden). */
export function toquesPorTemas(temas: readonly TemaSalud[]): string[] {
  const vistos = new Set<string>()
  for (const t of temas) for (const id of PREGUNTAS_POR_TEMA[t]) vistos.add(id)
  return [...vistos]
}

/** Campos que se preguntan a esta persona, dadas las respuestas ya tocadas (aplica `condicion`). */
export function camposAplicables(modo: Modo, tocados: Readonly<Record<string, string>>): CampoIngreso[] {
  return CAMPOS_INGRESO.filter(
    (c) => c.modo === modo && (!c.condicion || tocados[c.condicion.campo] === c.condicion.valor),
  )
}
