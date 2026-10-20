import type { Cifra } from './contrato'

/**
 * A-PROCEDENCIAS: ninguna cifra circula sin su fila en `PROCEDENCIAS.tsv`.
 *
 * El libro vive en `cerebro-alpha/herramientas/encoder-camara/PROCEDENCIAS.tsv` (columnas:
 * cifra, que_es, comando_que_la_produce, estado, fecha, nota). Para las tablas del sujeto cada
 * valor tiene su fila, y la columna `que_es` EMPIEZA por el id entre corchetes:
 *
 *     0.1416   [deleva96.h.muslo.masa] fracción de la masa corporal…   <fuente>   transcrito   …
 *
 * Esa forma permite comprobar dos cosas que una lista a mano no comprueba: que cada constante
 * del código tiene fila, y que el valor del código es el de la fila (si alguien cambia uno y no
 * el otro, el arnés se pone rojo).
 *
 * Esta función es pura: recibe el texto del TSV. Quien lee el disco es
 * `scripts/comprobar-procedencias-sujeto.mts`, que es lo que corre de verdad.
 */

export interface FilaDeProcedencia {
  id: string
  valor: string
  estado: string
}

/** Estados que no pueden respaldar una cifra: el origen no existe o no es el que se dijo. */
export const ESTADOS_QUE_NO_RESPALDAN = ['INVENTADO', 'ENGAÑOSO']

const ID = /^\[([^\]]+)\]/

export function leerProcedencias(tsv: string): FilaDeProcedencia[] {
  const filas: FilaDeProcedencia[] = []
  for (const linea of tsv.split(/\r?\n/).slice(1)) {
    if (linea.trim() === '') continue
    const col = linea.split('\t')
    const m = ID.exec((col[1] ?? '').trim())
    if (!m) continue
    filas.push({ id: m[1], valor: (col[0] ?? '').trim(), estado: (col[3] ?? '').trim() })
  }
  return filas
}

export interface ProblemaDeProcedencia {
  id: string
  problema: 'sin_fila' | 'fila_duplicada' | 'valor_distinto' | 'estado_que_no_respalda'
  detalle: string
}

/**
 * Compara los valores que el código declara (`id → valor`) con el libro.
 * Compara como número, para que `0.10` y `0.1` no den rojo.
 */
export function verificarValoresRegistrados(
  valores: Readonly<Record<string, number>>,
  tsv: string,
): ProblemaDeProcedencia[] {
  const filas = leerProcedencias(tsv)
  const problemas: ProblemaDeProcedencia[] = []
  for (const [id, valor] of Object.entries(valores)) {
    const propias = filas.filter((f) => f.id === id)
    if (propias.length === 0) {
      problemas.push({ id, problema: 'sin_fila', detalle: 'el código tiene la constante y el libro no tiene su fila' })
      continue
    }
    if (propias.length > 1) {
      problemas.push({ id, problema: 'fila_duplicada', detalle: `${propias.length} filas con el mismo id` })
      continue
    }
    const fila = propias[0]
    if (Number(fila.valor) !== valor) {
      problemas.push({ id, problema: 'valor_distinto', detalle: `código ${valor}, libro ${fila.valor}` })
    }
    if (ESTADOS_QUE_NO_RESPALDAN.includes(fila.estado)) {
      problemas.push({ id, problema: 'estado_que_no_respalda', detalle: `estado ${fila.estado}` })
    }
  }
  return problemas
}

/** Las fuentes que una cifra nombra y el libro no tiene (o tiene marcadas como inventadas). */
export function verificarFuentesDeCifras(cifras: readonly Cifra[], tsv: string): ProblemaDeProcedencia[] {
  const filas = leerProcedencias(tsv)
  const problemas: ProblemaDeProcedencia[] = []
  for (const c of cifras) {
    for (const f of c.fuente) {
      const fila = filas.find((x) => x.id === f)
      if (!fila) {
        problemas.push({ id: f, problema: 'sin_fila', detalle: `la cifra «${c.id}» cita una fuente que el libro no tiene` })
      } else if (ESTADOS_QUE_NO_RESPALDAN.includes(fila.estado)) {
        problemas.push({ id: f, problema: 'estado_que_no_respalda', detalle: `«${c.id}» cita una fila ${fila.estado}` })
      }
    }
  }
  return problemas
}
