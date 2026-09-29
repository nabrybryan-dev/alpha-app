/**
 * El esquema de extracción de Praxis: JSON Schema (lo que se le da a Haiku como
 * herramienta `registrar`) y el validador de citas.
 *
 * CONTRATO (DISENO §2):
 *  - Toda cantidad es una CITA: una subcadena literal de la frase. El modelo no
 *    escribe números propios; los calcula el código (`numeros.ts`, `carga.ts`...).
 *  - Una cita que no aparece en la frase invalida ese campo (pasa a ausente) y se
 *    anota en `citas_invalidas`. Un número que no se pueda rastrear a un
 *    fragmento de la frase o a un dato de la base no existe.
 *  - El modelo NO da confianza. Reporta señales observables (`aproximado`,
 *    `autocorreccion`, `no_recuerda`...) y la confianza la calcula `confianza.ts`.
 *
 * El mismo objeto se usa en la Edge Function (tool use estricto) y en el
 * evaluador (`claude -p --json-schema`): cambiarlo aquí cambia los dos, y sube
 * `VERSION_PROMPT`.
 */
import { normalizarTexto } from './numeros.ts'
import type { CampoEscala, Extraccion } from './tipos.ts'

type Esquema = Record<string, unknown>

const anulable = (s: Esquema): Esquema => ({ anyOf: [s, { type: 'null' }] })
const cita = (descripcion: string): Esquema => anulable({ type: 'string', description: descripcion })
const objeto = (props: Record<string, Esquema>, descripcion?: string): Esquema => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(props),
  properties: props,
  ...(descripcion ? { description: descripcion } : {}),
})
const enumerado = (...valores: string[]): Esquema => ({ type: 'string', enum: valores })
const lista = (items: Esquema, descripcion?: string): Esquema => ({
  type: 'array',
  items,
  ...(descripcion ? { description: descripcion } : {}),
})

const BLOQUE: Esquema = objeto(
  {
    n_series: cita('cita: «tres», «las tres», «dos series»; null = una sola serie'),
    ordinal: cita('cita: «la tercera», «la última», «otra», «una cuarta»; null si no dijo cuál'),
    reps: cita('cita de las repeticiones: «12», «doce», «15»'),
    carga: objeto({
      tipo: enumerado(
        'absoluta', 'barra_sola', 'discos', 'relativa', 'corporal',
        'copiar_pauta', 'copiar_semana_anterior', 'copiar_serie_anterior', 'no_dicha',
      ),
      valor: cita('cita del número de la carga: «40», «cuarenta y cinco», «doce y medio»'),
      unidad_cita: cita('cita de la unidad: «kilos», «libras», «lb», «de lastre»'),
      discos: anulable(
        lista(objeto({ cantidad: { type: 'string' }, peso: { type: 'string' } }), 'solo si habla de discos o platos'),
      ),
      delta: cita('cita con el verbo: «le subí cinco», «le bajé 2,5»'),
      por: enumerado('lado', 'mano', 'total', 'no_dicho'),
    }),
    reserva: objeto({
      tipo: enumerado('no_dicha', 'reserva_dicha', 'fallo', 'rir_de_pauta'),
      cita: cita('cita de las repeticiones en reserva: «2 en reserva», «me quedaba una»'),
    }),
    es_calentamiento: { type: 'boolean', description: 'true si es una serie de calentamiento o aproximación' },
    extra: lista(
      objeto({
        reps: { type: 'string', description: 'cita de las reps del mini-bloque' },
        carga: cita('cita de la carga del mini-bloque; null = la misma de la serie'),
      }),
      'drop set o rest-pause: repeticiones extra tras la serie, sin ser otra serie',
    ),
    senales: lista(enumerado('aproximado', 'no_recuerda', 'autocorreccion', 'maximo_o_minimo', 'reps_y_carga_ambiguas')),
  },
  'un bloque = series con la misma forma; «10, 8 y 6 con 8 kg» son 3 bloques',
)

const ENTRENO: Esquema = objeto({
  ejercicio: objeto({
    cita: cita('nombre del ejercicio tal como lo dijo; null si no nombró ninguno'),
    ref_sugerida: cita('e1..eN de la lista de la sesión, solo como pista; el código decide'),
    implicito: enumerado('no', 'pantalla', 'anterior', 'desconocido'),
  }),
  bloques: lista(BLOQUE),
  cuando: cita('cita temporal: «ayer», «esta mañana»; null = hoy'),
})

