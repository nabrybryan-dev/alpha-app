import type { Contenido, EjercicioPrescrito, PartePreparacion } from './types'

/**
 * Qué demostración le toca a cada ejercicio de la sesión.
 *
 * Antes esto era una sola línea: `ejercicio.contenidoDemoId ? byId(...) : undefined`.
 * El problema es que **ese campo lo tiene que rellenar quien carga el microciclo**,
 * y los microciclos que se cargan desde el plan del coach no lo traen. Resultado:
 * el botón «Técnica» no aparecía y el asesorado leía eso como que el vídeo no
 * estaba disponible. Lo mismo pasaba si el id apuntaba a una ficha que ya no
 * existe: `byId` devolvía `undefined` y el botón desaparecía sin decir nada.
 *
 * Así que el id explícito sigue mandando cuando resuelve, y cuando no, se cae a
 * la biblioteca por **patrón de movimiento**. La categoría del ejercicio ya es el
 * nombre del patrón ('EMPUJE HORIZONTAL', 'DOMINANTE DE CADERA'…), así que no
 * hace falta tocar ningún dato: los microciclos que ya están cargados empiezan a
 * tener vídeo solos.
 */

/** Sin tildes y en mayúsculas: las dos listas las escriben personas distintas. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase()
}

/**
 * Categorías que no se llaman igual que su patrón en la biblioteca.
 *
 * Las dos tracciones comparten vídeo — el gesto que se explica (llevar el codo,
 * no la mano) es el mismo — y los nombres por músculo se traducen al patrón que
 * les corresponde. Lo que no está aquí se busca tal cual.
 */
const ALIAS: Record<string, string> = {
  'TRACCION VERTICAL': 'TRACCION',
  'TRACCION HORIZONTAL': 'TRACCION',
  JALON: 'TRACCION',
  REMO: 'TRACCION',
  ESPALDA: 'TRACCION',
  EMPUJE: 'EMPUJE HORIZONTAL',
  PECHO: 'EMPUJE HORIZONTAL',
  HOMBRO: 'EMPUJE VERTICAL',
  'BISAGRA DE CADERA': 'DOMINANTE DE CADERA',
  BISAGRA: 'DOMINANTE DE CADERA',
  GLUTEO: 'DOMINANTE DE CADERA',
  ISQUIOS: 'DOMINANTE DE CADERA',
  'CADENA POSTERIOR': 'DOMINANTE DE CADERA',
  CUADRICEPS: 'DOMINANTE DE RODILLA',
  ZANCADA: 'DOMINANTE DE RODILLA',
  'UNILATERAL DE PIERNA': 'DOMINANTE DE RODILLA',
  PIERNA: 'DOMINANTE DE RODILLA',
}

function porPatron(categoria: string, contenidos: Contenido[]): Contenido | undefined {
  const cat = normalizar(categoria)
  if (!cat) return undefined
  const buscado = ALIAS[cat] ?? cat
  return contenidos.find(
    (c) => c.patronMovimiento && normalizar(c.patronMovimiento) === buscado,
  )
}

export function demoDeEjercicio(
  ejercicio: Pick<EjercicioPrescrito, 'categoria' | 'contenidoDemoId'>,
  contenidos: Contenido[],
): Contenido | undefined {
  if (ejercicio.contenidoDemoId) {
    const directo = contenidos.find((c) => c.id === ejercicio.contenidoDemoId)
    if (directo) return directo
  }
  return porPatron(ejercicio.categoria ?? '', contenidos)
}

/**
 * Lo mismo para el calentamiento y la movilidad, que no tienen categoría: si el
 * id no resuelve, la movilidad se cae a la rutina de movilidad de la biblioteca.
 */
export function demoDePreparacion(
  parte: Pick<PartePreparacion, 'tipo' | 'contenidoDemoId'>,
  contenidos: Contenido[],
): Contenido | undefined {
  if (parte.contenidoDemoId) {
    const directo = contenidos.find((c) => c.id === parte.contenidoDemoId)
    if (directo) return directo
  }
  if (parte.tipo === 'movilidad') {
    return contenidos.find((c) => normalizar(c.categoria) === 'MOVILIDAD')
  }
  return undefined
}
