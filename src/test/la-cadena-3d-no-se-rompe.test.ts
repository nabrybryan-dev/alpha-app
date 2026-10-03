import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * EL FALLO CARACTERÍSTICO DEL 3D EN CSS: se paga entero y no se ve nada.
 *
 * `perspective` solo alcanza a los HIJOS DIRECTOS. Para que un `translateZ` produzca
 * escorzo más abajo, cada elemento intermedio tiene que llevar
 * `transform-style: preserve-3d`; el valor por omisión, `flat`, aplana a sus hijos
 * contra su propio plano y el `translateZ` deja de verse.
 *
 * Deja de verse, pero **no deja de costar**: el navegador promueve la capa igual, y
 * la `box-shadow` que suele acompañar al relieve sí se pinta. O sea que el elemento
 * PARECE en relieve sin estarlo. Nada falla, nada se pone rojo, y en la revisión
 * visual pasa porque la sombra hace el trabajo.
 *
 * Aparecieron tres cadenas rotas en tres pantallas distintas —`RegistroSerie`,
 * `BloquesSesion` y `PreparacionSesion`— y ninguna la cazó `profundidad-la-escala-se-respeta`,
 * porque ese guardián mira VALORES y este mira CAMINOS.
 *
 * ## Lo que comprueba y lo que no
 *
 * Solo juzga cuando la escena está en el MISMO archivo que el elemento con
 * profundidad. Si no encuentra un `escena-prof` por encima, se calla: la
 * perspectiva puede venir de un componente padre y esto no lo puede saber leyendo
 * un archivo. Las tres roturas reales caían dentro de ese alcance.
 */

const RAIZ = join(process.cwd(), 'src', 'features', 'entrenar')

/** Clases que ponen `transform-style: preserve-3d` desde `tokens.css`. */
const CADENA_POR_CLASE = /\b(consola-asienta|ficha-3d)\b/
/** Clases que ponen un `translateZ` de la escala desde `tokens.css`. */
const PROFUNDIDAD_POR_CLASE = /\b(tecla-3d|pozo-3d)\b/

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name)
    if (e.isDirectory()) return fuentes(ruta)
    if (!e.name.endsWith('.tsx') || e.name.includes('.test.')) return []
    return [ruta]
  })
}

interface Marcas {
  nombre: string
  linea: number
  esEscena: boolean
  esCadena: boolean
  tieneProfundidad: boolean
}

/** Lee `className` y `style` de un elemento JSX tal como están escritos. */
function marcasDe(
  apertura: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  fuente: ts.SourceFile,
): Marcas {
  let clases = ''
  let estilo = ''
  for (const attr of apertura.attributes.properties) {
    if (!ts.isJsxAttribute(attr) || !attr.initializer) continue
    const texto = attr.initializer.getText(fuente)
    if (attr.name.getText(fuente) === 'className') clases += texto
    if (attr.name.getText(fuente) === 'style') estilo += texto
  }
  const junto = `${clases} ${estilo}`
  return {
    nombre: apertura.tagName.getText(fuente),
    linea: fuente.getLineAndCharacterOfPosition(apertura.getStart(fuente)).line + 1,
    esEscena: /\bescena-prof\b/.test(clases),
    esCadena: /preserve-3d/.test(junto) || CADENA_POR_CLASE.test(clases),
    // `al-fondo` se excluye a propósito: pone el `translateZ` sobre sus HIJOS, y va
    // siempre en el mismo elemento que la escena, así que sus hijos son hijos
    // directos de la perspectiva y no hay cadena que recorrer.
    tieneProfundidad: PROFUNDIDAD_POR_CLASE.test(clases) || /translateZ\(var\(--prof-/.test(junto),
  }
}

/** Cada elemento con profundidad, con la pila de elementos JSX que lo contienen. */
function elementosConProfundidad(ruta: string): { marca: Marcas; pila: Marcas[] }[] {
  const fuente = ts.createSourceFile(
    ruta,
    readFileSync(ruta, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const hallazgos: { marca: Marcas; pila: Marcas[] }[] = []

  const recorrer = (nodo: ts.Node, pila: Marcas[]) => {
    let siguiente = pila
    if (ts.isJsxElement(nodo) || ts.isJsxSelfClosingElement(nodo)) {
      const apertura = ts.isJsxElement(nodo) ? nodo.openingElement : nodo
      const marca = marcasDe(apertura, fuente)
      if (marca.tieneProfundidad) hallazgos.push({ marca, pila })
      // Los fragmentos no llegan aquí a propósito: no crean nodo en el DOM, así que
      // tampoco cortan una cadena 3D. Solo se apilan elementos de verdad.
      siguiente = [...pila, marca]
    }
    nodo.forEachChild((hijo) => recorrer(hijo, siguiente))
  }
  recorrer(fuente, [])
  return hallazgos
}

describe('la cadena 3D', () => {
  const ARCHIVOS = fuentes(RAIZ)

  it('hay archivos que mirar y elementos con profundidad que juzgar', () => {
    expect(ARCHIVOS.length).toBeGreaterThan(20)
    const total = ARCHIVOS.reduce((n, r) => n + elementosConProfundidad(r).length, 0)
    expect(total).toBeGreaterThan(4)
  })

  it('entre la escena y el elemento con profundidad no hay ningún eslabón plano', () => {
    const rotas: string[] = []

    for (const ruta of ARCHIVOS) {
      for (const { marca, pila } of elementosConProfundidad(ruta)) {
        const iEscena = pila.map((a) => a.esEscena).lastIndexOf(true)
        // Sin escena en este archivo no se juzga: la perspectiva puede venir de un
        // componente padre, y adivinarlo sería peor que callarse.
        if (iEscena === -1) continue
        const enMedio = pila.slice(iEscena + 1)
        const planos = enMedio.filter((a) => !a.esCadena)
        if (planos.length === 0) continue
        rotas.push(
          `${relative(process.cwd(), ruta)}:${marca.linea} <${marca.nombre}> tiene profundidad, ` +
            `pero entre él y su escena aplana: ${planos.map((a) => `<${a.nombre}> (línea ${a.linea})`).join(', ')}`,
        )
      }
    }

    expect(rotas).toEqual([])
  })
})
