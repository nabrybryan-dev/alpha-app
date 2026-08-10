/**
 * Si la asesorada está embarazada hoy, y qué alimentos eso contraindica.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE
 * ─────────────────────────────────────────────────────────────────────────────
 * El hígado tiene retinol —vitamina A preformada— y el retinol en exceso es
 * teratógeno. No es un «cuidado con pasarte» como el resto de los techos: es
 * una contraindicación, y la única del catálogo que depende de quién come.
 *
 * Las herramientas del Cerebro ya sabían aplicarla (`topes_nutrientes.py`,
 * VETO_POR_CONDICION) desde el 2026-08-07. Lo que faltaba era lo más simple y
 * lo más importante: **un sitio donde declarar la condición**. Sin eso el veto
 * estaba escrito, probado y no protegía a nadie.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODAS LAS DUDAS SE RESUELVEN A FAVOR DE PROTEGER
 * ─────────────────────────────────────────────────────────────────────────────
 * Los dos errores posibles no cuestan lo mismo:
 *
 *   - Darla por embarazada sin estarlo → deja de verse el hígado entre las
 *     sugerencias. Molesto y reversible en un toque.
 *   - Darla por NO embarazada estándolo → se le recomienda un teratógeno.
 *
 * Por eso una fecha ilegible, o que falte, no apaga la marca. Lo único que la
 * apaga es que ella diga que no, o que la fecha probable de parto ya pasara.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA MARCA CADUCA SOLA
 * ─────────────────────────────────────────────────────────────────────────────
 * Es el motivo de pedir la fecha probable de parto en vez de un sí o un no. Un
 * embarazo dura nueve meses; una casilla marcada dura hasta que alguien se
 * acuerde de desmarcarla, y nadie se acuerda. Pasada la fecha, la app vuelve a
 * preguntar en lugar de seguir suponiendo —ni que sigue embarazada, ni que ya
 * no lo está—.
 *
 * NO DECIDE NADA CLÍNICO. Esconde el hígado de las sugerencias y avisa. La
 * restricción individual la pone Manuela; esto solo evita que la app sugiera
 * por su cuenta algo contraindicado.
 */

import { sinTildes } from './busqueda'

/** Lo que la encuesta puede haber contestado sobre embarazo o lactancia. */
export interface RespuestasDeEmbarazo {
  embarazo?: string | number | string[]
  fechaProbableParto?: string | number | string[]
}

/**
 * Palabras que hacen a un alimento contraindicado en embarazo.
 *
 * Es la misma lista que `PALABRAS_VETADAS_EN['embarazo']` en el Cerebro. Se
 * repite aquí y no se importa porque la app corre en el navegador del
 * asesorado y no ve los módulos de Python; son dos palabras, y el test
 * `seContraindica` fija su comportamiento por si alguna vez divergen.
 *
 * Van sin tilde porque la comparación normaliza los dos lados.
 */
export const PALABRAS_CONTRAINDICADAS = ['higado', 'menudencias'] as const

/**
 * Si a día de hoy hay embarazo declarado y vigente.
 *
 * `hoy` se pasa en vez de leerse del reloj para que el resultado sea el mismo
 * cada vez que se calcula: un dato que cambia solo a medianoche es imposible de
 * reproducir cuando alguien reporta que la app le hizo algo raro.
 */
export function estaEmbarazada(respuestas: RespuestasDeEmbarazo, hoy: string): boolean {
  if (respuestas.embarazo !== 'si') return false

  const fecha = respuestas.fechaProbableParto
  if (typeof fecha !== 'string' || fecha.trim() === '') return true

  // Las dos en ISO (aaaa-mm-dd) se comparan como texto y coinciden con el orden
  // cronológico, así que no hace falta construir fechas —y no construirlas
  // evita el desfase de zona horaria, que en Colombia adelanta o atrasa un día.
  const esIso = /^\d{4}-\d{2}-\d{2}$/.test(fecha)
  if (!esIso) return true

  return fecha >= hoy
}

/**
 * Si a día de hoy hay lactancia declarada.
 *
 * NO CADUCA SOLA, y es la diferencia con el embarazo. Un embarazo tiene fecha
 * de final probable; una lactancia no —dura lo que la madre decida— así que
 * inventarle un vencimiento sería decidir por ella. Lo que hay en su lugar es
 * la pregunta que vuelve cada quince días.
 */
export function enLactancia(respuestas: RespuestasDeEmbarazo): boolean {
  return respuestas.embarazo === 'lactancia'
}

/**
 * Las condiciones declaradas que bajan un límite, para pasárselas a `techos`.
 *
 * NO SON LO MISMO Y POR ESO SON DOS. Comparten pregunta porque para la
 * asesorada es una sola conversación, y se separan aquí porque el embarazo
 * además contraindica el hígado y la lactancia no: nadie le prohíbe el hígado a
 * quien amamanta. Lo que sí comparten es el umbral mínimo de vitamina A.
 */
export function condicionesDeclaradas(
  respuestas: RespuestasDeEmbarazo,
  hoy: string,
): Set<string> {
  const condiciones = new Set<string>()
  if (estaEmbarazada(respuestas, hoy)) condiciones.add('embarazo')
  if (enLactancia(respuestas)) condiciones.add('lactancia')
  return condiciones
}

/**
 * Si este alimento está contraindicado en embarazo, por su nombre.
 *
 * COMPARA POR PALABRA ENTERA, nunca por trozo. Es la regla del repo y tiene su
 * cicatriz: buscar «lengua» dentro del nombre casaba con «Lenguado», y agrupar
 * mal dos alimentos distintos es un error que no se ve. Aquí el riesgo es el
 * simétrico —esconderle a alguien un alimento que no tenía por qué esconderse—.
 */
export function seContraindica(nombre: string): boolean {
  const palabras = sinTildes(nombre).split(/[^a-z0-9]+/)
  return palabras.some((palabra) =>
    PALABRAS_CONTRAINDICADAS.some((vetada) => palabra === vetada),
  )
}
