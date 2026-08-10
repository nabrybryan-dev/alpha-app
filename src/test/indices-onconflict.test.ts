import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Un `ON CONFLICT (columna)` necesita un índice único NO parcial.
 *
 * EL FALLO QUE DOCUMENTA (2026-08-02). Las comidas nunca llegaron al servidor:
 * `registro_comida`, `registro_item` y `prueba_calibracion` tenían 0 filas
 * mientras los check-ins y los mensajes subían con normalidad. Las tres suben
 * con `onConflict: 'cliente_id'`, y las tres tenían su índice creado como
 *
 *     create unique index ... on tabla (cliente_id) where cliente_id is not null
 *
 * PostgreSQL solo infiere un índice parcial si la propia sentencia repite ese
 * `where`, y supabase-js manda `on_conflict=cliente_id` a secas. Así que cada
 * subida fallaba con 42P10, se reintentaba ocho veces y se descartaba en
 * silencio —por diseño, para no perder el registro local—. El asesorado seguía
 * anotando su día sin ver ningún error.
 *
 * POR QUÉ NINGÚN TEST LO VIO. Los tests corren siempre en modo demo, donde no
 * hay Supabase y por tanto no hay `ON CONFLICT` que resolver. Este test cierra
 * ese hueco leyendo las migraciones, que es lo único que se puede comprobar sin
 * una base de datos delante.
 *
 * El predicado no hacía falta: en PostgreSQL un índice único normal ya admite
 * varios NULL, porque los trata como distintos entre sí.
 */

const MIGRACIONES = join(process.cwd(), 'supabase', 'migrations')

/** Columnas sobre las que la app hace upsert, por tabla. */
const DESTINOS_ONCONFLICT: { tabla: string; columna: string }[] = [
  { tabla: 'registro_comida', columna: 'cliente_id' },
  { tabla: 'registro_item', columna: 'cliente_id' },
  { tabla: 'prueba_calibracion', columna: 'cliente_id' },
  // Los vetos de la nutricionista. Su unicidad viene de un `unique (...)` en el
  // `create table` de la 0016, no de un `create index` — ver `restriccionesDeTabla`.
  { tabla: 'perfil_alimentario_veto', columna: 'asesorado_id,alimento_id' },
]

function sqlDeTodasLasMigraciones(): string {
  return readdirSync(MIGRACIONES)
    .filter((f) => f.endsWith('.sql') && !f.includes('.local.'))
    .sort()
    .map((f) => readFileSync(join(MIGRACIONES, f), 'utf8'))
    .join('\n')
}

/**
 * La definición VIGENTE de cada índice, no todas las que existieron.
 *
 * Las migraciones se aplican en orden y una posterior puede recrear un índice
 * anterior, que es justo lo que hace la 0023. Mirar el conjunto entero haría
 * fallar este test para siempre por una definición ya reemplazada.
 */
function indicesVigentes(sql: string): Map<string, string> {
  const plano = sql.replace(/\s+/g, ' ')
  const sentencias = plano.match(/create[^;]*?index[^;]*?;/gi) ?? []
  const porNombre = new Map<string, string>()
  for (const sentencia of sentencias) {
    const nombre = sentencia.match(/index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([\w.]+)/i)?.[1]
    if (nombre) porNombre.set(nombre.replace(/^public\./, ''), sentencia)
  }
  return porNombre
}

/**
 * La lista de columnas tal cual se escribe, tolerando espacios y saltos.
 *
 * `onConflict` viaja sin espacios —«asesorado_id,alimento_id»— y el SQL se
 * escribe con ellos. Comparar los dos textos a pelo daría un falso negativo
 * justo en los upsert compuestos, que son los que más fácil se rompen.
 */
function comoLista(columna: string): RegExp {
  const columnas = columna.split(',').map((c) => c.trim()).join('\\s*,\\s*')
  return new RegExp(`\\(\\s*${columnas}\\s*\\)`, 'i')
}

/**
 * Los `unique (...)` declarados DENTRO de un `create table`.
 *
 * Cuentan igual que un `create unique index`: PostgreSQL crea el índice por su
 * cuenta y `ON CONFLICT` lo infiere sin problema. Mirar solo los `create index`
 * dejaba fuera a `perfil_alimentario_veto`, cuya unicidad vive en su propia
 * definición desde la 0016 — y este test habría exigido duplicarla.
 *
 * Una restricción de tabla NO puede ser parcial (no admite `where`), así que lo
 * que se devuelve aquí nunca puede caer en el fallo 42P10 que motiva el archivo.
 */
function restriccionesDeTabla(sql: string, tabla: string): string[] {
  const plano = sql.replace(/\s+/g, ' ')
  const creacion = plano.match(
    new RegExp(`create table (?:if not exists )?(?:public\\.)?${tabla} \\((.*?)\\);`, 'i'),
  )
  if (!creacion) return []
  return creacion[1].match(/unique\s*\([^)]*\)/gi) ?? []
}

function indicesSobre(vigentes: Map<string, string>, tabla: string, columna: string): string[] {
  const deLaColumna = comoLista(columna)
  const declarados = [...vigentes.values()].filter((s) => {
    const sobreLaTabla = new RegExp(`on\\s+(public\\.)?${tabla}\\s*\\(`, 'i').test(s)
    return sobreLaTabla && deLaColumna.test(s)
  })
  const deTabla = restriccionesDeTabla(sqlDeTodasLasMigraciones(), tabla).filter((r) =>
    deLaColumna.test(r),
  )
  return [...declarados, ...deTabla]
}

describe('índices que sostienen los upsert', () => {
  const vigentes = indicesVigentes(sqlDeTodasLasMigraciones())

  for (const { tabla, columna } of DESTINOS_ONCONFLICT) {
    describe(`${tabla}.${columna}`, () => {
      const indices = indicesSobre(vigentes, tabla, columna)

      it('tiene un índice único declarado', () => {
        expect(indices.some((i) => /unique/i.test(i))).toBe(true)
      })

      it('el índice único NO es parcial: sin él, cada upsert falla con 42P10', () => {
        const unicos = indices.filter((i) => /unique/i.test(i))
        const parciales = unicos.filter((i) => /\bwhere\b/i.test(i))
        expect(parciales).toEqual([])
      })
    })
  }

  it('vigila todas las columnas que la app usa en onConflict', () => {
    // Si alguien añade un upsert nuevo con onConflict, tiene que entrar en
    // DESTINOS_ONCONFLICT o este test deja de proteger nada.
    const sync = readFileSync(join(process.cwd(), 'src', 'data', 'nube', 'sync.ts'), 'utf8')
    const columnas = [...sync.matchAll(/onConflict:\s*'([^']+)'/g)].map((m) => m[1])
    expect(columnas.length).toBeGreaterThan(0)
    for (const columna of new Set(columnas)) {
      expect(DESTINOS_ONCONFLICT.some((d) => d.columna === columna)).toBe(true)
    }
  })
})
