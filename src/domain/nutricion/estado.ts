/**
 * Resuelve si un alimento se registró crudo o cocido (R1 del spec).
 *
 * ES LA REGLA QUE MÁS ERROR EVITA DE TODO EL SISTEMA:
 *
 *     arroz    353 kcal crudo -> 130 cocido   (x2,7)
 *     frijol   386 -> 136                      (x2,8)
 *     lenteja  387 -> 116                      (x3,3)
 *
 * Confundirlos supera a cualquier otro error del registro junto. Por eso la
 * app pregunta -una sola vez por alimento- y lo recuerda.
 *
 * POR DEFECTO, COCIDO. Decisión de Bryan: es lo que de verdad se sirven, es
 * lo que van a poder estimar en la fase 2, y no obliga a pesar antes de
 * cocinar para toda la familia.
 *
 * LA PREGUNTA SALE POCAS VECES. Solo 65 de las 1.089 familias del catálogo
 * tienen más de un estado. En el resto no hay nada que preguntar y no se
 * pregunta: una app que pregunta de más se deja de usar.
 */

/** Una fila del catálogo: lo que estado.ts necesita, más lo que traiga. */
export interface AlimentoCatalogo {
  id: string
  nombre: string
  estado: string
  [clave: string]: unknown
}

// Los estados entre los que tiene sentido preguntar. "listo", "preparado" y
// "en_lata" no tienen contraparte que alguien pueda pesar en la otra forma.
export const ESTADOS_PESABLES: readonly string[] = ['crudo', 'cocido', 'seco']

export const POR_DEFECTO = 'cocido'

// Coletillas de una sola palabra que no distinguen un alimento de otro, solo
// su preparación.
const COLETILLAS = new Set([
  'crudo',
  'cruda',
  'cocido',
  'cocida',
  'seco',
  'seca',
  'asado',
  'asada',
  'frito',
  'frita',
  'horneado',
  'horneada',
  'dorado',
  'dorada',
])

// "sin sal" / "con sal" son coletillas de DOS palabras, y por eso van
// aparte. No se puede meter "sin"/"con" sueltos en COLETILLAS de arriba: son
// preposiciones que aparecen en nombres compuestos con un sentido que sí
// distingue alimentos -"Papa, con cáscara" no es "Papa, sin cáscara", la
// fibra no es la misma-. Solo se quita el par "sin sal"/"con sal" completo;
// "sin" o "con" sueltos, sin la "sal" al lado, nunca se tocan.
const COLETILLAS_DOBLES: ReadonlyArray<readonly [string, string]> = [
  ['sin', 'sal'],
  ['con', 'sal'],
]

// Separa un nombre en palabras: espacios y la puntuación que el catálogo usa
// para anotar la preparación ("Res, lomo, cocido, sin sal") o fracciones
// ("Carne molida de res 90/10").
const SEPARADORES = /[\s,;:.()/-]+/

// Lo único que sobrevive de cada palabra: letras en minúscula, incluidas las
// vocales acentuadas y la ñ del español.
const NO_LETRAS = /[^a-záéíóúñ]/g

/** Palabras en minúscula de un nombre, solo letras por palabra. */
function tokenizar(nombre: string): string[] {
  const crudas = nombre.toLowerCase().split(SEPARADORES)
  const limpias = crudas.map((palabra) => palabra.replace(NO_LETRAS, ''))
  return limpias.filter((palabra) => palabra !== '')
}

/**
 * Quita las coletillas de una lista de palabras que YA excluye la primera.
 *
 * `familia()` nunca llama a esto con la palabra de identidad incluida: ver
 * el porqué en su docstring.
 */
function quitarColetillas(palabras: string[]): string[] {
  const resultado: string[] = []
  let i = 0
  while (i < palabras.length) {
    const esColetillaDoble = COLETILLAS_DOBLES.some(
      ([p1, p2]) => p1 === palabras[i] && p2 === palabras[i + 1],
    )
    if (esColetillaDoble) {
      i += 2
    } else if (COLETILLAS.has(palabras[i])) {
      i += 1
    } else {
      resultado.push(palabras[i])
      i += 1
    }
  }
  return resultado
}

