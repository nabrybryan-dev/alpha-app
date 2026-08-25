/**
 * Conecta el motor de ondulación con los datos reales de un asesorado y devuelve
 * la propuesta del microciclo siguiente, **lista para revisar**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUÉ HACE Y QUÉ NO
 * ────────────────────────────────────────────────────────────────────────────
 * Calcula y devuelve. **No escribe nada**: ni en la base local ni en la nube. La
 * salida se le muestra a Bryan para que la revise y la cargue él, que es como
 * funciona hoy su flujo con el Excel.
 *
 * Es a propósito y es el primer paso de dos. Escribir microciclos generados es
 * otra decisión: la capa de datos ni siquiera tiene hoy con qué crearlos
 * (`MicrociclosRepo` solo lee y registra sobre uno existente), y el día que la
 * tenga, lo que se escriba se lo va a hacer una persona en el gimnasio.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA DESCARGA NO SE APLICA, Y NO ES UN OLVIDO
 * ────────────────────────────────────────────────────────────────────────────
 * `fasePeriodizacion` marca descarga en la semana 4 de cada mesociclo (M4, M8,
 * M12…), pero eso **no coincide con lo que Bryan hace de verdad**. Medido el
 * 2026-07-30 sobre 291 transiciones de 21 plantillas reales:
 *
 *   · El 15 % de los microciclos baja volumen más de un 10 %… y es el MISMO 15 %
 *     dentro y fuera de M4/M8/M12. No hay ninguna señal en la semana 4.
 *
 * Esa medición decía también «cuando baja, la mediana es 0,75, no el 0,6 de
 * FACTOR_DESCARGA». **Era una comparación mal hecha** y se corrigió el 2026-08-01:
 * medía caídas de VOLUMEN, mientras que `FACTOR_DESCARGA` multiplica el NÚMERO DE
 * SERIES. Midiendo directamente las series —356 bajadas reales— el valor que más
 * acierta es 2/3. Ver su comentario en `domain/ondulacion.ts`.
 *
 * Lo que sigue en pie es lo de arriba: **la semana 4 no dispara nada en la
 * práctica**. Así que aquí se pasa `descarga: false` siempre. Antes de activarla
 * hay que decidir cómo se dispara: ¿fatiga acumulada? ¿PRS bajo sostenido? ¿a mano?
 * Ver `conocimiento/comparativa-cursos-vs-arquitectura-app.md` en el Cerebro de
 * Programación.
 */
import { revisarActivacion, sumarDias, type RevisionActivacion } from '../../domain/activacion'
import { diaDeSesion, diaSemanaDe, type DiaSemana } from '../../domain/calendario'
import { sesionCompleta } from '../../domain/cumplimiento'
import { aplicarOndulacion, brechaReps, ondularEjercicio } from '../../domain/ondulacion'
import { componerPrescripcion } from '../../domain/prescripcion'
import { desalineadosDe } from '../../domain/alineacion'
import { volumenDelMicrociclo, type VolumenDeGrupo } from '../../domain/progresionDeVolumen'
import type { EjercicioPrescrito, Microciclo, NivelVolumen, Sesion } from '../../domain/types'

export interface FilaPropuesta {
  sesionId: string
  sesionNombre: string
  categoria: string
  ejercicio: string
  /** Texto canónico del coach, listo para pegar en NOTAS ASESORADO del Excel. */
  prescripcion: string
  /** Por qué el motor propone eso. Se le muestra a Bryan, no al asesorado. */
  motivo: string
  direccion: 'subir' | 'estable' | 'bajar' | 'sin-datos'
  /** Cambio de carga a igual reps, en tanto por uno. Alimenta la revisión. */
  salto?: number
  /** Distancia entre las reps hechas y la diana, en valor absoluto. */
  brecha?: number
}

