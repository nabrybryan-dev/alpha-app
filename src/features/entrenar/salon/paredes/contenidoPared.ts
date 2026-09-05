import type { EjercicioPrescrito, UnidadCarga } from '../../../../domain/types'
import { esAlFallo, textoDeObjetivo } from '../../../../domain/objetivoDeIntensidad'
import { planDeMedida } from '../../../../domain/biomecanica/palancas'
import type { Vista } from '../../../../domain/biomecanica/tipos'
import { SALA } from '../../escena/sala'
import { TOPE_PARED } from '../huecos'

/**
 * LO QUE VA EN LAS PAREDES, y lo que se va al panel de abajo.
 *
 * Función pura: entra la prescripción de un ejercicio y salen nueve textos cortos —uno
 * por panel de pared— más el arrastre de todo lo que no cupo. Sin React, sin red, sin
 * reloj y sin azar: los mismos datos dan siempre la misma salida, que es la condición
 * para poder demostrar con una huella que no se perdió nada.
 *
 * ## Recortar no es tirar
 *
 * Ninguno de los nueve campos pasa de `TOPE_PARED` caracteres, porque una pared se lee
 * de reojo y en escorzo mientras la cámara orbita. Pero el recorte solo cambia DÓNDE
 * está el texto, nunca si existe:
 *
 * - si el texto completo cabe, la pared **es** el texto completo y no hay nada que
 *   arrastrar;
 * - si no cabe, la pared lleva la versión corta y el completo se va entero a `alPanel`.
 *
 * De ahí la invariante que se puede comprobar de fuera: para cada campo, o bien su
 * texto completo está en la pared, o bien está en `alPanel`. Nunca en ninguno de los
 * dos sitios, que es como se pierde información sin que nadie lo note.
 *
 * ## De dónde salen los números
 *
 * De `src/domain`, que es de solo lectura y donde vive la verdad: `planDeMedida()` para
 * la cámara y la palanca, `textoDeObjetivo()` para el RIR —que sabe que **`FALLO` no es
 * `RIR 0`**— y `SALA.estacion` para la distancia, que es la misma constante con la que
 * se construye la estación de grabación en 3D. Ninguna cifra se escribe dos veces.
 */

/** Los nueve paneles de pared, en el orden en que se cuelgan alrededor del sujeto. */
export const CAMPOS_DE_PARED = [
  'nombre',
  'tecnica',
  'colocacionMovil',
  'distancia',
  'brazoDeMomento',
  'velocidad',
  'seriesReps',
  'carga',
  'rir',
] as const

/** La clave de uno de los nueve paneles. */
export type ClaveDeCampo = (typeof CAMPOS_DE_PARED)[number]

/**
 * Un texto que se va al panel de abajo, íntegro.
 *
 * Lleva su huella para que se pueda demostrar —sin leerlo— que el original sigue ahí.
 */
export interface TextoDePanel {
  /** De qué panel de pared viene. Sin definir: no tiene pared, solo vive abajo. */
  campo?: ClaveDeCampo
  /** El encabezado con el que se presenta en el panel. */
  titulo: string
  /** El texto COMPLETO, sin recortar. */
  texto: string
  /** Huella estable de `texto`. */
  huella: string
}

/** Lo que se cuelga en las paredes del salón, más lo que baja al panel. */
export interface ContenidoDePared {
  nombre: string
  tecnica: string
  colocacionMovil: string
  distancia: string
  brazoDeMomento: string
  velocidad: string
  seriesReps: string
  carga: string
  rir: string
  /** Todo lo que no cabía arriba, entero. Vacío si todo cupo. */
  alPanel: TextoDePanel[]
}

// ---------------------------------------------------------------------------
// La huella
// ---------------------------------------------------------------------------

