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
import { cargaPrescritaDe } from '../../domain/cargaPrescrita'
import { sesionCompleta } from '../../domain/cumplimiento'
import { aplicarOndulacion, brechaReps, ondularEjercicio } from '../../domain/ondulacion'
import type { EjercicioPrescrito, Microciclo, SeriePrescrita, Sesion } from '../../domain/types'

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
  series: readonly { cargaKg: number; reps: number }[],
): { cargaKg: number; reps: number } | undefined {
  const utiles = series.filter((s) => s.cargaKg > 0 && s.reps > 0)
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
  series: readonly { reps: number; rir: number; cargaKg: number }[],
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
 * El ancla es lo registrado y, si no hay nada, **la carga pautada**. Hasta el
 * 2026-08-09 aquí se pasaba `ejercicio.series[0]?.cargaKg`, que es `undefined`
 * exactamente cuando no hay series registradas: el ancla de reserva no podía
 * entrar nunca, y un asesorado que no registró la semana no recibía propuesta ni
 * de repetir lo pautado. Que no registrara sigue avisándose por su cuenta, en
 * `revisarActivacion`.
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
    cargaPrescritaKg: cargaPrescritaDe(ejercicio),
  }
}

/**
 * La frase que va a leer el asesorado. Sale de un solo sitio a propósito: la
 * fila que el coach revisa en el panel y el microciclo que se guarda tienen que
 * decir lo mismo, o se aprueba una cosa y se reparte otra.
 */
function prescripcionOndulada(
  ejercicio: EjercicioPrescrito,
  series: readonly SeriePrescrita[],
  numeroPrevio: number,
): string {
  return textoPrescripcion(series, comparacion(series, serieTope(ejercicio.series)), numeroPrevio)
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
      prescripcion: prescripcionOndulada(ejercicio, ondulado.series, numeroPrevio),
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
 * El `estado` lo fuerza la capa de datos a `'propuesto'`; aquí se pone igual por
 * claridad, pero la salvaguarda real está en `guardarPropuesta`.
 */
export function microcicloPropuesto(
  origen: Microciclo,
  opciones: { incrementoKg?: number; hoy?: string } = {},
): Microciclo {
  const { incrementoKg = 2.5, hoy } = opciones
  const prs = prsMasReciente(origen)
  const finAnterior = sumarDias(origen.fechaInicio, origen.cadenciaDias)
  return {
    ...origen,
    id: `${origen.id}-prop${origen.numero + 1}`,
    numero: origen.numero + 1,
    estado: 'propuesto',
    // Comparación de cadenas ISO: ordena bien sin construir fechas.
    fechaInicio: hoy && hoy > finAnterior ? hoy : finAnterior,
    sesiones: origen.sesiones.map((s) => ({
      ...s,
      testPost: undefined,
      preparacion: s.preparacion?.map(sinMarcar),
      bloquesCardio: s.bloquesCardio?.map(sinMarcar),
      ejercicios: s.ejercicios.map((e) => {
        const limpio: EjercicioPrescrito = { ...e, series: [] }
        if (s.tipo === 'metabolica') return limpio
        const ondulado = aplicarOndulacion(e, opcionesDeOndulacion(e, prs, incrementoKg))
        if (!ondulado.seriesPrescritas) return limpio
        return {
          ...ondulado,
          // Sin esto el ejercicio nace diciendo dos cosas: las series nuevas y,
          // en el texto, la prescripción de la semana pasada («VS M21» incluido).
          // El texto es lo único que el asesorado mira antes de cargar la barra.
          prescripcion: prescripcionOndulada(e, ondulado.seriesPrescritas, origen.numero),
          series: [],
        }
      }),
    })),
  }
}

export function proponerMicrociclo(
  micro: Microciclo,
  opciones: { incrementoKg?: number } = {},
): PropuestaMicrociclo {
  const { incrementoKg = 2.5 } = opciones
  const prs = prsMasReciente(micro)
  const filas = micro.sesiones
    .filter((s) => s.tipo !== 'metabolica')
    .flatMap((s) => filasDeSesion(s, micro.numero, prs, incrementoKg))

  const ejerciciosDeFuerza = micro.sesiones
    .filter((s) => s.tipo !== 'metabolica')
    .flatMap((s) => s.ejercicios)
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
      ejerciciosSinSeries: ejerciciosDeFuerza.filter((e) => e.series.length === 0).length,
      ejerciciosTotales: ejerciciosDeFuerza.length,
      prsUltimo: prs,
      saltoMaximo: maximo(filas.map((f) => f.salto)),
      brechaMaxima: maximo(filas.map((f) => f.brecha)),
    }),
    reparto: {
      suben: filas.filter((f) => f.direccion === 'subir').length,
      sostienen: filas.filter((f) => f.direccion === 'estable').length,
      bajan: filas.filter((f) => f.direccion === 'bajar').length,
    },
  }
}