export interface PropuestaMicrociclo {
  /** Número del microciclo que se propone (el siguiente al leído). */
  numero: number
  /** PRS más reciente encontrado, si lo hay. */
  prs?: number
  filas: FilaPropuesta[]
  /** Ejercicios que el motor no pudo ondular por falta de ancla. */
  sinDatos: number
  /** Si puede activarse sola y, si no, por qué. Reglas en `domain/activacion.ts`. */
  revision: RevisionActivacion
  /** Para el resumen del coach: cuántos suben, sostienen y bajan. */
  reparto: { suben: number; sostienen: number; bajan: number }
  /**
   * Cuántas series le tocan a cada grupo la semana que viene, por landmark.
   *
   * `aplicarOndulacion` decide la CARGA con criterio, pero el número de series
   * lo heredaba: partía de `ejercicio.sets` del microciclo anterior y solo lo
   * movía en descarga o con PRS crítico. Así el volumen no progresaba solo,
   * cuando es —según el motor del Cerebro— la variable que más se ondula a lo
   * largo de los 24 microciclos.
   *
   * Es una RECOMENDACIÓN, no una escritura: se le enseña al coach junto a la
   * propuesta y él decide. Por eso viaja aquí y no dentro de `microcicloPropuesto`.
   */
  volumen: VolumenDeGrupo[]
  /**
   * Ejercicios cuya frase contradice a sus campos.
   *
   * Es el espejo en la app de `supabase/comprobar-alineacion.sql`: el clonador
   * escribe `sets`, `rir` y `reps` solo cuando el ajuste los trae, así que una
   * carga que pasa la frase nueva sin pasarlos deja los campos con los de la
   * semana anterior. Pasó el 2026-08-12 con 128 ejercicios de 13 asesorados.
   *
   * El asesorado lee la FRASE antes de cargar la barra; el motor lee los
   * CAMPOS. Cuando divergen, los dos van a lo suyo y nadie se entera.
   */
  desalineados: ReturnType<typeof desalineadosDe>
}

/**
 * PRS más reciente del microciclo: el de la última sesión que tenga test post.
 * Es la señal de recuperación con la que se entra al microciclo siguiente.
 */
function prsMasReciente(micro: Microciclo): number | undefined {
  const conTest = micro.sesiones.filter((s) => s.testPost)
  return conTest.length > 0 ? conTest[conTest.length - 1].testPost?.prsEntrada : undefined
}

/** La serie más pesada de lo registrado: la referencia contra la que se compara. */
function serieTope(
  series: readonly { cargaKg: number; reps?: number }[],
): { cargaKg: number; reps: number } | undefined {
  // Las series sin reps —isométricas, control, movilidad— no compiten por ser
  // la serie tope: no hay con qué compararlas.
  const utiles = series.filter((s): s is { cargaKg: number; reps: number } =>
    s.reps !== undefined && s.cargaKg > 0 && s.reps > 0,
  )
  return utiles.length > 0 ? utiles.reduce((a, b) => (b.cargaKg > a.cargaKg ? b : a)) : undefined
}

/**
 * Texto canónico del coach. Si los sets difieren, se listan uno a uno.
 *
 * **La progresión se mide a IGUAL número de repeticiones**, y esto costó dos
 * intentos hasta acertar. Comparar kilos entre esquemas de reps distintos no dice
 * nada: el motor ondula bajando reps y subiendo carga, así que su set más pesado
 * casi siempre pesa más que lo anterior sin que haya progresado nadie.
 *
 * El caso que lo destapó, visto en pantalla: la abducción de cadera pasaba de
 * `55KG×15` registrado a un tope de `65KG×12` propuesto, y se anunciaba como
 * «PROGRESA +10KG» mientras su propio motivo decía que la carga iba por encima.
 * En 1RM estimado esos 65×12 son incluso algo MENOS que los 55×15.
 *
 * Buscando en la propuesta el set con las mismas reps que la serie tope anterior,
 * la comparación vuelve a significar algo — y el texto deja de contradecir al
 * motivo. Si no hay ningún set comparable, no se anuncia progresión: mejor callar
 * que inventar un número.
 */
function comparacion(
  series: readonly { reps: number; cargaKg: number }[],
  referencia: { cargaKg: number; reps: number } | undefined,
): { deltaKg: number; salto: number; reps: number } | undefined {
  if (!referencia || referencia.cargaKg <= 0) return undefined
  const comparable = series.find((s) => s.reps === referencia.reps)
  if (!comparable) return undefined
  const deltaKg = Math.round((comparable.cargaKg - referencia.cargaKg) * 10) / 10
  return { deltaKg, salto: deltaKg / referencia.cargaKg, reps: referencia.reps }
}

