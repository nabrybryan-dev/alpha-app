import { ESTADOS, UNIDADES, type EstadoDeCifra, type Unidad } from './convenciones'

/**
 * EL CONTRATO DE UNA CIFRA (M9).
 *
 * Todo número que el sujeto anatómico le entregue a otra capa —el salón, la reunión con el
 * asesorado, un informe— viaja así, con lo que permitiría comprobarlo. Es el remedio mecánico
 * de `PLAN-PROCEDENCIAS.md`: la buena voluntad ya falló dos veces (un 12,2 % que no existe y
 * un 17 de 32 medido con la respuesta delante).
 *
 * Tres reglas que no se negocian (principios P-6 y P-8 del plan):
 *
 *  1. **`null` no es cero.** Si falta algo, la cifra es `no_afirmable` y su valor es `null`.
 *     Un cero que sale de un dato ausente es el error que más daño hace, porque parece una
 *     medida. Y un `null` se propaga: lo que depende de una cifra `null` no puede traer número.
 *  2. **Unidad declarada**, de un conjunto cerrado (`UNIDADES`). Sin unidad no hay cifra.
 *  3. **Procedencia**: cada cifra con valor nombra al menos una fila de `PROCEDENCIAS.tsv`.
 *     `procedencias.ts` comprueba que la fila existe y que no está marcada como inventada.
 *
 * Este módulo no calcula nada de biomecánica: solo juzga si una cifra puede circular.
 */

export interface Banda {
  inf: number
  sup: number
  /** Qué cubre el intervalo, p. ej. «p5 a p95 del muestreo de 2000 sujetos». */
  nivel: string
}

export interface Cifra {
  /** Nombre estable de la cifra, p. ej. `sentadilla.momento.rodilla`. */
  id: string
  valor: number | null
  unidad: Unidad
  estado: EstadoDeCifra
  /** Ids de `PROCEDENCIAS.tsv` (columna `que_es`, entre corchetes) de las que sale. */
  fuente: readonly string[]
  /** Lo que se dio por cierto sin medirlo. */
  supuestos: readonly string[]
  banda: Banda | null
  version: string
  /** Obligatorio si `no_afirmable`: por qué no se puede afirmar. */
  motivo?: string
  /** Cifras de las que esta depende. Si alguna es `null`, esta también. */
  dependeDe?: readonly Cifra[]
}

export type CodigoDeError =
  | 'E_VALOR_NO_FINITO'
  | 'E_CERO_POR_NULL'
  | 'E_NULL_SIN_ESTADO'
  | 'E_NULL_NO_SE_PROPAGA'
  | 'E_UNIDAD_NO_DECLARADA'
  | 'E_ESTADO_DESCONOCIDO'
  | 'E_SIN_PROCEDENCIA'
  | 'E_SIN_MOTIVO'
  | 'E_ESTIMADO_SIN_BANDA'
  | 'E_BANDA_INCOHERENTE'
  | 'E_SIN_VERSION'
  | 'E_SIN_ID'

export interface ErrorDeCifra {
  codigo: CodigoDeError
  cifra: string
  detalle: string
}

/** Juzga UNA cifra. Devuelve todos los errores, no solo el primero. Lista vacía = puede circular. */
export function verificarCifra(c: Cifra): ErrorDeCifra[] {
  const errores: ErrorDeCifra[] = []
  const fallo = (codigo: CodigoDeError, detalle: string) =>
    errores.push({ codigo, cifra: c.id || '(sin id)', detalle })

  if (!c.id || c.id.trim() === '') fallo('E_SIN_ID', 'la cifra no tiene nombre')
  if (!c.version || c.version.trim() === '') fallo('E_SIN_VERSION', 'falta la versión del modelo')

  if (!(UNIDADES as readonly string[]).includes(c.unidad as string)) {
    fallo('E_UNIDAD_NO_DECLARADA', `unidad «${String(c.unidad)}» fuera del conjunto cerrado`)
  }

  const estadoValido = (ESTADOS as readonly string[]).includes(c.estado as string)
  if (!estadoValido) fallo('E_ESTADO_DESCONOCIDO', `estado «${String(c.estado)}»`)

  if (c.valor !== null && !Number.isFinite(c.valor)) {
    fallo('E_VALOR_NO_FINITO', `valor ${String(c.valor)}: NaN o infinito no es un número`)
  }

  if (c.estado === 'no_afirmable') {
    // La regla 1 por la cara: «no afirmable» con un número encima, y el cero es el peor.
    if (c.valor !== null) {
      fallo('E_CERO_POR_NULL', `no_afirmable con valor ${String(c.valor)}: debe ser null`)
    }
    if (!c.motivo || c.motivo.trim() === '') fallo('E_SIN_MOTIVO', 'no_afirmable sin decir por qué')
  } else if (estadoValido) {
    if (c.valor === null) fallo('E_NULL_SIN_ESTADO', `valor null con estado ${c.estado}`)
    if (c.fuente.length === 0 || c.fuente.some((f) => f.trim() === '')) {
      fallo('E_SIN_PROCEDENCIA', 'cifra con valor y sin fila en PROCEDENCIAS.tsv')
    }
    if (c.estado === 'estimado' && c.banda === null) {
      fallo('E_ESTIMADO_SIN_BANDA', 'una estimación sin banda es un número sin su error')
    }
  }

  if (c.banda !== null) {
    const { inf, sup } = c.banda
    const incoherente =
      !Number.isFinite(inf) ||
      !Number.isFinite(sup) ||
      inf > sup ||
      (c.valor !== null && Number.isFinite(c.valor) && (c.valor < inf || c.valor > sup))
    if (incoherente) fallo('E_BANDA_INCOHERENTE', `banda [${inf}, ${sup}] no contiene el valor ${String(c.valor)}`)
  }

  // La regla 1, segunda mitad: un null aguas arriba no puede dar un número aguas abajo.
  if (c.estado !== 'no_afirmable' && c.valor !== null) {
    const nula = (c.dependeDe ?? []).find((d) => d.valor === null)
    if (nula) fallo('E_NULL_NO_SE_PROPAGA', `depende de «${nula.id}», que es null`)
  }
  return errores
}

/** Juzga un conjunto. Una lista vacía quiere decir que todas pueden circular. */
export function verificarCifras(cifras: readonly Cifra[]): ErrorDeCifra[] {
  return cifras.flatMap(verificarCifra)
}

/** Atajo para una cifra que no se puede afirmar: valor `null`, nunca cero. */
export function noAfirmable(id: string, unidad: Unidad, motivo: string, version: string): Cifra {
  return {
    id,
    valor: null,
    unidad,
    estado: 'no_afirmable',
    fuente: [],
    supuestos: [],
    banda: null,
    version,
    motivo,
  }
}