/**
 * Huella estable de un texto: FNV-1a de 32 bits en base 36.
 *
 * Estable quiere decir tres cosas, y las tres hacen falta para lo que se usa: el mismo
 * texto da siempre la misma huella, textos distintos casi nunca la comparten, y no
 * depende de nada de fuera —ni del reloj, ni del idioma del navegador, ni del orden en
 * que se llamó—. Con eso, comparar el conjunto de huellas de antes y de después dice si
 * algún texto desapareció por el camino, sin tener que leerlos.
 *
 * FNV-1a y no algo criptográfico a propósito: esto no protege de nadie, solo detecta
 * pérdidas. Cabe en diez líneas y corre en microsegundos, que es lo que se necesita
 * cuando la comprobación va a correr sobre cada ejercicio del microciclo.
 *
 * Se recorre por PUNTOS DE CÓDIGO y no por unidades UTF-16: los acentos y la «ñ» son el
 * pan de cada día en estos textos, y hacer que la huella dependa de cómo los parta el
 * motor sería construir la inestabilidad justo donde se promete lo contrario.
 */
export function huellaDeTexto(texto: string): string {
  let h = 0x811c9dc5
  for (const letra of texto) {
    h ^= letra.codePointAt(0)!
    // El primo de FNV, 16777619, escrito como sumas de desplazamientos para que la
    // multiplicación no se salga de los 32 bits por el camino de los flotantes.
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0
  }
  return h.toString(36).padStart(7, '0')
}

// ---------------------------------------------------------------------------
// Recorte
// ---------------------------------------------------------------------------

/**
 * Deja un texto en `tope` caracteres o menos, cortando por palabra cuando se puede.
 *
 * El puntito suspensivo no es adorno: es la señal de que hay más abajo. Sin él, una
 * frase cortada se lee como una frase entera y ahí sí se habría perdido algo — el
 * lector ni siquiera sabría que le falta.
 *
 * El bucle final es la garantía dura. La cuenta por palabras es una heurística y podría
 * pasarse; esto no puede, porque comprueba la longitud de verdad de lo que va a
 * devolver.
 */
function recortar(texto: string, tope: number = TOPE_PARED): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  if (limpio.length <= tope) return limpio

  const letras = Array.from(limpio)
  let corte = letras.slice(0, Math.max(0, tope - 1)).join('')
  // Cortar por la última palabra entera, pero solo si está cerca del final: partir en
  // mitad de la frase para respetar una palabra deja la pared más vacía y no más clara.
  const espacio = corte.lastIndexOf(' ')
  if (espacio > tope - 14) corte = corte.slice(0, espacio)
  corte = corte.replace(/[\s,;:.·—-]+$/u, '')

  while (corte.length + 1 > tope) corte = Array.from(corte).slice(0, -1).join('')
  return corte + '…'
}

/**
 * Coma decimal, que es como se escriben los números en toda la app.
 *
 * `decimales` se pasa cuando la cifra es una MEDIDA y el cero cuenta: «3,0 m» dice que
 * son tres metros medidos, «3 m» suena a redondeo de alguien que no midió. Sin él, un
 * descanso de dos minutos se escribiría «2,0 min», que es la misma falta al revés.
 */
function cifra(n: number, decimales?: number): string {
  const texto = decimales === undefined ? String(n) : n.toFixed(decimales)
  return texto.replace('.', ',')
}

/**
 * El matiz que acompaña a los kilos, cuando lo hay.
 *
 * `unidadCarga` no dice en qué unidad está el número —siempre son kilos— sino a QUÉ se
 * refieren esos kilos: `'kg'` es la carga tal cual y no añade nada, mientras `'total'`,
 * `'por lado'` y `'por mano'` cambian lo que hay que poner en la barra o en cada
 * mancuerna. Leerla como si fuera la unidad daba «120 kg (kg)», la unidad dos veces en
 * un texto que lee el asesorado.
 *
 * Es el mismo reparto que hace `sufijoUnidad()` en `domain/prescripcion.ts`, que
 * también deja `'kg'` sin sufijo: si aquí se dijera otra cosa, la pared y la
 * prescripción escrita contarían dos historias del mismo ejercicio.
 */
