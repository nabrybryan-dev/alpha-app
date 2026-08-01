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
 *   · Cuando baja de verdad, la mediana es 0,75, no el 0,6 de `FACTOR_DESCARGA`.
 *
 * Así que aquí se pasa `descarga: false` siempre. **Antes de activarla hay que
 * decidir cómo se dispara**: ¿fatiga acumulada? ¿PRS bajo sostenido? ¿a mano?
 * Ver `conocimiento/comparativa-cursos-vs-arquitectura-app.md` en el Cerebro de
 * Programación.
 */
import { aplicarOndulacion, ondularEjercicio } from '../../domain/ondulacion'
import type { EjercicioPrescrito, Microciclo, Sesion } from '../../domain/types'

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
}

export interface PropuestaMicrociclo {
  /** Número del microciclo que se propone (el siguiente al leído). */
  numero: number
  /** PRS más reciente encontrado, si lo hay. */
  prs?: number
  filas: FilaPropuesta[]
  /** Ejercicios que el motor no pudo ondular por falta de ancla. */
  sinDatos: number
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
function textoPrescripcion(
  series: { reps: number; rir: number; cargaKg: number }[],
  referencia: { cargaKg: number; reps: number } | undefined,
  numeroPrevio: number,
): string {
  if (series.length === 0) return ''
  const uniforme = series.every((s) => s.cargaKg === series[0].cargaKg && s.reps === series[0].reps)
  const rir = series[0].rir
  const base = uniforme
    ? `${series[0].cargaKg}KG A ${series[0].reps} REPS; ${series.length} SERIES (RIR ${rir}).`
    : `${series.map((s) => `${s.cargaKg}KG×${s.reps}`).join(' · ')} (RIR ${rir}).`

  if (!referencia) return base
  const comparable = series.find((s) => s.reps === referencia.reps)
  if (!comparable) return base

  const delta = Math.round((comparable.cargaKg - referencia.cargaKg) * 10) / 10
  const aReps = `A ${referencia.reps} REPS VS M${numeroPrevio}`
  if (delta > 0) return `${base} PROGRESA +${delta}KG ${aReps}.`
  if (delta < 0) return `${base} BAJA ${Math.abs(delta)}KG ${aReps}.`
  return `${base} SOSTIENE CARGA ${aReps}.`
}

function filasDeSesion(
  sesion: Sesion,
  numeroPrevio: number,
  prs: number | undefined,
  incrementoKg: number,
): FilaPropuesta[] {
  return sesion.ejercicios.map((ejercicio: EjercicioPrescrito) => {
    const ondulado = ondularEjercicio(ejercicio, {
      prs,
      incrementoKg,
      // Ver el encabezado del archivo: el disparador de descarga no está validado.
      descarga: false,
      cargaPrescritaKg: ejercicio.series[0]?.cargaKg,
    })
    return {
      sesionId: sesion.id,
      sesionNombre: sesion.nombre,
      categoria: ejercicio.categoria,
      ejercicio: ejercicio.nombre,
      prescripcion: textoPrescripcion(ondulado.series, serieTope(ejercicio.series), numeroPrevio),
      motivo: ondulado.motivo,
      direccion: ondulado.direccion,
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
 * Convierte la propuesta en un microciclo guardable, ondulando de verdad los
 * ejercicios (con `seriesPrescritas`, que es lo que el asesorado ve serie a serie).
 *
 * Lo que NO arrastra del microciclo de origen: las series registradas y los tests
 * post. Empieza limpio, porque es un microciclo nuevo, no una copia del anterior
 * con lo hecho dentro. Arrastrarlos haría que el asesorado abriera M23 con las
 * series de M22 ya marcadas.
 *
 * El `estado` lo fuerza la capa de datos a `'propuesto'`; aquí se pone igual por
 * claridad, pero la salvaguarda real está en `guardarPropuesta`.
 */
export function microcicloPropuesto(
  origen: Microciclo,
  opciones: { incrementoKg?: number } = {},
): Microciclo {
  const { incrementoKg = 2.5 } = opciones
  const prs = prsMasReciente(origen)
  return {
    ...origen,
    id: `${origen.id}-prop${origen.numero + 1}`,
    numero: origen.numero + 1,
    estado: 'propuesto',
    sesiones: origen.sesiones.map((s) => ({
      ...s,
      testPost: undefined,
      ejercicios: s.ejercicios.map((e) => {
        const limpio: EjercicioPrescrito = { ...e, series: [] }
        if (s.tipo === 'metabolica') return limpio
        return {
          ...aplicarOndulacion(e, {
            prs,
            incrementoKg,
            descarga: false, // ver el encabezado del archivo
            cargaPrescritaKg: e.series[0]?.cargaKg,
          }),
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

  return {
    numero: micro.numero + 1,
    prs,
    filas,
    sinDatos: filas.filter((f) => f.direccion === 'sin-datos').length,
  }
}