function textoPrescripcion(
  series: { reps: number; rir: number; cargaKg: number }[],
  comp: { deltaKg: number; reps: number } | undefined,
  numeroPrevio: number,
): string {
  if (series.length === 0) return ''
  const uniforme = series.every((s) => s.cargaKg === series[0].cargaKg && s.reps === series[0].reps)
  const rir = series[0].rir
  const base = uniforme
    ? `${series[0].cargaKg}KG A ${series[0].reps} REPS; ${series.length} SERIES (RIR ${rir}).`
    : `${series.map((s) => `${s.cargaKg}KG×${s.reps}`).join(' · ')} (RIR ${rir}).`

  if (!comp) return base
  const aReps = `A ${comp.reps} REPS VS M${numeroPrevio}`
  if (comp.deltaKg > 0) return `${base} PROGRESA +${comp.deltaKg}KG ${aReps}.`
  if (comp.deltaKg < 0) return `${base} BAJA ${Math.abs(comp.deltaKg)}KG ${aReps}.`
  return `${base} SOSTIENE CARGA ${aReps}.`
}

/**
 * Opciones con las que se ondula un ejercicio para el microciclo siguiente.
 *
 * El ancla del 1RM es lo registrado y, si no hay nada, **la carga pautada**.
 * Hasta el 2026-08-09 aquí se pasaba `ejercicio.series[0]?.cargaKg`, que es
 * `undefined` exactamente cuando no hay series registradas: el ancla de reserva
 * no podía entrar nunca. Era código muerto, y por eso un asesorado que no
 * registró la semana no recibía propuesta ni de repetir lo pautado. Que no
 * registrara se sigue avisando por su cuenta, en `revisarActivacion`.
 *
 * Ahora la carga vive en su propio campo (`domain/prescripcion.ts`), así que el
 * ancla existe de verdad y no hay que sacarla de la frase.
 */
function opcionesDeOndulacion(
  ejercicio: EjercicioPrescrito,
  prs: number | undefined,
  incrementoKg: number,
) {
  return {
    prs,
    incrementoKg,
    // Ver el encabezado del archivo: el disparador de descarga no está validado.
    descarga: false,
    cargaPrescritaKg: ejercicio.series[0]?.cargaKg ?? ejercicio.cargaKg,
  }
}

function filasDeSesion(
  sesion: Sesion,
  numeroPrevio: number,
  prs: number | undefined,
  incrementoKg: number,
): FilaPropuesta[] {
  return sesion.ejercicios.map((ejercicio: EjercicioPrescrito) => {
    const ondulado = ondularEjercicio(ejercicio, opcionesDeOndulacion(ejercicio, prs, incrementoKg))
    const comp = comparacion(ondulado.series, serieTope(ejercicio.series))
    const brecha = brechaReps(ejercicio)
    return {
      sesionId: sesion.id,
      sesionNombre: sesion.nombre,
      categoria: ejercicio.categoria,
      ejercicio: ejercicio.nombre,
      prescripcion: textoPrescripcion(ondulado.series, comp, numeroPrevio),
      motivo: ondulado.motivo,
      direccion: ondulado.direccion,
      salto: comp?.salto,
      brecha: brecha === undefined ? undefined : Math.abs(brecha),
    }
  })
}

/**
 * Propuesta del microciclo siguiente a partir de lo que el asesorado registró.
 *
 * Solo se ondulan los ejercicios de fuerza (`sesion.ejercicios`). La preparación
 * y los bloques de cardio no llevan carga que progresar.
 */
/**
 * Quita la marca de hecho conservando el ítem. Lo que se programa es lo que hay que
 * hacer; lo que se hizo se queda en el microciclo que se cierra.
 */
function sinMarcar<T extends { hechoEn?: string }>(item: T): T {
  return { ...item, hechoEn: undefined }
}

