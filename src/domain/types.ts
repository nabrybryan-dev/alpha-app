import type { ObjetivoDeIntensidad } from './objetivoDeIntensidad'
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
  /**
   * Ausente cuando la nutricionista apagó la composición corporal.
   *
   * La migración 0018 esconde las cifras de composición a quien tiene un
   * antecedente de conducta alimentaria, y esa decisión tiene que llegar hasta
   * aquí: a esa persona su plan SÍ le pide perímetros, así que la tarjeta de
   * medidas se queda, pero sin la báscula.
   *
   * Era obligatorio, y por eso «Mis medidas» seguía pidiendo kilos a todo el
   * mundo aunque el check-in ya hubiera dejado de hacerlo. Opcional aquí
   * significa lo mismo que en el resto del repo: no se midió, que no es cero.
   */
  pesoKg?: number
  alturaCm: number
  perimetros: Record<string, number>
  pgPct?: number
  masaMagraKg?: number
}

/** Ver `Perfil.neat`. Los dos campos son opcionales por separado. */
export interface GastoPorPasos {
  /** kcal/día que gasta hoy, con los pasos que viene registrando. */
  kcalDia?: number
  /** kcal/día que gastaría en su meta de pasos. */
  kcalDiaEnMeta?: number
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
   * Lo que esos pasos GASTAN, en kcal al día. Es la otra mitad de
   * `pasosObjetivo`: para quien está en «déficit por NEAT», el número que decide
   * la estrategia no es cuántos pasos da, es cuántas kcal salen de darlos. Sin
   * él, «sube los pasos» es una orden sin magnitud.
   *
   * ESTIMACIÓN, NO MEDIDA — y por eso se pinta marcada como estimada. Sale de
   * una fórmula sobre los pasos que la persona registra en su check-in
   * (`km = pasos / 1450`, `kcal = 0,5 × peso × km`, el coste neto de caminar),
   * no de un acelerómetro. Los dos campos son opcionales por separado: se puede
   * saber lo que gasta hoy sin haberle fijado meta todavía.
   *
   * Viaja dentro de `perfiles.datos` (JSONB), así que no necesita migración.
   */
  neat?: GastoPorPasos
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

/**
 * Lo que el encoder de cámara midió en una serie.
 *
 * **Solo `pvPct`, y esa restricción es el diseño entero.** La pérdida de
 * velocidad es un cociente entre dos velocidades de la MISMA serie, así que la
 * escala se cancela: se calcula igual en px/s que en m/s y **no necesita diana,
 * ni milímetros, ni que la prueba de gravedad esté en verde**. Por eso puede
 * entrar hoy, mientras los m/s siguen bloqueados tras la fase 2 del motor de
 * velocidad.
 *
 * Lo que NO se guarda aquí, a propósito: `vPrimera` en m/s y el índice de
 * esfuerzo. Los dos dependen de la escala, y guardar un número que sabemos que
 * puede estar un 14-24 % desviado es guardar una conclusión falsa.
 * → `Cerebro Alpha/wiki/motor-velocidad/velocidad-vs-fuerza.md`
 */
export interface VelocidadDeSerie {
  /** Pérdida de velocidad de la serie, en puntos porcentuales. Sin escala vale igual. */
  pvPct: number
  /** `false` = medido en px/s. No invalida el %PV; sí invalidaría unos m/s. */
  hayEscala: boolean
  /** El veredicto del contrato de calidad del encoder. Una medición mala no se borra:
   *  se marca, y quien la lea decide si la usa. */
  calidad: string
  /** Inclinación máxima de la referencia durante la serie. Importa porque el %PV
   *  solo se cancela si la escala es CONSTANTE: si la referencia se movió entre la
   *  primera repetición y la última, el cociente queda contaminado. */
  inclinacionMax?: number
}

export interface SerieRegistrada {
  orden: number
  cargaKg: number
  /** La medición del encoder, si esa serie se grabó. Ausente = no se midió, que
   *  es lo normal: hoy casi nadie graba. */
  velocidad?: VelocidadDeSerie
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
  /**
   * Los mini-bloques de una técnica de intensidad: myo-reps, rest-pause, drop
   * set. Uno por bloque, en el orden en que se hicieron.
   *
   * **NO ES VOLUMEN, y esa es la mitad de su razón de ser.** La convención de
   * Alpha es que las repeticiones extra de la técnica no se cuentan: si son 10,
   * pausa y 5 más, el volumen registrado son 10 y la serie cuenta 1. Se sostiene
   * en que Bradshaw 2026 obtuvo la misma ganancia de tamaño y fuerza con ~30 %
   * menos volumen-carga, así que sumarlas hincharía el número sin hinchar el
   * estímulo. `cargaPorGrupo` cuenta con `series.length`, así que este campo no
   * puede colarse en el PANEL ni queriendo.
   *
   * **Para qué sirve entonces: para medir esfuerzo.** Cuando la prescripción
   * dice «descansa 15 segundos y saca 5 más» y salen 5 —o salen 2— ese número es
   * un RESULTADO, no una prescripción: no se puede «cumplir» como se cumple un
   * RIR objetivo. Y hace falta, porque el barrido de 186 series del 2026-08-25
   * mostró que el RIR declarado sigue a la prescripción y no a la sensación.
   *
   * **Y se guarda la observación, no la conclusión.** Sumar `10 + 5 = 15` al
   * registrar es irreversible: un `15` ya no dice si fueron 15 limpias o 10+5.
   * Con los bloques aparte, cualquier convención futura —contar todo, ponderar
   * por proximidad al fallo, dar peso fraccionado al bloque— es un recálculo y
   * no una migración. → `Cerebro Alpha/wiki/motor-decision/11-convenciones-que-la-evidencia-no-cierra.md`
   *
   * `cargaKg` solo cuando el bloque se hizo con **otra** carga, que es el caso
   * del drop set. Ausente = la misma carga de la serie base.
   */
  extra?: BloqueDeTecnica[]
}

/** Un mini-bloque de una técnica de intensidad. Ver `SerieRegistrada.extra`. */
export interface BloqueDeTecnica {
  reps: number
  cargaKg?: number
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

/**
 * Cómo hay que leer `cargaKg`.
 *
 * - `kg` — lo que marca la barra o la máquina.
 * - `total` — la suma de los dos lados (mancuernas sumadas, lastre + cuerpo).
 * - `por lado` — esa carga en cada pierna/lado; se mueve el doble.
 * - `por mano` — esa carga en cada mancuerna.
 *
 * No es cosmético: confundir `por mano` con `total` duplica o parte en dos la
 * carga cuando se progresa.
 */
export type UnidadCarga = 'kg' | 'total' | 'por lado' | 'por mano'


/**
 * Los dos caminos pre-autorizados de un ejercicio para el bucle del día.
 *
 * Aprobados por el coach el 2026-08-25 (supuesto de ondulación flexible §2).
 * La idea entera: el ajuste del día no se improvisa — el coach escribe POR
 * ADELANTADO qué puede pasar si el día viene mejor o peor de lo esperado, y el
 * bucle solo decide cuál de los dos caminos ya escritos se pisa.
 */
export interface EscenarioVerde {
  /** Cuánto sube el escalón autorizado. Sin definir: no se toca la carga. */
  deltaCargaKg?: number
  /** Si el día bueno autoriza una serie más. */
  serieExtra?: boolean
  /**
   * El techo, OBLIGATORIO. La carga que no se pasa ni con el mejor día del
   * bloque. Es lo que hace que «autorizado por adelantado» signifique algo:
   * un verde sin techo es un cheque en blanco, y eso no es autorizar.
   */
  techoCargaKg: number
}

export interface EscenarioRojo {
  /** Cuántos escalones de RIR se sueltan (1 o 2, como las bandas de PRS). */
  deltaRir: number
  /** Si el día malo recorta la última serie. */
  quitarUltimaSerie?: boolean
  /**
   * El suelo de RIR del ejercicio, OBLIGATORIO (I-13). Viaja escrito aquí para
   * que el camino rojo lleve consigo la regla que protege al asesorado: la
   * prescripción base nunca debe estar por debajo de este número.
   */
  sueloRir: number
}

export interface EscenariosDelDia {
  verde: EscenarioVerde
  rojo: EscenarioRojo
}

export interface EjercicioPrescrito {
  id: string
  categoria: string
  nombre: string
  cues: string
  /** Frase que ve el asesorado. Desde el 2026-08-09 **se compone** desde los
   *  campos de abajo con `componerPrescripcion` (`domain/prescripcion.ts`);
   *  antes era texto libre y la carga vivía dentro de la frase. */
  prescripcion: string
  /** La carga, ya fuera de la frase. Sin definir = la prescripción no lleva
   *  kilos (porcentajes, «REGISTRA TU CARGA», tiempo, peso corporal). **No es
   *  lo mismo que 0**: 0 sería carga cero, esto es «no hay dato». */
  cargaKg?: number
  unidadCarga?: UnidadCarga
  /** La prosa del coach, separada de los números. Se transporta tal cual: ni la
   *  progresión ni la composición la reescriben nunca. */
  notaCoach?: string
  descansoMin: number
  sets: number
  rango: string
  repsDiana: number
  /**
   * El objetivo de intensidad: un RIR, o `'FALLO'`.
   *
   * **`RIR 0` y `FALLO` no son lo mismo**, y por eso esto no es un `number`.
   * `RIR 0` es la última repetición completa, con la parcial en reserva; `FALLO`
   * es la instrucción de meterse en esa parcial. Ver `objetivoDeIntensidad.ts`,
   * que es donde vive la regla y las tres operaciones que la respetan.
   */
  rirObjetivo: ObjetivoDeIntensidad
  /** Ondulación del microciclo: reps a la baja y carga al alza, set a set.
   *  Sin definir, todas las series comparten `repsDiana` y `rirObjetivo` — que
   *  es como quedaban los microciclos antes de que la ondulación se guardara. */
  seriesPrescritas?: SeriePrescrita[]
  /** Los dos caminos pre-autorizados para el bucle del día. Sin definir, el
   *  bucle observa pero no puede proponer nada: sin camino escrito no hay
   *  ajuste — la pre-autorización es el mecanismo, no un adorno. */
  escenarios?: EscenariosDelDia
  /**
   * Pérdida de velocidad objetivo de la serie, en puntos porcentuales.
   *
   * Es lo que convierte el `pvPct` medido en una señal: un %PV suelto dice cuánto
   * se frenó la barra, no si eso fue lo pedido. La banda para la clientela de
   * Alpha —composición corporal— es **20-35 %**, no los 10-20 % de deportista.
   * → `Cerebro Alpha/wiki/motor-decision/03-vbt-perdida-velocidad.md`
   *
   * Sin definir, la velocidad no informa y manda el RIR.
   */
  pvObjetivo?: number
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
  /**
   * El día LOCAL en que esta sesión se tocó por primera vez (`AAAA-MM-DD`).
   *
   * **No es lo mismo que `dia`, y por eso son dos campos.** `dia` es el hueco de
   * la semana que el plan pidió —"MARTES"—; `fecha` es el martes concreto en que
   * la persona apareció. Medido el 2026-09-04 sobre la cartera entera: de 607
   * sesiones, `dia` estaba puesto en 312 y **ninguna era una fecha**. Sin ella no
   * se puede emparejar el check-in de un día con la sesión de ese día, que es el
   * cruce del que vive `bucleDelDia`.
   *
   * **La escribe la app, no el plan, y una sola vez:** la pone la primera acción
   * que ocurre dentro de la sesión —marcar un calentamiento, anotar una serie o
   * guardar el test— y a partir de ahí no se toca. Si alguien abre la sesión el
   * martes y anota el jueves, manda el martes: es el mismo criterio que la casa
   * ya usaba con la primera marca de `preparacion`, que hasta hoy era el único
   * rastro fechado que dejaba el asesorado.
   *
   * Se compara carácter a carácter con `CheckinDiario.fecha` porque las dos
   * salen de `hoyIso()`: fecha local del dispositivo, nunca UTC.
   */
  fecha?: string
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
  /**
   * Por qué esta persona no puede comer esto. OBLIGATORIO.
   *
   * La PR #57 puso la pantalla a exigirlo y `motivoDeVeto.ts` a definir qué
   * cuenta como motivo válido. Faltaba cerrar la puerta AQUÍ: mientras el campo
   * fuera opcional, cualquier sitio nuevo podía llamar a `vetar()` sin él y
   * `sync.ts` lo subía como `null` — que es exactamente lo que tumbó la 0040 la
   * primera vez.
   *
   * Con esto, la migración se puede aplicar sin depender de que nadie se olvide:
   * el compilador señala cada sitio que veta y obliga a traer un motivo. No es
   * una validación —de eso se encarga `porQueNoValeElMotivo`— es la garantía de
   * que la validación no se puede saltar por descuido.
   */
  motivo: string
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
