// Detección de código exportado que nadie usa — testeado en src/test/codigo-huerfano.test.ts
//
// Cuatro veces en tres días escribimos un módulo correcto, con sus tests en verde, que
// no estaba enchufado a nada: el veto de embarazo sin sitio donde declarar la condición,
// `seContraindica` sin un solo consumidor, la despensa entera. Ningún test lo notó,
// porque cada pieza pasa sus pruebas por separado. Esto lo nota.
//
// No prohíbe: obliga a escribir el motivo en la lista de `src/test/codigo-huerfano.test.ts`.
// A veces un huérfano es legítimo (una constante que documenta, algo a medio construir
// y anunciado); lo que no es legítimo es que nadie se entere.
//
// Se parsea con el compilador de TypeScript, no con expresiones regulares: un `import`
// partido en varias líneas o un `as` de renombrado engañan a cualquier regex, y un
// detector que da falsos positivos se acaba desactivando.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'

const EXTENSIONES = ['.ts', '.tsx', '.mjs']
const CARPETAS_IGNORADAS = new Set(['node_modules', 'dist', 'coverage', '.git'])

/** `true` si la ruta es un archivo de pruebas (`algo.test.ts`, `algo.test.tsx`). */
export function esArchivoDeTest(ruta) {
  return /\.test\.[cm]?tsx?$/.test(ruta.replaceAll('\\', '/'))
}

/**
 * `true` si `archivo` es un test **del propio módulo**: mismo directorio y mismo nombre
 * base. Cubre tanto `despensa.test.ts` como `SessionProvider.aislamiento.test.tsx`.
 */
export function esTestPropio(rutaModulo, archivo) {
  const normal = (r) => r.replaceAll('\\', '/')
  const modulo = normal(rutaModulo)
  const test = normal(archivo)
  if (!esArchivoDeTest(test)) return false
  if (dirname(modulo) !== dirname(test)) return false
  const base = modulo.slice(modulo.lastIndexOf('/') + 1).replace(/\.[cm]?tsx?$/, '')
  const nombreTest = test.slice(test.lastIndexOf('/') + 1)
  return nombreTest.startsWith(`${base}.`)
}