const ITEM_COMIDA: Esquema = objeto({
  alimento: { type: 'string', description: 'cita: «arroz», «pechuga»' },
  cantidad: cita('cita literal de la cantidad: «una», «2», «medio», «una taza y media»'),
  medida: cita('cita: «taza», «cucharadas», «gramos», «pedazo», «presa», «plato»'),
  estado: cita('cita: «cocido», «crudo», «frito»'),
  senales: lista(enumerado('aproximado', 'no_recuerda', 'autocorreccion', 'pesado')),
})

const COMIDA: Esquema = anulable(
  objeto({
    comida_cita: cita('«almuerzo», «la cena», «algo en la tarde»'),
    cuando: cita('cita temporal'),
    segun_plan: enumerado('no_dicho', 'como_el_plan', 'parcial', 'fuera_del_plan'),
    items: lista(ITEM_COMIDA),
    plato: anulable(lista(objeto({ alimento: { type: 'string' }, fraccion: cita('«medio», «un cuarto»') }))),
    cocinado_por_ella: enumerado('si', 'no', 'no_dicho'),
    aceite: cita('«una cucharada de aceite»'),
    sal: cita('«una pizca de sal»'),
    referencia: enumerado('no', 'igual_que_ayer'),
    sin: lista({ type: 'string' }, 'solo con igual_que_ayer: citas de lo que quita («sin el huevo» => «el huevo»)'),
  }),
)

const VIDA: Esquema = anulable(
  objeto({
    sueno_horas: cita('«como 5 horas»'),
    hora_acostarse: cita('«a las once»'),
    hora_levantarse: cita('«a las cinco y media»'),
    calidad_sueno: cita('«dormí fatal»'),
    pasos: cita('con número: «8 mil pasos»'),
    actividad_sin_numero: cita('«caminé bastante». No se convierte en números'),
    agua: anulable(objeto({ cantidad: { type: 'string' }, medida: cita('«vasos», «litros», «botella de 600»') })),
    escalas: lista(
      objeto({
        campo: enumerado('cansancio', 'estres', 'ganas_de_entrenar', 'animo', 'hambre', 'rendimiento', 'alimentacion'),
        cita: { type: 'string' },
      }),
    ),
    senales: lista(enumerado('aproximado', 'no_recuerda')),
    peso_corporal: cita('cifra que marcó la báscula si dice que se pesó: «78 y medio», «80,2». null si no se pesó'),
    dia_de_entreno: anulable(
      objeto({
        estado: enumerado('no_entreno', 'descanso', 'cambio'),
        motivo: cita('cita del porqué, si lo dijo'),
        hizo: cita('solo con cambio: cita de lo que hizo en lugar de la pauta'),
      }),
    ),
    tiempos: lista(
      objeto({ actividad: enumerado('caminata', 'siesta', 'pantalla'), duracion: { type: 'string' } }),
      'caminata, siesta u horas de pantalla CON una duración dicha; duracion = cita',
    ),
    sin_dolor: cita('cita de la ausencia EXPLÍCITA de dolor: «no me duele nada», «sin dolor»'),
  }),
)

export const ESQUEMA_REGISTRO: Esquema = objeto(
  {
    intencion: lista(
      enumerado('entreno', 'comida', 'agua', 'vida', 'correccion', 'deshacer', 'respuesta_a_pregunta', 'consulta', 'charla', 'clinico'),
    ),
    entreno: lista(ENTRENO),
    comida: COMIDA,
    vida: VIDA,
    sesion: anulable(
      objeto({
        rpe: cita('esfuerzo de la sesión entera: «un 9 de esfuerzo»'),
        duracion: cita('«una hora y diez»'),
        omitidos: lista({ type: 'string' }, 'citas de ejercicios que dice EXPLÍCITAMENTE que no hizo'),
        cardio: cita('duración del cardio: «20 minutos»'),
        preparacion: lista({ type: 'string' }, 'citas de las partes de la preparación que hizo: «la movilidad», «la activación»'),
      }),
    ),
    correccion: anulable(
      objeto({
        objetivo: enumerado('ultimo_registro', 'serie_ordinal', 'comida_ultima', 'sueno', 'no_claro'),
        campo: cita('«carga», «reps», «rir», «gramos», «horas»'),
        nuevo_valor: cita('cita del valor nuevo'),
        ordinal: cita('cita de cuál serie: «la segunda»'),
      }),
    ),
    aclaracion: anulable(
      objeto({
        motivo: enumerado('frase_incompleta', 'numeros_sin_papel', 'dos_lecturas', 'otro'),
        opciones_citadas: lista({ type: 'string' }),
      }),
    ),
    clinico: objeto({ hay: { type: 'boolean' }, cita: cita('lo que viste, sin interpretarlo') }),
    fuera_de_alcance: { type: 'boolean', description: 'pregunta, consejo o charla: no es un registro' },
  },
  'Etiqueta lo que la persona dijo. No calcules ni completes números: copia fragmentos literales.',
)

