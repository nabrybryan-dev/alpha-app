/**
 * Extracciones GRABADAS: lo que Haiku debe devolver (citas y etiquetas) para
 * casos del corpus, escrito a mano. Sirven para probar los resolutores sin
 * modelo, de forma determinista (DISENO §6.2: «Resoluciones: vitest, sobre
 * extracciones fijas grabadas. Rompen el CI»), y para correr el evaluador con
 * `--grabadas` cuando no hay CLI o se quiere aislar el código del modelo.
 *
 * Toda cita aquí es una subcadena literal de la frase del caso (un test lo
 * comprueba).
 */
import type {
  BloqueExtraido, EjercicioExtraido, Extraccion, Intencion, PorCarga, ReservaExtraida, SenalEntreno, TipoCarga,
} from '../../src/domain/praxis/registro/tipos.ts'

const SIN_RESERVA: ReservaExtraida = { tipo: 'no_dicha', cita: null }

function b(o: {
  n?: string; ord?: string; reps?: string | null; tipo?: TipoCarga; valor?: string; unidad?: string; por?: PorCarga
  discos?: { cantidad: string; peso: string }[]; delta?: string; reserva?: ReservaExtraida; cal?: boolean
  extra?: { reps: string; carga: string | null }[]; sen?: SenalEntreno[]
}): BloqueExtraido {
  return {
    n_series: o.n ?? null,
    ordinal: o.ord ?? null,
    reps: o.reps === undefined ? null : o.reps,
    carga: {
      tipo: o.tipo ?? (o.valor ? 'absoluta' : 'no_dicha'),
      valor: o.valor ?? null,
      unidad_cita: o.unidad ?? null,
      discos: o.discos ?? null,
      delta: o.delta ?? null,
      por: o.por ?? 'no_dicho',
    },
    reserva: o.reserva ?? SIN_RESERVA,
    es_calentamiento: o.cal ?? false,
    extra: o.extra ?? [],
    senales: o.sen ?? [],
  }
}

function e(cita: string | null, bloques: BloqueExtraido[], implicito: EjercicioExtraido['ejercicio']['implicito'] = 'no', cuando: string | null = null): EjercicioExtraido {
  return { ejercicio: { cita, ref_sugerida: null, implicito }, bloques, cuando }
}

function X(o: Partial<Extraccion> & { entreno?: EjercicioExtraido[]; intencion?: Intencion[] }): Extraccion {
  return {
    intencion: o.intencion ?? ['entreno'],
    entreno: o.entreno ?? [],
    comida: o.comida ?? null,
    vida: o.vida ?? null,
    sesion: o.sesion ?? null,
    correccion: o.correccion ?? null,
    aclaracion: o.aclaracion ?? null,
    clinico: o.clinico ?? { hay: false, cita: null },
    fuera_de_alcance: o.fuera_de_alcance ?? false,
  }
}

const reserva = (cita: string): ReservaExtraida => ({ tipo: 'reserva_dicha', cita })
const mano = { unidad: 'en cada mano', por: 'mano' as const }
const consulta = X({ intencion: ['consulta'], fuera_de_alcance: true })

const vidaVacia = {
  sueno_horas: null, hora_acostarse: null, hora_levantarse: null, calidad_sueno: null, pasos: null,
  actividad_sin_numero: null, agua: null, escalas: [], senales: [] as ('aproximado' | 'no_recuerda')[],
}