function tieneExport(nodo) {
  if (!ts.canHaveModifiers(nodo)) return false
  return (ts.getModifiers(nodo) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

function parsear(codigo, ruta) {
  const tsx = ruta.endsWith('.tsx')
  return ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, tsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

/**
 * Nombres exportados que existen **en tiempo de ejecución**: funciones, constantes,
 * clases y enums. Los tipos e interfaces quedan fuera a propósito: se borran al
 * compilar, así que «no tener consumidor» no significa lo mismo para ellos.
 */
export function exportacionesDeValor(codigo, ruta = 'archivo.ts') {
  const nombres = new Set()
  for (const nodo of parsear(codigo, ruta).statements) {
    if (ts.isInterfaceDeclaration(nodo) || ts.isTypeAliasDeclaration(nodo)) continue

    if (ts.isFunctionDeclaration(nodo) || ts.isClassDeclaration(nodo) || ts.isEnumDeclaration(nodo)) {
      if (tieneExport(nodo) && nodo.name) nombres.add(nodo.name.text)
      continue
    }

    if (ts.isVariableStatement(nodo) && tieneExport(nodo)) {
      for (const decl of nodo.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) nombres.add(decl.name.text)
      }
      continue
    }

    // `export { a, b }` sin `from`: reexporta cosas declaradas arriba en el archivo.
    if (ts.isExportDeclaration(nodo) && !nodo.moduleSpecifier && nodo.exportClause && ts.isNamedExports(nodo.exportClause)) {
      if (nodo.isTypeOnly) continue
      for (const esp of nodo.exportClause.elements) {
        if (!esp.isTypeOnly) nombres.add(esp.name.text)
      }
    }
  }
  return [...nombres]
}

/**
 * Qué importa un archivo y de dónde. `nombres` es `'*'` cuando se trae el módulo
 * entero (`import * as m`, `import('...')`), porque entonces cualquier exportación
 * puede estar en uso y no se puede afirmar lo contrario.
 */
export function importacionesDe(codigo, ruta = 'archivo.ts') {
  const encontradas = []
  const anotar = (especificador, nombres) => {
    if (especificador) encontradas.push({ especificador, nombres })
  }

  const visitar = (nodo) => {
    if (ts.isImportDeclaration(nodo) && ts.isStringLiteral(nodo.moduleSpecifier)) {
      const clausula = nodo.importClause
      const especificador = nodo.moduleSpecifier.text
      if (!clausula) {
        anotar(especificador, []) // `import './efecto'`: no consume ningún nombre
      } else if (clausula.namedBindings && ts.isNamespaceImport(clausula.namedBindings)) {
        anotar(especificador, '*')
      } else {
        const nombres = []
        if (clausula.name) nombres.push('default')
        if (clausula.namedBindings && ts.isNamedImports(clausula.namedBindings)) {
          for (const esp of clausula.namedBindings.elements) {
            // `import { original as alias }`: lo consumido es `original`.
            nombres.push((esp.propertyName ?? esp.name).text)
          }
        }
        anotar(especificador, nombres)
      }
    }

    // `export { x } from './y'` y `export * from './y'` también son consumo.
    if (ts.isExportDeclaration(nodo) && nodo.moduleSpecifier && ts.isStringLiteral(nodo.moduleSpecifier)) {
      const especificador = nodo.moduleSpecifier.text
      if (nodo.exportClause && ts.isNamedExports(nodo.exportClause)) {
        anotar(
          especificador,
          nodo.exportClause.elements.map((esp) => (esp.propertyName ?? esp.name).text),
        )
      } else {
        anotar(especificador, '*')
      }
    }

    // `import('./x')` — así carga el router las pantallas con React.lazy.
    if (ts.isCallExpression(nodo) && nodo.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = nodo.arguments[0]
      if (arg && ts.isStringLiteral(arg)) anotar(arg.text, '*')
    }

    ts.forEachChild(nodo, visitar)
  }

  visitar(parsear(codigo, ruta))
  return encontradas
}

/**
 * Nombres que el archivo usa **dentro de sí mismo**, más allá de declararlos y
 * exportarlos. Distingue el export ancho de más (`tmb`, que `tmbCombinada` llama dos
 * líneas más abajo) del código de verdad muerto, que no lo llama nadie en ningún sitio.
 */
export function nombresUsadosInternamente(codigo, ruta = 'archivo.ts') {
  const usados = new Set()
  const visitar = (nodo) => {
    if (ts.isIdentifier(nodo)) {
      const padre = nodo.parent
      const esSuPropiaDeclaracion = padre && 'name' in padre && padre.name === nodo
      const esClausulaDeExport = padre && (ts.isExportSpecifier(padre) || ts.isImportSpecifier(padre))
      // `objeto.tmb` no es un uso de la función `tmb` del módulo.
      const esPropiedad = padre && ts.isPropertyAccessExpression(padre) && padre.name === nodo
      if (!esSuPropiaDeclaracion && !esClausulaDeExport && !esPropiedad) usados.add(nodo.text)
    }
    ts.forEachChild(nodo, visitar)
  }
  visitar(parsear(codigo, ruta))
  return usados
}

/** Ruta absoluta del módulo al que apunta un `import` relativo, o `null` si no resuelve. */
export function resolverModulo(archivoQueImporta, especificador) {
  if (!especificador.startsWith('.')) return null // paquete de node_modules
  const base = resolve(dirname(archivoQueImporta), especificador)
  const candidatos = [base, ...EXTENSIONES.map((e) => base + e), ...EXTENSIONES.map((e) => join(base, `index${e}`))]
  for (const candidato of candidatos) {
    try {
      if (statSync(candidato).isFile()) return candidato
    } catch {
      // sigue con el siguiente candidato
    }
  }
  return null
}

/** Todos los archivos de código bajo `raiz`, recursivamente. */
export function listarArchivos(raiz) {
  const encontrados = []
  const recorrer = (dir) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      if (entrada.isDirectory()) {
        if (!CARPETAS_IGNORADAS.has(entrada.name)) recorrer(join(dir, entrada.name))
      } else if (EXTENSIONES.some((e) => entrada.name.endsWith(e))) {
        encontrados.push(join(dir, entrada.name))
      }
    }
  }
  recorrer(raiz)
  return encontrados
}