function matizDeUnidad(unidad: UnidadCarga | undefined): string {
  return unidad === undefined || unidad === 'kg' ? '' : ` (${unidad})`
}

/** Mayúscula inicial, para los nombres de articulación que vienen en minúscula. */
function mayus(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Desde dónde mira el móvil, dicho en corto. */
const NOMBRE_DE_VISTA: Record<Vista, string> = {
  lateral: 'de perfil',
  frontal: 'de frente',
  cenital: 'desde arriba',
}

/** Un campo antes de repartirlo: el texto completo y su versión de pared. */
interface Campo {
  clave: ClaveDeCampo
  titulo: string
  completo: string
  /** La versión corta, si la corta no es simplemente el recorte del completo. */
  corto?: string
}

// ---------------------------------------------------------------------------

/**
 * Los nueve textos de pared de un ejercicio, más lo que no cupo.
 *
 * @param ejercicio La prescripción tal cual la guarda el microciclo.
 */
export function contenidoPared(ejercicio: EjercicioPrescrito): ContenidoDePared {
  const plan = planDeMedida(ejercicio.categoria, ejercicio.nombre)
  const campos: Campo[] = []

  // 1. NOMBRE ---------------------------------------------------------------
  campos.push({
    clave: 'nombre',
    titulo: 'Ejercicio',
    completo: ejercicio.nombre,
  })

  // 2. TÉCNICA --------------------------------------------------------------
  // Los cues del coach van enteros al panel; en la pared cabe la primera indicación,
  // que es la que ordena el resto. Recortar la lista entera daría media frase suelta.
  const cues = ejercicio.cues.trim()
  const primeraCue = cues.split(/[.·;]\s*|\n/).map((c) => c.trim()).find((c) => c.length > 0)
  campos.push({
    clave: 'tecnica',
    titulo: 'Técnica',
    completo: cues.length > 0 ? cues : 'Sin indicaciones de técnica escritas.',
    corto: primeraCue ? recortar(primeraCue) : 'Sin indicaciones escritas',
  })

  // 3. COLOCACIÓN DEL MÓVIL -------------------------------------------------
  // De qué plano se mide no es una preferencia: un eje que pide otra cámara NO se mide,
  // y decirlo es lo que evita que salga a pantalla un número como si estuviera medido.
  if (plan) {
    const vista = NOMBRE_DE_VISTA[plan.vista]
    const partes = [`Móvil ${vista}, para ver girar los ejes principales.`]
    if (plan.unilateral) {
      partes.push('La carga va a un solo lado: hay que grabar el lado que trabaja.')
    }
    if (plan.fueraDeVista.length > 0) {
      partes.push(`Desde esta vista no se miden: ${plan.fueraDeVista.join('; ')}.`)
    }
    // Los límites vienen escritos del dominio y arrancan en minúscula: van detrás de
    // un encabezado propio y no pegados a la frase anterior, que los dejaba a media
    // oración y se leían como un error de redacción.
    if (plan.limites.length > 0) partes.push(`Límites: ${plan.limites.join(' ')}`)
    campos.push({
      clave: 'colocacionMovil',
      titulo: 'Dónde se pone el móvil',
      completo: partes.join(' '),
      corto: recortar(`Móvil ${vista}${plan.unilateral ? ' · un solo lado' : ''}`),
    })
  } else {
    campos.push({
      clave: 'colocacionMovil',
      titulo: 'Dónde se pone el móvil',
      completo:
        'Este ejercicio no tiene modelo de palanca en el catálogo, así que no hay una ' +
        'vista de cámara prescrita. Coloca el móvil donde se vea el recorrido completo.',
      corto: 'Sin vista prescrita',
    })
  }

  // 4. DISTANCIA ------------------------------------------------------------
  // Los metros salen de la MISMA constante con la que se construye la estación en 3D:
  // si la sala se mueve, este texto se mueve con ella.
  const { distancia: dist, altura, anguloGrados } = SALA.estacion
  campos.push({
    clave: 'distancia',
    titulo: 'Distancia y altura',
    completo:
      `El móvil va a ${cifra(dist, 1)} m del sujeto, con la lente a ${cifra(altura, 1)} m del ` +
      `suelo y sobre el eje de la estación (${anguloGrados}°, perpendicular al plano ` +
      `sagital). La puerta de encuadre admite hasta ${SALA.tolerancia.conDisco}° de ` +
      `desvío si se ve un disco en la toma, y solo ${SALA.tolerancia.sinDisco}° si no: ` +
      'sin disco no hay con qué corregir el escorzo.',
    corto: `A ${cifra(dist, 1)} m · lente a ${cifra(altura, 1)} m`,
  })

  // 5. BRAZO DE MOMENTO -----------------------------------------------------
  if (!plan) {
    campos.push({
      clave: 'brazoDeMomento',
      titulo: 'Brazo de momento',
      completo:
        'Sin modelo de palanca para esta categoría no hay brazo que prometer. El número ' +
        'saldría igual, pero no hablaría de este ejercicio.',
      corto: 'Sin modelo de palanca',
    })
  } else if (!plan.brazoPorDistanciaHorizontal) {
    campos.push({
      clave: 'brazoDeMomento',
      titulo: 'Brazo de momento',
      completo:
        'Con un raíl o una leva de por medio deja de valer la regla de la que sale todo: ' +
        'el brazo externo ya no es la distancia horizontal del eje a la vertical de la ' +
        'carga. El número seguiría saliendo, variaría entre repeticiones y ya no hablaría ' +
        'del atleta. Aquí se enseñan ángulos y se callan los momentos.',
      corto: 'Raíl o leva: solo ángulos',
    })
  } else {
    const eje = plan.ejes.find((e) => e.articulacion === plan.ejeObjetivo) ?? plan.ejes[0]
    const [mmMin, mmMax] = eje.brazoInternoMm
    campos.push({
      clave: 'brazoDeMomento',
      titulo: 'Brazo de momento',
      completo:
        `${mayus(eje.articulacion)} (${eje.protagonismo}, ${eje.accion}): brazo interno de ` +
        `${mmMin} a ${mmMax} mm. Es de tabla y orientativo —varía con el ángulo articular—, ` +
        `no medible con la cámara. ${plan.alineacion.regla} ${plan.alineacion.porQue}`,
      corto: recortar(`${mayus(eje.articulacion)} · ${mmMin}–${mmMax} mm`),
    })
  }

  // 6. VELOCIDAD ------------------------------------------------------------
  // Un %PV suelto dice cuánto se frenó la barra, no si eso fue lo pedido. Sin objetivo
  // escrito, la velocidad no informa y manda el RIR — y eso se dice, no se calla.
  if (ejercicio.pvObjetivo !== undefined) {
    campos.push({
      clave: 'velocidad',
      titulo: 'Pérdida de velocidad',
      completo:
        `Objetivo de pérdida de velocidad: ${cifra(ejercicio.pvObjetivo)} puntos ` +
        'porcentuales. Es lo que convierte el %PV medido en una señal. La banda de la ' +
        'clientela de Alpha —composición corporal— es 20-35 %, no los 10-20 % de deportista.',
      corto: recortar(`Perder ${cifra(ejercicio.pvObjetivo)} % de velocidad`),
    })
  } else {
    campos.push({
      clave: 'velocidad',
      titulo: 'Pérdida de velocidad',
      completo:
        'Este ejercicio no lleva objetivo de pérdida de velocidad, así que la velocidad ' +
        'no informa y la intensidad la manda el RIR.',
      corto: 'Sin objetivo: manda el RIR',
    })
  }

  // 7. SERIES Y REPETICIONES ------------------------------------------------
  const ondulado = ejercicio.seriesPrescritas ?? []
  if (ondulado.length > 0) {
    const detalle = ondulado
      .map((s) => `serie ${s.orden}: ${s.reps} reps a ${cifra(s.cargaKg)} kg, RIR ${s.rir}`)
      .join(' · ')
    campos.push({
      clave: 'seriesReps',
      titulo: 'Series y repeticiones',
      completo:
        `${ejercicio.sets} series onduladas (rango ${ejercicio.rango}, diana ` +
        `${ejercicio.repsDiana}) — ${detalle}. Descanso ${cifra(ejercicio.descansoMin)} min.`,
      corto: recortar(`${ejercicio.sets} × ondulado (${ejercicio.rango})`),
    })
  } else {
    campos.push({
      clave: 'seriesReps',
      titulo: 'Series y repeticiones',
      completo:
        `${ejercicio.sets} series de ${ejercicio.rango} repeticiones, diana ` +
        `${ejercicio.repsDiana}. Descanso ${cifra(ejercicio.descansoMin)} min entre series.`,
      corto: recortar(`${ejercicio.sets} × ${ejercicio.rango}`),
    })
  }

  // 8. CARGA ----------------------------------------------------------------
  //
  // Los kilos vivían SOLO en el mando de registrar, que es un botón plegado: para saber
  // cuánto poner en la barra había que desplegar un control. En una pared de gimnasio la
  // carga es de lo primero que se mira, y va con las series y el RIR — los tres juntos
  // son la prescripción de la serie.
  //
  // `cargaKg` sin definir **NO es carga cero**: es «esta prescripción no lleva kilos»
  // —porcentajes, peso corporal, tiempo—. Escribir «0 kg» ahí sería decir una carga que
  // el coach no puso, así que la pared dice que no los lleva. Es la misma distinción que
  // guarda el propio tipo en `domain/types.ts`.
  const cargasOnduladas = ondulado.map((s) => s.cargaKg).filter((k) => Number.isFinite(k))
  if (ejercicio.cargaKg !== undefined) {
    const kilos = `${cifra(ejercicio.cargaKg)} kg${matizDeUnidad(ejercicio.unidadCarga)}`
    campos.push({
      clave: 'carga',
      titulo: 'Carga',
      completo: `${kilos}. Es la carga con la que se entra a la serie; el mando de registrar la deja cambiar antes de guardar.`,
      corto: kilos,
    })
  } else if (cargasOnduladas.length > 0) {
    // En un ondulado no hay UNA carga: hay una por serie, y ya salen enteras en el campo
    // de series. Aquí va la horquilla, que es lo que se necesita para cargar la barra.
    const menor = Math.min(...cargasOnduladas)
    const mayor = Math.max(...cargasOnduladas)
    const horquilla =
      menor === mayor ? `${cifra(menor)} kg` : `${cifra(menor)} a ${cifra(mayor)} kg`
    campos.push({
      clave: 'carga',
      titulo: 'Carga',
      completo: `Ondulado: de ${cifra(menor)} a ${cifra(mayor)} kg, serie a serie. La de cada serie está en el campo de series.`,
      corto: horquilla,
    })
  } else {
    campos.push({
      clave: 'carga',
      titulo: 'Carga',
      completo:
        'Esta prescripción no lleva kilos: la intensidad la manda el RIR, el peso ' +
        'corporal o el tiempo. No es carga cero, es que no hay número que poner.',
      corto: 'Sin kilos',
    })
  }

  // 9. RIR ------------------------------------------------------------------
  // `FALLO` NO es `RIR 0`, y por eso el texto sale de `textoDeObjetivo()` y no de una
  // plantilla local: un cero aquí diría otra cosa que la que el coach prescribió.
  const objetivo = ejercicio.rirObjetivo
  campos.push({
    clave: 'rir',
    titulo: 'Proximidad al fallo',
    completo: esAlFallo(objetivo)
      ? 'FALLO: la instrucción es meterse en la repetición parcial. NO es lo mismo que ' +
        'RIR 0, que es la última repetición completa con la parcial en reserva.'
      : objetivo === 1
        ? 'RIR 1: se deja 1 repetición en reserva al acabar la serie.'
        : `RIR ${objetivo}: se dejan ${objetivo} repeticiones en reserva al acabar la serie.`,
    corto: textoDeObjetivo(objetivo),
  })

  // ---------------------------------------------------------------------------
  // El reparto: qué se queda arriba y qué baja
  // ---------------------------------------------------------------------------

  const pared = {} as Record<ClaveDeCampo, string>
  const alPanel: TextoDePanel[] = []

  for (const campo of campos) {
    const corto = recortar(campo.corto ?? campo.completo)
    pared[campo.clave] = corto
    // Solo baja lo que NO está ya entero arriba. Bajar también lo que cabe llenaría el
    // panel de repeticiones y enterraría lo que de verdad hay que leer ahí.
    const completoLimpio = campo.completo.replace(/\s+/g, ' ').trim()
    if (completoLimpio !== corto) {
      alPanel.push({
        campo: campo.clave,
        titulo: campo.titulo,
        texto: completoLimpio,
        huella: huellaDeTexto(completoLimpio),
      })
    }
  }

  // Lo que NO tiene pared: son textos del ejercicio que hoy se ven en la tarjeta y que
  // ninguna pared puede llevar. Van abajo enteros, porque no se puede perder nada.
  const extras: { titulo: string; texto: string | undefined }[] = [
    { titulo: 'Categoría', texto: ejercicio.categoria },
    { titulo: 'Prescripción', texto: ejercicio.prescripcion },
    { titulo: 'Nota del coach', texto: ejercicio.notaCoach },
    {
      titulo: 'Etiquetas de las series',
      texto: ejercicio.etiquetasSeries?.length ? ejercicio.etiquetasSeries.join(' · ') : undefined,
    },
    {
      titulo: 'Si el día viene bueno',
      texto: ejercicio.escenarios
        ? `Techo ${cifra(ejercicio.escenarios.verde.techoCargaKg)} kg` +
          (ejercicio.escenarios.verde.deltaCargaKg !== undefined
            ? `, sube hasta ${cifra(ejercicio.escenarios.verde.deltaCargaKg)} kg`
            : ', sin subir carga') +
          (ejercicio.escenarios.verde.serieExtra ? ', con una serie extra autorizada.' : '.')
        : undefined,
    },
    {
      titulo: 'Si el día viene malo',
      texto: ejercicio.escenarios
        ? `Se suelta${ejercicio.escenarios.rojo.deltaRir === 1 ? ' 1 escalón' : `n ${ejercicio.escenarios.rojo.deltaRir} escalones`}` +
          ` de RIR, con suelo en RIR ${ejercicio.escenarios.rojo.sueloRir}` +
          (ejercicio.escenarios.rojo.quitarUltimaSerie ? ', y se recorta la última serie.' : '.')
        : undefined,
    },
  ]

  for (const extra of extras) {
    const texto = extra.texto?.replace(/\s+/g, ' ').trim()
    if (!texto) continue
    alPanel.push({ titulo: extra.titulo, texto, huella: huellaDeTexto(texto) })
  }

  return {
    nombre: pared.nombre,
    tecnica: pared.tecnica,
    colocacionMovil: pared.colocacionMovil,
    distancia: pared.distancia,
    brazoDeMomento: pared.brazoDeMomento,
    velocidad: pared.velocidad,
    seriesReps: pared.seriesReps,
    carga: pared.carga,
    rir: pared.rir,
    alPanel,
  }
}