/**
 * Convierte la propuesta en un microciclo guardable, ondulando de verdad los
 * ejercicios (con `seriesPrescritas`, que es lo que el asesorado ve serie a serie).
 *
 * Lo que NO arrastra del microciclo de origen: las series registradas y los tests
 * post. Empieza limpio, porque es un microciclo nuevo, no una copia del anterior
 * con lo hecho dentro. Arrastrarlos haría que el asesorado abriera M23 con las
 * series de M22 ya marcadas.
 *
 * **Tampoco arrastra la fecha de inicio**, y esto se vio en pantalla, no en un
 * test: el `...origen` la copiaba tal cual, así que el microciclo nuevo nacía con
 * la fecha del viejo —es decir, **ya vencido**—. En el panel del coach eso salía
 * como un M10 propuesto sobre un M9 recién creado y vacío: «0 suben · 0 sostienen
 * · 0 bajan». Encadenado, le habría generado un microciclo fantasma por cada vez
 * que Bryan abriera la app.
 *
 * Arranca donde terminaba el anterior, salvo que eso ya sea pasado: si se activa
 * con retraso, empieza hoy. Encadenar hacia atrás le daría al asesorado una semana
 * nacida a medias.
 *
 * `fechaInicio` manda sobre las dos, y es lo que permite preparar la semana de
 * alguien por adelantado en vez de solo «a continuación de lo que está haciendo».
 * Es una fecha elegida por una persona: no se corrige contra `hoy`, porque
 * corregirla sería descartar en silencio lo que el coach decidió.
 *
 * El `estado` lo fuerza la capa de datos a `'propuesto'`; aquí se pone igual por
 * claridad, pero la salvaguarda real está en `guardarPropuesta`.
 */
const SEMANA_DESDE_LUNES = [
  'LUNES',
  'MARTES',
  'MIÉRCOLES',
  'JUEVES',
  'VIERNES',
  'SÁBADO',
  'DOMINGO',
] as const satisfies readonly DiaSemana[]

const SEMANA_DESDE_DOMINGO = [
  'DOMINGO',
  'LUNES',
  'MARTES',
  'MIÉRCOLES',
  'JUEVES',
  'VIERNES',
  'SÁBADO',
] as const satisfies readonly DiaSemana[]

/**
 * Corre el arranque calculado hasta el día de la primera sesión fijada.
 *
 * Con cadencia 8 y días clavados —hay planes de LUNES a JUEVES— encadenar
 * `inicio + cadencia` mueve el arranque un día de la semana en cada ciclo. A la
 * segunda vuelta la sesión del LUNES cae **antes** de que el microciclo empiece:
 * `armarSemana` la coloca en su día exacto, y ese día ya pasó. No falla nada, no
 * avisa nadie, y el asesorado abre la semana con una sesión en el pasado.
 *
 * Solo toca la fecha **calculada**. Una `fechaInicio` que eligió el coach no se
 * corrige nunca, que es la regla que ya tenía esta función.
 *
 * Retrocede como mucho seis días y jamás hasta el arranque anterior o antes: es
 * lo mismo que ya se hizo a mano la vez que un microciclo cayó en martes y el
 * siguiente se devolvió al lunes.
 */
function arranqueQueRespetaLosDias(
  calculado: string,
  sesiones: readonly Sesion[],
  arranqueAnterior: string,
): string {
  const fijados = sesiones
    .map((s) => diaDeSesion(s))
    .filter((dia): dia is DiaSemana => dia !== undefined)
  if (fijados.length === 0) return calculado

  const orden: readonly DiaSemana[] = fijados.includes('DOMINGO')
    ? SEMANA_DESDE_DOMINGO
    : SEMANA_DESDE_LUNES
  const posArranque = orden.indexOf(diaSemanaDe(calculado))
  const posPrimera = Math.min(...fijados.map((dia) => orden.indexOf(dia)))
  if (posPrimera >= posArranque) return calculado

  const corregido = sumarDias(calculado, posPrimera - posArranque)
  return corregido > arranqueAnterior ? corregido : calculado
}