/**
 * Las dos señales de código sin enchufar en `carpetaVigilada`:
 *
 * - `modulos`: módulos que **nadie importa** fuera de sus propios tests. Es la señal
 *   que importa: el módulo entero existe, pasa sus pruebas y no lo usa la app. Así
 *   estuvo `despensa.ts` una semana.
 * - `exportaciones`: nombres exportados que nadie usa fuera **y que su propio módulo
 *   tampoco llama**. Un `export` que solo usa el módulo por dentro no entra aquí: es
 *   una visibilidad más ancha de lo necesario, no código muerto.
 *
 * Las claves tienen la forma `src/domain/nutricion/despensa.ts` y
 * `src/domain/nutricion/techos.ts#limiteDe` para poder listarlas con su motivo.
 */
export function buscarHuerfanos({ raizProyecto, carpetaVigilada = 'src/domain', carpetasConsumidoras = ['src', 'scripts'] }) {
  const vigilada = resolve(raizProyecto, carpetaVigilada)
  const archivosVigilados = listarArchivos(vigilada).filter((a) => !esArchivoDeTest(a))

  const exportaciones = new Map() // ruta absoluta -> string[]
  const usosInternos = new Map() // ruta absoluta -> Set(nombres)
  for (const archivo of archivosVigilados) {
    const codigo = readFileSync(archivo, 'utf8')
    exportaciones.set(archivo, exportacionesDeValor(codigo, archivo))
    usosInternos.set(archivo, nombresUsadosInternamente(codigo, archivo))
  }

  // consumo: ruta del módulo -> Map(nombre -> Set(archivos que lo usan))
  const consumo = new Map()
  const anotarConsumo = (modulo, nombre, archivo) => {
    if (!consumo.has(modulo)) consumo.set(modulo, new Map())
    const porNombre = consumo.get(modulo)
    if (!porNombre.has(nombre)) porNombre.set(nombre, new Set())
    porNombre.get(nombre).add(archivo)
  }

  // importadores: ruta del módulo -> Set(archivos que lo importan de cualquier forma)
  const importadores = new Map()

  const consumidores = carpetasConsumidoras.flatMap((c) => listarArchivos(resolve(raizProyecto, c)))
  for (const archivo of consumidores) {
    let importaciones
    try {
      importaciones = importacionesDe(readFileSync(archivo, 'utf8'), archivo)
    } catch {
      continue // un archivo que no parsea no puede desmentir a nadie
    }
    for (const { especificador, nombres } of importaciones) {
      const modulo = resolverModulo(archivo, especificador)
      if (!modulo || !exportaciones.has(modulo)) continue
      if (modulo === archivo) continue
      if (!importadores.has(modulo)) importadores.set(modulo, new Set())
      importadores.get(modulo).add(archivo)
      const aAnotar = nombres === '*' ? exportaciones.get(modulo) : nombres
      for (const nombre of aAnotar) anotarConsumo(modulo, nombre, archivo)
    }
  }

  const comoClave = (ruta) => relative(raizProyecto, ruta).replaceAll('\\', '/')
  const fuera = (modulo, archivos) => [...archivos].filter((a) => !esTestPropio(modulo, a))

  const modulos = []
  const exportacionesMuertas = []
  for (const [modulo, nombres] of exportaciones) {
    const quienesLoImportan = fuera(modulo, importadores.get(modulo) ?? [])
    const ruta = comoClave(modulo)

    if (quienesLoImportan.length === 0) {
      modulos.push({ clave: ruta, modulo: ruta, exporta: nombres.length })
      continue // si no lo importa nadie, sus exportaciones ya están contadas aquí
    }

    for (const nombre of nombres) {
      const usos = fuera(modulo, consumo.get(modulo)?.get(nombre) ?? [])
      if (usos.length > 0) continue
      if (usosInternos.get(modulo)?.has(nombre)) continue // export ancho de más, no muerto
      exportacionesMuertas.push({ clave: `${ruta}#${nombre}`, modulo: ruta, nombre })
    }
  }

  const porClave = (a, b) => a.clave.localeCompare(b.clave)
  return { modulos: modulos.sort(porClave), exportaciones: exportacionesMuertas.sort(porClave) }
}
