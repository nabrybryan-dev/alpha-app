import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Leer el esquema desde los archivos de migración.
 *
 * POR QUÉ EXISTE. Los tests corren siempre en modo demo, sin Supabase, así que
 * nada del lado del servidor se ejercita. Esto no lo sustituye —para eso está el
 * Postgres del CI— pero atrapa en segundos y sin base de datos los desajustes
 * más tontos, que son los que más pasan.
 *
 * LÍMITE HONESTO: esto lee SQL con expresiones regulares, no lo entiende. Sirve
 * para el estilo de migración de este repo (`create table` sencillo y
 * `alter table add column`) y se rinde con lo que no reconoce. Cuando se rinde
 * lo DICE en vez de callar: un lector que devuelve vacío en silencio hace que
 * los tests que dependen de él pasen sin comprobar nada.
 */

const MIGRACIONES = join(process.cwd(), 'supabase', 'migrations')

/** Todo el SQL aplicado, en el mismo orden en que se aplica. */
export function sqlDeLasMigraciones(): string {
  return readdirSync(MIGRACIONES)
    .filter((f) => f.endsWith('.sql') && !f.includes('.local.'))
    .sort()
    .map((f) => readFileSync(join(MIGRACIONES, f), 'utf8'))
    .join('\n')
}

export interface Columna {
  nombre: string
  obligatoria: boolean
  /** `not null` sin `default`: si falta en un insert, la base lo rechaza. */
  exigidaAlInsertar: boolean
}

export type Esquema = Map<string, Map<string, Columna>>

/** Quita comentarios de línea para que un `-- not null` no cuente como tal. */
function sinComentarios(sql: string): string {
  return sql.replace(/--[^\n]*/g, '')
}

function analizarColumna(linea: string): Columna | undefined {
  const limpia = linea.trim().replace(/,$/, '')
  if (limpia === '') return undefined
  // Restricciones de tabla, no columnas.
  if (/^(primary key|unique|check|constraint|foreign key|exclude)\b/i.test(limpia)) return undefined

  const nombre = limpia.match(/^([a-z_][a-z0-9_]*)\s+/i)?.[1]
  if (!nombre) return undefined

  const obligatoria = /\bnot\s+null\b/i.test(limpia)
  const tieneDefault = /\bdefault\b/i.test(limpia) || /\bgenerated\s+(always|by\s+default)\b/i.test(limpia)
  return { nombre, obligatoria, exigidaAlInsertar: obligatoria && !tieneDefault }
}

/**
 * El esquema vigente: las tablas de `public` con sus columnas, incluidas las que
 * añadió un `alter table` posterior.
 *
 * No modela `drop column` ni `alter column`: hoy no hay ninguno en el repo. Si
 * apareciera, este lector se quedaría corto y hay que ampliarlo —mejor eso que
 * fingir que lo entiende.
 */
export function esquemaDeLasMigraciones(sql: string): Esquema {
  const limpio = sinComentarios(sql)
  const esquema: Esquema = new Map()

  const creaciones = limpio.matchAll(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\s*\)\s*;/gi,
  )
  for (const [, tabla, cuerpo] of creaciones) {
    const columnas = esquema.get(tabla) ?? new Map<string, Columna>()
    // Se corta por comas de primer nivel: un `numeric(8,2)` o un `check (x in
    // ('a','b'))` llevan comas dentro que no separan columnas.
    let nivel = 0
    let actual = ''
    const trozos: string[] = []
    for (const caracter of cuerpo) {
      if (caracter === '(') nivel += 1
      if (caracter === ')') nivel -= 1
      if (caracter === ',' && nivel === 0) {
        trozos.push(actual)
        actual = ''
      } else {
        actual += caracter
      }
    }
    trozos.push(actual)

    for (const trozo of trozos) {
      const columna = analizarColumna(trozo)
      if (columna) columnas.set(columna.nombre, columna)
    }
    esquema.set(tabla, columnas)
  }

  const anadidas = limpio.matchAll(
    /alter\s+table\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([^;]+);/gi,
  )
  for (const [, tabla, definicion] of anadidas) {
    const columna = analizarColumna(definicion)
    if (!columna) continue
    const columnas = esquema.get(tabla) ?? new Map<string, Columna>()
    columnas.set(columna.nombre, columna)
    esquema.set(tabla, columnas)
  }

  return esquema
}