export function microcicloPropuesto(
  origen: Microciclo,
  opciones: { incrementoKg?: number; hoy?: string; fechaInicio?: string } = {},
): Microciclo {
  const { incrementoKg = 2.5, hoy, fechaInicio } = opciones
  const prs = prsMasReciente(origen)
  const finAnterior = sumarDias(origen.fechaInicio, origen.cadenciaDias)
  return {
    ...origen,
    id: `${origen.id}-prop${origen.numero + 1}`,
    numero: origen.numero + 1,
    estado: 'propuesto',
    // Comparación de cadenas ISO: ordena bien sin construir fechas.
    fechaInicio:
      fechaInicio ??
      arranqueQueRespetaLosDias(
        hoy && hoy > finAnterior ? hoy : finAnterior,
        origen.sesiones,
        origen.fechaInicio,
      ),
    sesiones: origen.sesiones.map((s) => ({
      ...s,
      testPost: undefined,
      preparacion: s.preparacion?.map(sinMarcar),
      bloquesCardio: s.bloquesCardio?.map(sinMarcar),
      ejercicios: s.ejercicios.map((e) => {
        const limpio: EjercicioPrescrito = { ...e, series: [] }
        // Sin filtro por `tipo`: lo que decide si hay carga que progresar es el
        // propio ejercicio, y `aplicarOndulacion` ya devuelve `limpio` cuando no
        // la hay. Un ejercicio con series y kilos dentro de una metabolica
        // genera fatiga igual, y hasta el 2026-08-25 se quedaba congelado.
        const ondulado = aplicarOndulacion(e, opcionesDeOndulacion(e, prs, incrementoKg))
        if (!ondulado.seriesPrescritas) return limpio
        // La frase se compone desde los campos. Sin esto el ejercicio nace
        // diciendo dos cosas: las series nuevas y, en el texto, la prescripción
        // de la semana pasada — que es lo único que el asesorado mira antes de
        // cargar la barra. Su nota va dentro de `componerPrescripcion` y viaja
        // intacta: no la reescribe nadie.
        const conSeries: EjercicioPrescrito = { ...ondulado, series: [] }
        return { ...conSeries, prescripcion: componerPrescripcion(conSeries) }
      }),
    })),
  }
}

export function proponerMicrociclo(
  micro: Microciclo,
  opciones: {
    incrementoKg?: number
    /** Prioridad por grupo, del perfil. Sin ella, todos cuentan como 'Normal'. */
    volumenSemanal?: Readonly<Record<string, NivelVolumen>>
  } = {},
): PropuestaMicrociclo {
  const { incrementoKg = 2.5, volumenSemanal } = opciones
  const prs = prsMasReciente(micro)
  /**
   * Todas las sesiones, sin filtrar por `tipo`.
   *
   * Hasta el 2026-08-25 las metabolicas se quedaban fuera: «ahi no hay carga que
   * progresar». Eso vale cuando la sesion es solo bloques, pero habia metabolicas
   * con ejercicios cargados dentro —7 de una asesorada, 6 de otra— y esos
   * quedaban congelados microciclo tras microciclo, invisibles en la propuesta y
   * fuera de la cuenta de volumen. Generan fatiga: cuentan.
   *
   * Una metabolica de verdad —solo bloques, `ejercicios: []`— sigue sin aportar
   * nada aqui, porque no tiene ejercicios que aportar. El filtro sobraba.
   */
  const filas = micro.sesiones.flatMap((s) => filasDeSesion(s, micro.numero, prs, incrementoKg))

  const ejerciciosPrescritos = micro.sesiones.flatMap((s) => s.ejercicios)
  const maximo = (valores: (number | undefined)[]) => {
    const utiles = valores.filter((v): v is number => v !== undefined)
    return utiles.length > 0 ? Math.max(...utiles) : undefined
  }

  return {
    numero: micro.numero + 1,
    prs,
    filas,
    sinDatos: filas.filter((f) => f.direccion === 'sin-datos').length,
    revision: revisarActivacion({
      sesionesSinRegistrar: micro.sesiones.filter((s) => !sesionCompleta(s)).length,
      ejerciciosSinSeries: ejerciciosPrescritos.filter((e) => e.series.length === 0).length,
      ejerciciosTotales: ejerciciosPrescritos.length,
      prsUltimo: prs,
      saltoMaximo: maximo(filas.map((f) => f.salto)),
      brechaMaxima: maximo(filas.map((f) => f.brecha)),
    }),
    // El perfil dice qué grupos son prioritarios; sin perfil, todos 'Normal'.
    volumen: volumenDelMicrociclo(micro, { volumenSemanal, prs }),
    desalineados: desalineadosDe(ejerciciosPrescritos),
    reparto: {
      suben: filas.filter((f) => f.direccion === 'subir').length,
      sostienen: filas.filter((f) => f.direccion === 'estable').length,
      bajan: filas.filter((f) => f.direccion === 'bajar').length,
    },
  }
}