/**
 * Clave que agrupa el mismo alimento en distintos estados.
 *
 * Compara por PALABRA COMPLETA, no por subcadena, y la primera palabra nunca
 * se toca aunque coincida con una coletilla. Las dos reglas hacen falta
 * juntas, confirmadas contra los 1.195 alimentos reales:
 *
 *     "Cheesecake"    -> antes 'cheeke' (perdía "seca", escondida dentro de
 *                        chee-SECA-ke) -> ahora 'cheesecake'.
 *     "Dorado, crudo" -> antes '' (el pescado dorado quitaba su ÚNICA
 *                        palabra por ser también la coletilla "dorado";
 *                        quedaba idéntico a familia(null)) -> ahora
 *                        'dorado'. Hoy no hay ningún "Dorado" pesable en el
 *                        catálogo, pero el pescado y el pargo dorado existen
 *                        y el catálogo va a crecer.
 *
 * Un nombre sin ninguna palabra (`null`, "", o puro signos de puntuación) no
 * tiene identidad que agrupar: revienta en vez de devolver "" en silencio.
 * Es lo mismo que ya hacen porcion.ts y topes.ts con `null`: con esta regla
 * "" deja de ser una familia alcanzable desde un nombre real, así que ya no
 * hace falta preguntarse si una familia vacía vino de un alimento raro o de
 * un dato inválido -no puede venir de un alimento.
 */
export function familia(nombre: string | null): string {
  if (nombre === null || nombre === '') {
    throw new Error(`familia() necesita un nombre, no ${JSON.stringify(nombre)}`)
  }

  const palabras = tokenizar(nombre)
  if (palabras.length === 0) {
    throw new Error(`nombre sin ninguna palabra reconocible: ${JSON.stringify(nombre)}`)
  }

  const [identidad, ...resto] = palabras
  return [identidad, ...quitarColetillas(resto)].join('')
}

/** TODAS las entradas del catálogo del mismo alimento, en cualquier estado. */
export function variantes(catalogo: AlimentoCatalogo[], nombre: string): AlimentoCatalogo[] {
  const clave = familia(nombre)
  return catalogo.filter((fila) => familia(fila.nombre) === clave)
}

/**
 * Solo las que tiene sentido ofrecer en la pregunta de crudo/cocido.
 *
 * Se separa de `variantes` a propósito: el pan tajado solo existe como
 * `listo`, y si `elegir` mirara únicamente esta lista, todo lo que se compra
 * hecho -pan, galletas, yogur- sería imposible de registrar.
 */
export function variantesPesables(
  catalogo: AlimentoCatalogo[],
  nombre: string,
): AlimentoCatalogo[] {
  return variantes(catalogo, nombre).filter((v) => ESTADOS_PESABLES.includes(v.estado))
}

/** `true` solo si el alimento existe en más de un estado pesable. */
export function hayQuePreguntar(catalogo: AlimentoCatalogo[], nombre: string): boolean {
  const estados = new Set(variantesPesables(catalogo, nombre).map((v) => v.estado))
  return estados.size > 1
}

/**
 * La entrada del catálogo a usar, y si su estado se asumió.
 *
 * El segundo valor es `true` cuando no se pudo respetar la preferencia. La
 * app tiene que decírselo al asesorado: si pesa arroz cocido y solo existe
 * crudo, hace falta que sepa contra qué se le está calculando.
 */
export function elegir(
  catalogo: AlimentoCatalogo[],
  nombre: string,
  preferencia: string | null,
): [AlimentoCatalogo | null, boolean] {
  const opciones = variantes(catalogo, nombre)
  if (opciones.length === 0) {
    return [null, false]
  }

  // Un alimento que solo existe en un estado no tiene nada que elegir ni
  // nada que asumir: es lo que es.
  if (opciones.length === 1) {
    const unico = opciones[0]
    // Truthiness deliberada sobre preferencia (string | null): tanto null
    // como "" significan "sin preferencia expresada" y deben caer al mismo
    // sitio. No es el hueco numérico que se protege en porcion.ts/dia.ts:
    // aquí "" no es un estado válido que pueda confundirse con uno real.
    const asumido =
      ESTADOS_PESABLES.includes(unico.estado) && Boolean(preferencia && preferencia !== unico.estado)
    return [unico, asumido]
  }

  const deseado = preferencia || POR_DEFECTO
  const exactas = opciones.filter((v) => v.estado === deseado)
  if (exactas.length > 0) {
    return [exactas[0], false]
  }

  const porDefecto = opciones.filter((v) => v.estado === POR_DEFECTO)
  return [(porDefecto.length > 0 ? porDefecto : opciones)[0], true]
}