export interface EnvioAlServidor {
  tabla: string
  tipo: string
  claves: string[]
  /**
   * El payload trae un `...spread`, así que sus claves NO se pueden saber
   * leyendo el archivo: salen de una función. Quien use esto tiene que decidir
   * qué hacer, y decirlo. Callarlo convertiría el test en un adorno.
   */
  incompleto: boolean
  /** Línea del `encolar` en `sync.ts`, para que el fallo diga dónde mirar. */
  linea: number
}

/**
 * Los `encolar({ tabla, tipo, payload })` de `sync.ts` con las claves que
 * mandan.
 *
 * Solo se reconocen los payloads escritos como objeto literal con claves fijas,
 * que es como están todos hoy. Si alguno usara `...spread` o una clave
 * calculada, se devuelve con `claves: []` y quien lo use debe decidir; nunca se
 * omite en silencio.
 */
/** El texto del objeto que abre en `desde`, contando llaves. */
function objetoDesde(fuente: string, desde: number): string | undefined {
  const abre = fuente.indexOf('{', desde)
  if (abre === -1) return undefined
  let nivel = 0
  for (let i = abre; i < fuente.length; i++) {
    if (fuente[i] === '{') nivel += 1
    if (fuente[i] === '}') {
      nivel -= 1
      if (nivel === 0) return fuente.slice(abre + 1, i)
    }
  }
  return undefined
}

/**
 * Las claves del primer nivel de un objeto literal.
 *
 * Reconoce las dos formas que usa el repo: `usuario_id: algo` y la abreviada
 * `fecha,`. La abreviada era la que se escapaba, y perderla es peor que no
 * mirar: el test daría por bueno un payload al que le falta una columna
 * obligatoria.
 */
function clavesDePrimerNivel(objetoConComentarios: string): string[] {
  // Sin comentarios: un `// el crudo es la fuente` pegado a la clave siguiente
  // la volvía irreconocible y la clave desaparecía del análisis.
  const objeto = objetoConComentarios.replace(/\/\/[^\n]*/g, '')
  const claves: string[] = []
  let nivel = 0
  let token = ''

  const cerrar = () => {
    const clave = token.trim().match(/^([a-z_][a-z0-9_]*)\s*:?$/i)?.[1]
    if (clave && nivel === 0) claves.push(clave)
    token = ''
  }

  for (let i = 0; i < objeto.length; i++) {
    const c = objeto[i]
    if (c === '{' || c === '(' || c === '[') nivel += 1
    if (c === '}' || c === ')' || c === ']') nivel -= 1

    if (nivel === 0 && c === ':') {
      cerrar()
      // Saltar el valor hasta la coma de este nivel.
      let interno = 0
      i += 1
      while (i < objeto.length) {
        const v = objeto[i]
        if (v === '{' || v === '(' || v === '[') interno += 1
        if (v === '}' || v === ')' || v === ']') interno -= 1
        if (v === ',' && interno === 0) break
        i += 1
      }
      continue
    }
    if (nivel === 0 && c === ',') {
      cerrar()
      continue
    }
    token += c
  }
  cerrar()

  return claves
}

export function enviosDeSync(fuente: string): EnvioAlServidor[] {
  const envios: EnvioAlServidor[] = []
  const marca = /tabla:\s*'([a-z_]+)'/g

  for (const encontrado of fuente.matchAll(marca)) {
    const desde = encontrado.index ?? 0
    const tabla = encontrado[1]
    const linea = fuente.slice(0, desde).split('\n').length
    const alrededor = fuente.slice(desde, desde + 400)
    const tipo = alrededor.match(/tipo:\s*'([a-z]+)'/)?.[1] ?? 'desconocido'

    const dondePayload = fuente.indexOf('payload:', desde)
    const objeto = dondePayload === -1 ? undefined : objetoDesde(fuente, dondePayload)
    envios.push({
      tabla,
      tipo,
      claves: objeto ? clavesDePrimerNivel(objeto) : [],
      incompleto: objeto === undefined || /\.\.\./.test(objeto.replace(/\/\/[^\n]*/g, '')),
      linea,
    })
  }

  return envios
}
