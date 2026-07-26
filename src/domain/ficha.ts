export const BLOQUES = [
  'vocabulario',
  'mujer-ciclo',
  'ejecucion-tecnica',
  'intensidad-cargas',
  'estructura-sesion',
  'fatiga-recuperacion',
  'dolor-banderas',
  'nutricion-macros',
  'suplementacion-hidratacion',
  'descansos-duracion',
  'peso-bascula',
  'vida-real',
] as const
export type Bloque = (typeof BLOQUES)[number]

export const RANURAS = [
  'ejercicio_hoy',
  'rir_pautado',
  'rango_pautado',
  'series_pautadas',
  'carga_anterior',
  'microciclo_actual',
  'macros_dia',
  'adherencia_nutricion',
  'checkin_bienestar',
  'hidratacion_dia',
  'medidas',
] as const
export type Ranura = (typeof RANURAS)[number]

export const PARTES = [
  'respuesta_directa',
  'por_que',
  'tu_caso_hoy',
  'que_hago_ahora',
  'senal_alarma',
] as const
export type Parte = (typeof PARTES)[number]

export type CuerpoFicha = Record<Parte, string>

export interface Ficha {
  id: string
  bloque: string
  titulo: string
  variantes: string[]
  banderaSalud: boolean
  datosQueUsa: string[]
  fuentes: string[]
  actualizado: string
  cuerpo: CuerpoFicha
}

/** Quita comillas envolventes y espacios de un valor escalar del frontmatter. */
function limpiarEscalar(valor: string): string {
  const podado = valor.trim()
  const entrecomillado =
    (podado.startsWith('"') && podado.endsWith('"')) ||
    (podado.startsWith("'") && podado.endsWith("'"))
  return entrecomillado ? podado.slice(1, -1) : podado
}

/** Lista en línea: `[a, b, c]` → ['a','b','c']. */
function parsearListaEnLinea(valor: string): string[] {
  const interior = valor.trim().slice(1, -1).trim()
  if (!interior) return []
  return interior.split(',').map(limpiarEscalar)
}

/**
 * Parser de frontmatter YAML acotado a lo que usan las fichas: escalares,
 * listas en línea `[a, b]` y listas por guiones. No es YAML general y no
 * pretende serlo — mantenerlo así evita una dependencia nueva.
 */
function parsearFrontmatter(bloque: string): Record<string, string | string[]> {
  const salida: Record<string, string | string[]> = {}
  const lineas = bloque.split('\n')
  let claveLista: string | null = null

  for (const linea of lineas) {
    if (!linea.trim()) continue

    const guion = linea.match(/^\s+-\s+(.*)$/)
    if (guion && claveLista) {
      ;(salida[claveLista] as string[]).push(limpiarEscalar(guion[1]))
      continue
    }

    const par = linea.match(/^([a-z_]+):\s*(.*)$/)
    if (!par) continue

    const [, clave, crudo] = par
    if (!crudo.trim()) {
      claveLista = clave
      salida[clave] = []
      continue
    }

    claveLista = null
    salida[clave] = crudo.trim().startsWith('[')
      ? parsearListaEnLinea(crudo)
      : limpiarEscalar(crudo)
  }

  return salida
}

function comoLista(valor: string | string[] | undefined): string[] {
  if (Array.isArray(valor)) return valor
  return valor ? [valor] : []
}

function comoTexto(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? (valor[0] ?? '') : (valor ?? '')
}

/** Extrae las secciones `## nombre` del cuerpo markdown. */
function parsearCuerpo(markdown: string): CuerpoFicha {
  const cuerpo = {} as CuerpoFicha
  for (const parte of PARTES) cuerpo[parte] = ''

  const bloques = markdown.split(/^##\s+/m).slice(1)
  for (const bloque of bloques) {
    const salto = bloque.indexOf('\n')
    if (salto === -1) continue
    const nombre = bloque.slice(0, salto).trim() as Parte
    if (!PARTES.includes(nombre)) continue
    cuerpo[nombre] = bloque.slice(salto + 1).trim()
  }

  return cuerpo
}

export function parsearFicha(texto: string): Ficha {
  const coincidencia = texto.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!coincidencia) {
    throw new Error('La ficha no tiene frontmatter delimitado por ---')
  }

  const [, cabecera, markdown] = coincidencia
  const meta = parsearFrontmatter(cabecera)

  return {
    id: comoTexto(meta.id),
    bloque: comoTexto(meta.bloque),
    titulo: comoTexto(meta.titulo),
    variantes: comoLista(meta.variantes),
    banderaSalud: comoTexto(meta.bandera_salud) === 'true',
    datosQueUsa: comoLista(meta.datos_que_usa),
    fuentes: comoLista(meta.fuentes),
    actualizado: comoTexto(meta.actualizado),
    cuerpo: parsearCuerpo(markdown),
  }
}

export const LARGO_MIN = 70
export const LARGO_MAX = 160
export const LARGO_IDEAL_MIN = 90
export const LARGO_IDEAL_MAX = 140

export function contarPalabras(texto: string): number {
  const podado = texto.trim()
  return podado ? podado.split(/\s+/).length : 0
}

export function palabrasDelCuerpo(cuerpo: CuerpoFicha): number {
  return PARTES.reduce((total, parte) => total + contarPalabras(cuerpo[parte]), 0)
}

const MIN_VARIANTES = 8
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function validarFicha(ficha: Ficha): string[] {
  const errores: string[] = []

  if (!KEBAB.test(ficha.id)) {
    errores.push(`id debe ser kebab-case: "${ficha.id}"`)
  }
  if (!BLOQUES.includes(ficha.bloque as Bloque)) {
    errores.push(`bloque desconocido: "${ficha.bloque}"`)
  }
  if (!ficha.titulo.trim()) {
    errores.push('la ficha debe tener título')
  }
  if (ficha.variantes.length < MIN_VARIANTES) {
    errores.push(
      `se requieren al menos ${MIN_VARIANTES} variantes, hay ${ficha.variantes.length}`,
    )
  }
  if (ficha.fuentes.length === 0) {
    errores.push('la ficha debe declarar al menos una fuente')
  }
  for (const ranura of ficha.datosQueUsa) {
    if (!RANURAS.includes(ranura as Ranura)) {
      errores.push(`ranura desconocida en datos_que_usa: "${ranura}"`)
    }
  }

  for (const parte of PARTES) {
    if (!ficha.cuerpo[parte].trim()) {
      errores.push(`falta la parte "${parte}"`)
    }
  }

  const palabras = palabrasDelCuerpo(ficha.cuerpo)
  if (palabras > LARGO_MAX) {
    errores.push(`el cuerpo tiene ${palabras} palabras, el máximo es ${LARGO_MAX}`)
  }
  if (palabras < LARGO_MIN) {
    errores.push(`el cuerpo tiene ${palabras} palabras, el mínimo es ${LARGO_MIN}`)
  }

  return errores
}