export const EXTRACCIONES_GRABADAS: Record<string, Extraccion> = {
  'CE-001': X({ entreno: [e('sentadilla', [b({ reps: '12', valor: '40', unidad: 'kilos' })])] }),
  'CE-002': X({ entreno: [e('prensa', [b({ reps: '15', valor: '140' })])] }),
  'CE-003': X({ entreno: [e('jalón al pecho', [b({ n: 'tres', reps: 'doce', valor: 'cuarenta y cinco' })])] }),
  'CE-004': X({ entreno: [e('inclinado', [b({ n: 'dos', reps: 'doce', valor: '20', ...mano })])] }),
  'CE-005': X({
    entreno: [e('laterales', [
      b({ reps: '10', valor: '8', ...mano }), b({ reps: '8', valor: '8', ...mano }), b({ reps: '6', valor: '8', ...mano }),
    ])],
  }),
  'CE-006': X({ entreno: [e('sentadilla', [b({ n: 'tres', reps: 'quince', tipo: 'barra_sola' })])] }),
  'CE-007': X({ entreno: [e('sentadilla', [b({ n: 'tres', reps: 'quince', tipo: 'barra_sola' })])] }),
  'CE-008': X({ entreno: [e('banco', [b({ reps: 'ocho', valor: '135', unidad: 'libras' })])] }),
  'CE-009': X({
    entreno: [e('banco', [b({ reps: 'seis', tipo: 'discos', discos: [{ cantidad: 'dos', peso: '10' }], por: 'lado', unidad: 'por lado' })])],
  }),
  'CE-010': X({ entreno: [e('sentadilla', [b({ n: 'tres', reps: 'diez', valor: 'quince' })])] }),
  'CE-011': X({ entreno: [e('sentadilla', [b({ tipo: 'copiar_pauta' })])] }),
  'CE-012': X({ entreno: [e('banco', [b({ tipo: 'copiar_pauta' })]), e('inclinado', [b({ tipo: 'copiar_pauta' })])] }),
  'CE-013': X({ entreno: [e('remo con barra', [b({ tipo: 'copiar_semana_anterior' })])] }),
  'CE-014': X({ entreno: [e(null, [b({ ord: 'otra', tipo: 'copiar_serie_anterior' })], 'anterior')] }),
  'CE-015': X({ entreno: [e(null, [b({ ord: 'la tercera', reps: '8', tipo: 'relativa', delta: 'le subí cinco kilos' })], 'anterior')] }),
  'CE-016': X({ entreno: [e('banco', [b({ reps: '8', valor: '60', reserva: reserva('como 2 en reserva'), sen: ['aproximado'] })])] }),
  'CE-017': X({ entreno: [e('sentadilla', [b({ ord: 'la última', reps: '8', valor: '70', reserva: { tipo: 'fallo', cita: 'llegué al fallo' } })])] }),
  'CE-018': X({ entreno: [e('banco', [b({ reps: '6', valor: '65', reserva: reserva('una máximo'), sen: ['maximo_o_minimo'] })])] }),
  'CE-019': X({ entreno: [e('prensa', [b({ reps: '15', valor: '140', reserva: reserva('como 6 más'), sen: ['aproximado'] })])] }),
  'CE-020': X({ entreno: [e('jalón', [b({ n: 'las tres', reps: '12', valor: '45', reserva: { tipo: 'rir_de_pauta', cita: 'el RIR el que me pusieron' } })])] }),
  'CE-021': X({
    entreno: [e('sentadilla', [
      b({ ord: 'la primera', reps: '10', valor: '60', reserva: reserva('3') }),
      b({ ord: 'la segunda', reps: '10', valor: '60', reserva: reserva('2') }),
      b({ ord: 'la tercera', reps: '10', valor: '60', reserva: reserva('1 de reserva') }),
    ])],
  }),
  'CE-022': X({ entreno: [e('peso muerto rumano', [b({ reps: 'diez', valor: 'cincuenta y cinco', sen: ['autocorreccion'] })])] }),
  'CE-023': X({ entreno: [e('sentadilla', [b({ reps: 'doce', valor: 'cuarenta', unidad: 'kilos', sen: ['autocorreccion'] })])] }),
  'CE-024': X({ entreno: [e('presa banca', [b({ reps: 'seis', valor: 'setenta' })])] }),
  'CE-025': X({ entreno: [e('remo', [b({ reps: 'diez', valor: '50', sen: ['no_recuerda', 'aproximado'] })])] }),
  'CE-026': X({ entreno: [e('sentadilla búlgara', [b({ n: 'tres', reps: 'diez', valor: 'doce y medio', ...mano })])] }),
  'CE-027': X({ entreno: [e('sentadilla', [b({ n: 'tres', reps: 'diez', valor: 'doce' })])] }),
  'CE-028': X({ entreno: [e(null, [b({ reps: '10', valor: '14' })], 'pantalla')] }),
  'CE-029': X({ entreno: [e(null, [b({ reps: '12', valor: '40' })], 'desconocido')] }),
  'CE-030': X({ entreno: [e('remo con barra', [b({ reps: '10', valor: '50' })])] }),
  'CE-031': X({ entreno: [e('remo pero con mancuerna', [b({ n: 'tres', reps: 'doce', valor: 'veinte' })])] }),
  'CE-032': X({ entreno: [e('remo con mancuerna', [b({ n: 'tres', reps: 'doce', valor: 'veinte' })])] }),
  'CE-033': X({ entreno: [e('hack squat', [b({ reps: '12', valor: '100' })])] }),
  'CE-034': X({ entreno: [e('isquios sentado', [b({ n: 'tres veces', reps: '12', valor: '35' })])] }),
  'CE-035': X({ entreno: [e('gemelos', [b({ n: 'cuatro series', reps: '15', valor: '40' })])] }),
  'CE-036': X({ entreno: [e('curl', [b({ n: 'tres', reps: 'diez', valor: '12' })])] }),
  'CE-037': X({
    entreno: [e('fondos', [b({ reps: '12', tipo: 'corporal' }), b({ reps: '10', tipo: 'corporal' }), b({ reps: '8', tipo: 'corporal' })])],
  }),
  'CE-038': X({ entreno: [e('fondos', [b({ reps: 'ocho', valor: 'diez', unidad: 'kilos de lastre' })])] }),
  'CE-039': X({ entreno: [e('dominadas', [b({ reps: 'cinco' }), b({ reps: 'cuatro' })])] }),
  'CE-040': X({ entreno: [e('flexiones', [b({ n: 'tres', reps: 'diez', tipo: 'corporal' })])] }),
  'CE-041': X({ entreno: [e('mariposa', [b({ reps: '12', valor: '30' })])] }),
  'CE-042': X({ entreno: [e('banco', [b({ reps: '8', valor: '60', extra: [{ reps: '6', carga: '40' }] })])] }),
  'CE-043': X({ entreno: [e('prensa', [b({ reps: '12', valor: '140', extra: [{ reps: '4', carga: null }] })])] }),
  'CE-044': X({
    entreno: [e('banco', [
      b({ valor: '30', cal: true }), b({ valor: '40', cal: true }), b({ n: 'tres', reps: '8', valor: '60' }),
    ])],
  }),
  'CE-045': X({ entreno: [e('tríceps', [b({ ord: 'una cuarta', reps: '8', valor: '25' })])] }),
  'CE-046': X({ entreno: [e('sentadilla', [b({ reps: '12', valor: '40' })])] }),
  'CE-047': X({ intencion: ['correccion'], correccion: { objetivo: 'ultimo_registro', campo: 'carga', nuevo_valor: '45', ordinal: null } }),
  'CE-048': X({ intencion: ['correccion'], correccion: { objetivo: 'serie_ordinal', campo: 'reps', nuevo_valor: '12', ordinal: 'la segunda' } }),
  'CE-049': X({ intencion: ['deshacer'] }),
  'CE-050': X({ entreno: [e('banco', [b({ n: 'cuatro', reps: '8', valor: '60' })], 'no', 'ayer')] }),
  'CE-051': X({ entreno: [e('sentadilla', [b({ reps: '10', valor: '60' })])] }),
  'CE-052': X({ entreno: [e('sentadilla', []), e('prensa', [])] }),
  'CE-053': X({ sesion: { rpe: null, duracion: null, omitidos: ['el rumano', 'el curl femoral'], cardio: null, preparacion: [] } }),
  'CE-054': X({ sesion: { rpe: 'un 9', duracion: null, omitidos: [], cardio: null, preparacion: [] } }),
  'CE-055': X({ sesion: { rpe: 'un 5', duracion: null, omitidos: [], cardio: null, preparacion: [] } }),
  'CE-056': X({ sesion: { rpe: null, duracion: 'una hora y diez', omitidos: [], cardio: null, preparacion: [] } }),
  'CE-057': X({ intencion: ['entreno'], sesion: { rpe: null, duracion: null, omitidos: [], cardio: '20 minutos', preparacion: [] } }),
  'CE-058': X({ intencion: ['entreno'], sesion: { rpe: null, duracion: null, omitidos: [], cardio: null, preparacion: ['la movilidad', 'la activación'] } }),
  'CE-059': X({ entreno: [e('sentadilla', [b({ reps: '10', valor: '60' })])] }),
  'CE-060': X({
    intencion: ['vida', 'entreno'],
    vida: { ...vidaVacia, sueno_horas: 'como 5 horas', senales: ['aproximado'] },
    entreno: [e('sentadilla', [b({ reps: '10', valor: '60' })])],
  }),
  'CE-061': X({
    intencion: ['comida', 'entreno'],
    comida: { comida_cita: 'desayuné', cuando: null, segun_plan: 'no_dicho', items: [
      { alimento: 'arroz', cantidad: null, medida: null, estado: null, senales: [] },
      { alimento: 'huevo', cantidad: null, medida: null, estado: null, senales: [] },
    ], plato: null, cocinado_por_ella: 'no_dicho', aceite: null, sal: null },
    entreno: [e('banco', [b({ reps: '8', valor: '60' })])],
  }),
  'CE-062': X({
    intencion: ['vida', 'entreno'],
    vida: { ...vidaVacia, actividad_sin_numero: 'caminé bastante' },
    entreno: [e('jalón', [b({ reps: '12', valor: '45' })])],
  }),
  'CE-063': X({ intencion: ['entreno', 'comida'], sesion: { rpe: null, duracion: null, omitidos: [], cardio: '20 minutos', preparacion: [] } }),
  'CE-064': X({ entreno: [e('sentadilla', [b({ reps: '10', valor: '60' })])] }),
  'CE-077': consulta,
  'CE-078': consulta,
  'CE-079': consulta,
  'CE-080': consulta,
}