/** Sube cada vez que cambia el esquema o el prompt (queda en `praxis_extracciones`). */
export const VERSION_ESQUEMA = 'registro-esquema-2026-09-29.1'

// ---------------------------------------------------------------------------
// Validador de citas
// ---------------------------------------------------------------------------

/** ¿La cita es una subcadena literal de la frase, tras normalizar? */
export function esSubcadenaLiteral(frase: string, fragmento: string): boolean {
  const c = normalizarTexto(fragmento)
  if (!c) return false
  return normalizarTexto(frase).includes(c)
}

export interface ResultadoValidacion {
  extraccion: Extraccion
  /** Qué campo traía una cita que no está en la frase (y quedó en ausente). */
  citasInvalidas: string[]
}

function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])
const str = (x: unknown): string | null => (typeof x === 'string' && x.trim() ? x : null)

/**
 * Normaliza la salida cruda del modelo a `Extraccion` y descarta toda cita que
 * no aparezca en la frase. Tolera campos ausentes (los completa con el valor
 * neutro) porque el modelo puede omitir un `null`. Nunca lanza.
 */
export function validarExtraccion(frase: string, bruto: unknown): ResultadoValidacion {
  const invalidas: string[] = []
  const c = (valor: unknown, campo: string): string | null => {
    const s = str(valor)
    if (s === null) return null
    if (esSubcadenaLiteral(frase, s)) return s
    invalidas.push(`${campo}: «${s}»`)
    return null
  }
  const raiz = esObjeto(bruto) ? bruto : {}

  const entreno = arr(raiz.entreno)
    .filter(esObjeto)
    .map((e, i) => {
      const ej = esObjeto(e.ejercicio) ? e.ejercicio : {}
      const implicito = ['no', 'pantalla', 'anterior', 'desconocido'].includes(String(ej.implicito))
        ? (ej.implicito as 'no' | 'pantalla' | 'anterior' | 'desconocido')
        : 'desconocido'
      const bloques = arr(e.bloques)
        .filter(esObjeto)
        .map((b, j) => {
          const pre = `entreno[${i}].bloques[${j}]`
          const ca = esObjeto(b.carga) ? b.carga : {}
          const tiposCarga = [
            'absoluta', 'barra_sola', 'discos', 'relativa', 'corporal', 'copiar_pauta',
            'copiar_semana_anterior', 'copiar_serie_anterior', 'no_dicha',
          ]
          let tipo = tiposCarga.includes(String(ca.tipo)) ? (ca.tipo as Extraccion['entreno'][0]['bloques'][0]['carga']['tipo']) : 'no_dicha'
          const valor = c(ca.valor, `${pre}.carga.valor`)
          if ((tipo === 'absoluta' || tipo === 'relativa') && valor === null && str(ca.valor) !== null) tipo = 'no_dicha'
          const delta = c(ca.delta, `${pre}.carga.delta`)
          if (tipo === 'relativa' && delta === null) tipo = 'no_dicha'
          const discos = arr(ca.discos)
            .filter(esObjeto)
            .map((d) => ({ cantidad: c(d.cantidad, `${pre}.discos.cantidad`), peso: c(d.peso, `${pre}.discos.peso`) }))
            .filter((d): d is { cantidad: string; peso: string } => d.cantidad !== null && d.peso !== null)
          const re = esObjeto(b.reserva) ? b.reserva : {}
          const tiposRes = ['no_dicha', 'reserva_dicha', 'fallo', 'rir_de_pauta']
          let tipoRes = tiposRes.includes(String(re.tipo)) ? (re.tipo as 'no_dicha' | 'reserva_dicha' | 'fallo' | 'rir_de_pauta') : 'no_dicha'
          const citaRes = c(re.cita, `${pre}.reserva.cita`)
          if (tipoRes === 'reserva_dicha' && citaRes === null) tipoRes = 'no_dicha'
          const senales = arr(b.senales).filter((s): s is Extraccion['entreno'][0]['bloques'][0]['senales'][0] =>
            ['aproximado', 'no_recuerda', 'autocorreccion', 'maximo_o_minimo', 'reps_y_carga_ambiguas'].includes(String(s)),
          )
          return {
            n_series: c(b.n_series, `${pre}.n_series`),
            ordinal: c(b.ordinal, `${pre}.ordinal`),
            reps: c(b.reps, `${pre}.reps`),
            carga: {
              tipo,
              valor,
              unidad_cita: c(ca.unidad_cita, `${pre}.carga.unidad_cita`),
              discos: discos.length ? discos : null,
              delta,
              por: (['lado', 'mano', 'total', 'no_dicho'].includes(String(ca.por)) ? ca.por : 'no_dicho') as 'lado' | 'mano' | 'total' | 'no_dicho',
            },
            reserva: { tipo: tipoRes, cita: citaRes },
            es_calentamiento: b.es_calentamiento === true,
            extra: arr(b.extra)
              .filter(esObjeto)
              .map((x) => ({ reps: c(x.reps, `${pre}.extra.reps`), carga: c(x.carga, `${pre}.extra.carga`) }))
              .filter((x): x is { reps: string; carga: string | null } => x.reps !== null),
            senales,
          }
        })
      return {
        ejercicio: {
          cita: c(ej.cita, `entreno[${i}].ejercicio.cita`),
          ref_sugerida: str(ej.ref_sugerida),
          implicito,
        },
        bloques,
        cuando: c(e.cuando, `entreno[${i}].cuando`),
      }
    })

  const co = esObjeto(raiz.comida) ? raiz.comida : null
  const comida = co
    ? {
        // Etiqueta de la comida («almorcé» → almuerzo): no es una cantidad, no se exige literal.
        comida_cita: str(co.comida_cita),
        cuando: c(co.cuando, 'comida.cuando'),
        segun_plan: (['no_dicho', 'como_el_plan', 'parcial', 'fuera_del_plan'].includes(String(co.segun_plan)) ? co.segun_plan : 'no_dicho') as 'no_dicho' | 'como_el_plan' | 'parcial' | 'fuera_del_plan',
        items: arr(co.items)
          .filter(esObjeto)
          .map((it, k) => ({
            alimento: c(it.alimento, `comida.items[${k}].alimento`),
            cantidad: c(it.cantidad, `comida.items[${k}].cantidad`),
            medida: c(it.medida, `comida.items[${k}].medida`),
            estado: c(it.estado, `comida.items[${k}].estado`),
            senales: arr(it.senales).filter((s): s is 'aproximado' | 'no_recuerda' | 'autocorreccion' | 'pesado' =>
              ['aproximado', 'no_recuerda', 'autocorreccion', 'pesado'].includes(String(s)),
            ),
          }))
          .filter((it): it is typeof it & { alimento: string } => it.alimento !== null),
        plato: arr(co.plato)
          .filter(esObjeto)
          .map((p, k) => ({ alimento: c(p.alimento, `comida.plato[${k}].alimento`), fraccion: c(p.fraccion, `comida.plato[${k}].fraccion`) }))
          .filter((p): p is { alimento: string; fraccion: string | null } => p.alimento !== null),
        cocinado_por_ella: (['si', 'no', 'no_dicho'].includes(String(co.cocinado_por_ella)) ? co.cocinado_por_ella : 'no_dicho') as 'si' | 'no' | 'no_dicho',
        aceite: c(co.aceite, 'comida.aceite'),
        sal: c(co.sal, 'comida.sal'),
        referencia: (co.referencia === 'igual_que_ayer' ? 'igual_que_ayer' : 'no') as 'no' | 'igual_que_ayer',
        sin: arr(co.sin).map((o, k) => c(o, `comida.sin[${k}]`)).filter((o): o is string => o !== null),
      }
    : null

  const vi = esObjeto(raiz.vida) ? raiz.vida : null
  const agua = vi && esObjeto(vi.agua) ? vi.agua : null
  const de = vi && esObjeto(vi.dia_de_entreno) ? vi.dia_de_entreno : null
  const diaDeEntreno = de && ['no_entreno', 'descanso', 'cambio'].includes(String(de.estado))
    ? {
        estado: de.estado as 'no_entreno' | 'descanso' | 'cambio',
        motivo: c(de.motivo, 'vida.dia_de_entreno.motivo'),
        hizo: c(de.hizo, 'vida.dia_de_entreno.hizo'),
      }
    : null
  const campos = ['cansancio', 'estres', 'ganas_de_entrenar', 'animo', 'hambre', 'rendimiento', 'alimentacion']
  const vida = vi
    ? {
        sueno_horas: c(vi.sueno_horas, 'vida.sueno_horas'),
        hora_acostarse: c(vi.hora_acostarse, 'vida.hora_acostarse'),
        hora_levantarse: c(vi.hora_levantarse, 'vida.hora_levantarse'),
        calidad_sueno: c(vi.calidad_sueno, 'vida.calidad_sueno'),
        pasos: c(vi.pasos, 'vida.pasos'),
        actividad_sin_numero: c(vi.actividad_sin_numero, 'vida.actividad_sin_numero'),
        agua: agua && c(agua.cantidad, 'vida.agua.cantidad') !== null
          ? { cantidad: String(agua.cantidad), medida: c(agua.medida, 'vida.agua.medida') }
          : null,
        escalas: arr(vi.escalas)
          .filter(esObjeto)
          .map((es, k) => ({ campo: String(es.campo), cita: c(es.cita, `vida.escalas[${k}]`) }))
          .filter((es): es is { campo: CampoEscala; cita: string } => campos.includes(es.campo) && es.cita !== null),
        senales: arr(vi.senales).filter((s): s is 'aproximado' | 'no_recuerda' => s === 'aproximado' || s === 'no_recuerda'),
        peso_corporal: c(vi.peso_corporal, 'vida.peso_corporal'),
        dia_de_entreno: diaDeEntreno,
        tiempos: arr(vi.tiempos)
          .filter(esObjeto)
          .map((t, k) => ({ actividad: String(t.actividad), duracion: c(t.duracion, `vida.tiempos[${k}].duracion`) }))
          .filter((t): t is { actividad: 'caminata' | 'siesta' | 'pantalla'; duracion: string } =>
            ['caminata', 'siesta', 'pantalla'].includes(t.actividad) && t.duracion !== null),
        sin_dolor: c(vi.sin_dolor, 'vida.sin_dolor'),
      }
    : null

  const se = esObjeto(raiz.sesion) ? raiz.sesion : null
  const sesion = se
    ? {
        rpe: c(se.rpe, 'sesion.rpe'),
        duracion: c(se.duracion, 'sesion.duracion'),
        omitidos: arr(se.omitidos).map((o, k) => c(o, `sesion.omitidos[${k}]`)).filter((o): o is string => o !== null),
        cardio: c(se.cardio, 'sesion.cardio'),
        preparacion: arr(se.preparacion).map((o, k) => c(o, `sesion.preparacion[${k}]`)).filter((o): o is string => o !== null),
      }
    : null

  const cor = esObjeto(raiz.correccion) ? raiz.correccion : null
  const correccion = cor
    ? {
        objetivo: (['ultimo_registro', 'serie_ordinal', 'comida_ultima', 'sueno', 'no_claro'].includes(String(cor.objetivo)) ? cor.objetivo : 'no_claro') as 'ultimo_registro' | 'serie_ordinal' | 'comida_ultima' | 'sueno' | 'no_claro',
        campo: str(cor.campo),
        nuevo_valor: c(cor.nuevo_valor, 'correccion.nuevo_valor'),
        ordinal: c(cor.ordinal, 'correccion.ordinal'),
      }
    : null

  const ac = esObjeto(raiz.aclaracion) ? raiz.aclaracion : null
  const aclaracion = ac
    ? {
        motivo: (['frase_incompleta', 'numeros_sin_papel', 'dos_lecturas', 'otro'].includes(String(ac.motivo)) ? ac.motivo : 'otro') as 'frase_incompleta' | 'numeros_sin_papel' | 'dos_lecturas' | 'otro',
        opciones_citadas: arr(ac.opciones_citadas).map((o, k) => c(o, `aclaracion.opciones[${k}]`)).filter((o): o is string => o !== null).slice(0, 3),
      }
    : null

  const cl = esObjeto(raiz.clinico) ? raiz.clinico : {}
  const intenciones = arr(raiz.intencion).filter((x): x is Extraccion['intencion'][0] =>
    ['entreno', 'comida', 'agua', 'vida', 'correccion', 'deshacer', 'respuesta_a_pregunta', 'consulta', 'charla', 'clinico'].includes(String(x)),
  )

  return {
    citasInvalidas: invalidas,
    extraccion: {
      intencion: intenciones,
      entreno,
      comida,
      vida,
      sesion,
      correccion,
      aclaracion,
      clinico: { hay: cl.hay === true, cita: str(cl.cita) },
      fuera_de_alcance: raiz.fuera_de_alcance === true,
    },
  }
}
