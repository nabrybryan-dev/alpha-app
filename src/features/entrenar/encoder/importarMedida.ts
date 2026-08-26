import type { CausasDescarte, FotogramaBrazo, MedidaDePalancas } from './medidaDePalancas'

/**
 * Leer una medida de palancas producida fuera de la app.
 *
 * ## Por qué se importa en vez de calcularse
 *
 * La medida sale de `exportar-medida.mjs`, en el repo de herramientas, que
 * encadena detección de pose (ONNX, ~1 min de CPU por vídeo), la escala por
 * proporciones y el brazo fotograma a fotograma. Nada de eso puede correr en el
 * navegador de un móvil en un gimnasio, así que **se pasan datos, no código** —
 * la misma frontera que ya existe entre `exportar-plan.mjs` y el encoder.
 *
 * Esto no es un apaño provisional disfrazado: es la única forma honesta de
 * enseñar hoy una medida real. El día que la pose corra en el dispositivo, lo
 * que cambia es de dónde sale el objeto, no la pantalla que lo pinta.
 *
 * ## Por qué se valida, y por qué así
 *
 * Un JSON que no es una medida tiene que fallar **con una frase**, no pintando
 * una pantalla vacía ni un `NaN` a cuerpo de titular. Y la validación mira lo que
 * la pantalla necesita para no mentir —el eje, la escala, el recuento— y no la
 * forma entera: un esquema exhaustivo aquí rechazaría medidas buenas el día que
 * la tubería añada un campo, que es justo lo que no debe pasar.
 */

export type Importacion =
  | { ok: true; medida: MedidaDePalancas }
  | { ok: false; problema: string }

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function numero(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Los fotogramas que la gráfica puede dibujar; el resto se descartan. */
function fotogramasValidos(v: unknown): FotogramaBrazo[] {
  if (!Array.isArray(v)) return []
  return v.filter((f): f is FotogramaBrazo => esObjeto(f) && numero(f.t) && typeof f.ok === 'boolean')
}

/**
 * El reparto de por qué se cayó cada fotograma.
 *
 * No se castea: es lo que decide **qué frase se puede decir**. Con el grueso en
 * `sin_consenso` la pantalla dice que repetir no lo arregla; con el grueso en
 * `sin_persona` dice lo contrario. Un objeto a medias que pasara por aquí sin
 * mirar acabaría mandando a alguien a no repetir una toma que sí iba a salir.
 */
function causasValidas(v: unknown): CausasDescarte | undefined {
  if (!esObjeto(v)) return undefined
  const claves: Array<keyof CausasDescarte> = [
    'sin_persona',
    'sin_carga',
    'sin_consenso',
    'sin_eje',
    'salto',
  ]
  if (!claves.every((k) => numero(v[k]))) return undefined
  return {
    sin_persona: v.sin_persona as number,
    sin_carga: v.sin_carga as number,
    sin_consenso: v.sin_consenso as number,
    sin_eje: v.sin_eje as number,
    salto: v.salto as number,
  }
}

/** El instante del brazo máximo. `fraccion` puede faltar y se dice, no se rellena. */
function maximoValido(v: unknown): MedidaDePalancas['maximoEje'] {
  if (!esObjeto(v) || !numero(v.mm) || !numero(v.t)) return undefined
  return { mm: v.mm, t: v.t, fraccion: numero(v.fraccion) ? v.fraccion : null }
}

export function importarMedida(texto: string): Importacion {
  let crudo: unknown
  try {
    crudo = JSON.parse(texto)
  } catch {
    return { ok: false, problema: 'Eso no es un archivo JSON.' }
  }
  if (!esObjeto(crudo)) {
    return { ok: false, problema: 'El archivo no contiene una medida.' }
  }

  // `ejeObjetivo` es lo que decide qué número se pinta a cuerpo de titular. Sin
  // él la pantalla no sabe de qué está hablando.
  if (typeof crudo.ejeObjetivo !== 'string' || !crudo.ejeObjetivo) {
    return {
      ok: false,
      problema: 'Falta el eje protagónico. ¿Es la salida de `exportar-medida.mjs`?',
    }
  }

  const escala = esObjeto(crudo.escala) ? crudo.escala : undefined
  if (!escala || typeof escala.fiable !== 'boolean') {
    return {
      ok: false,
      problema: 'Falta si la escala es fiable, y de eso depende que el número se pueda sostener.',
    }
  }

  // La sigma no puede faltar ni venir a cero: un brazo sin barra de error se lee
  // como una medida exacta, que es la mentira que esta pantalla existe para no
  // contar.
  if (!numero(crudo.sigmaBrazoMm) || crudo.sigmaBrazoMm <= 0) {
    return { ok: false, problema: 'La medida no trae barra de error, y sin ella no se pinta.' }
  }

  const medida: MedidaDePalancas = {
    ok: crudo.ok === true,
    motivo: typeof crudo.motivo === 'string' ? crudo.motivo : undefined,
    explicacion: typeof crudo.explicacion === 'string' ? crudo.explicacion : undefined,
    negativas: Array.isArray(crudo.negativas)
      ? crudo.negativas.filter((n): n is string => typeof n === 'string')
      : [],
    escala: {
      mmPorPx: numero(escala.mmPorPx) ? escala.mmPorPx : 0,
      dispersion: numero(escala.dispersion) ? escala.dispersion : 0,
      fiable: escala.fiable,
    },
    sigmaArticulacionPx: numero(crudo.sigmaArticulacionPx) ? crudo.sigmaArticulacionPx : 0,
    sigmaBrazoMm: crudo.sigmaBrazoMm,
    ejeObjetivo: crudo.ejeObjetivo,
    grupoObjetivo: typeof crudo.grupoObjetivo === 'string' ? crudo.grupoObjetivo : '',
    grupoObjetivoTexto:
      typeof crudo.grupoObjetivoTexto === 'string' ? crudo.grupoObjetivoTexto : undefined,
    porFotograma: fotogramasValidos(crudo.porFotograma),
    medidos: numero(crudo.medidos) ? crudo.medidos : 0,
    total: numero(crudo.total) ? crudo.total : 0,
    descartadosPorSalto: numero(crudo.descartadosPorSalto) ? crudo.descartadosPorSalto : 0,
    causas: causasValidas(crudo.causas),
    maximoEje: maximoValido(crudo.maximoEje),
  }

  // Una medida que se declara buena y no trae ni un fotograma dibujaría una
  // gráfica vacía bajo un número: mejor decirlo.
  if (medida.ok && medida.porFotograma.length === 0) {
    return { ok: false, problema: 'La medida dice que salió bien pero no trae fotogramas.' }
  }

  return { ok: true, medida }
}

/** De dónde salió, si el exportador lo anotó. Nunca lleva datos de nadie. */
export function origenDe(texto: string): { video?: string; ejercicio?: string } | undefined {
  try {
    const d = JSON.parse(texto) as { origen?: { video?: string; ejercicio?: string } }
    return esObjeto(d) && esObjeto(d.origen) ? d.origen : undefined
  } catch {
    return undefined
  }
}