const vida = (o: Partial<NonNullable<Extraccion['vida']>>): NonNullable<Extraccion['vida']> => ({ ...vidaVacia, ...o })
const diaDe = (estado: 'no_entreno' | 'descanso' | 'cambio', motivo: string | null = null, hizo: string | null = null) =>
  vida({ dia_de_entreno: { estado, motivo, hizo } })
const comidaX = (o: Partial<NonNullable<Extraccion['comida']>>): NonNullable<Extraccion['comida']> => ({
  comida_cita: null, cuando: null, segun_plan: 'no_dicho', items: [], plato: null, cocinado_por_ella: 'no_dicho', aceite: null, sal: null, ...o,
})

/**
 * Lo que Haiku debe devolver en los casos N/V/D que fallaron el 29-sep-2026, escrito a mano. Solo se
 * puntúa la ACCIÓN (notación relajada del corpus). Van aparte de las de arriba porque el test de campos
 * de `resolver.test.ts` puntúa solo casos CE.
 */
export const EXTRACCIONES_GRABADAS_RELAJADAS: Record<string, Extraccion> = {
  V13: X({ intencion: ['vida'], vida: diaDe('no_entreno', 'el jefe me sacó tarde') }),
  V44: X({ intencion: ['vida'], vida: diaDe('no_entreno', 'estaba lloviendo y me dio pereza salir') }),
  V57: X({ intencion: ['vida'], vida: diaDe('no_entreno') }),
  V45: X({ intencion: ['vida'], vida: diaDe('cambio', null, 'brazos') }),
  V46: X({ intencion: ['vida'], vida: diaDe('descanso') }),
  V19: X({ intencion: ['vida'], vida: vida({ peso_corporal: '78 y medio' }) }),
  V54: X({ intencion: ['vida'], vida: vida({ peso_corporal: '80,2' }) }),
  V35: X({ intencion: ['vida'], vida: vida({ tiempos: [{ actividad: 'caminata', duracion: 'como una hora' }] }) }),
  V36: X({ intencion: ['vida'], vida: vida({ tiempos: [{ actividad: 'pantalla', duracion: 'como seis horas' }] }) }),
  V38: X({ intencion: ['vida'], vida: vida({ tiempos: [{ actividad: 'siesta', duracion: 'una hora' }] }) }),
  D06: X({ intencion: ['vida'], vida: vida({ sin_dolor: 'no me duele nada' }) }),
  N59: X({ intencion: ['comida'], comida: comidaX({ comida_cita: 'almorcé', referencia: 'igual_que_ayer' }) }),
  N60: X({ intencion: ['comida'], comida: comidaX({ comida_cita: 'desayuno', referencia: 'igual_que_ayer', sin: ['el huevo'] }) }),
  N76: X({
    intencion: ['comida'],
    comida: comidaX({ items: [{ alimento: 'arepas', cantidad: 'dos', medida: null, estado: null, senales: [] }] }),
  }),
}

/** Casos donde el código y el corpus discrepan A PROPÓSITO (se documentan en el informe). */
export const DISCREPANCIAS_CONOCIDAS: Record<string, string> = {
  'CE-025': 'El corpus espera pc1, pero «el remo» encaja con REMO CON BARRA y REMO EN POLEA BAJA de la sesión y DISENO §3.1 paso 3 manda preguntar.',
}
