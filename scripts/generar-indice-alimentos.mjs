/**
 * Genera el índice de alimentos que la app empaqueta y busca SIN RED.
 *
 * POR QUÉ EMPAQUETADO Y NO CONSULTADO. El asesorado registra lo que come en el
 * gimnasio o en la calle, con conexión mala. Si la búsqueda necesitara red, el
 * registro entero se caería justo cuando se usa. Y como `registro_item` guarda
 * `alimento_id` + `gramos` -los nutrientes son DERIVADOS, no copiados-, con este
 * recorte basta para buscar y para enseñarle sus kcal al momento; el resto del
 * perfil se calcula cuando haya red.
 *
 * QUÉ SE RECORTA. De los ~14 nutrientes por alimento solo viajan los cuatro que
 * se pintan en la lista de resultados. Hierro, calcio, B12, zinc y los demás se
 * quedan fuera a propósito: son el 70 % del peso y no se muestran al buscar.
 *
 * LOS NULOS VIAJAN COMO NULOS. En el catálogo `null` significa "no se midió" y
 * `0` significa "se midió y no contiene": la tabla del ICBF no publica vitamina
 * D, y convertir ese nulo en cero haría que la app afirmara algo que ninguna
 * fuente dice. Aquí se conserva la diferencia.
 *
 * Uso:  node scripts/generar-indice-alimentos.mjs
 *
 * Datos de composición nutricional tomados de la Tabla de Composición de
 * Alimentos Colombianos (TCAC 2018), Instituto Colombiano de Bienestar
 * Familiar - ICBF.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const ORIGEN = resolve(aqui, '../../herramientas/base-alimentos/catalogo.json')
const DESTINO = resolve(aqui, '../src/data/catalogo/alimentos.json')

/** Lo único que se pinta en la hoja de búsqueda. */
const NUTRIENTES = ['kcal', 'proteina_g', 'carbos_g', 'grasa_g']

/** `undefined` se cae al serializar a JSON; `null` sobrevive, y es lo que hay
 *  que conservar. Un nutriente ausente en origen entra como null explícito. */
const recortarComposicion = (por100g) =>
  Object.fromEntries(NUTRIENTES.map((clave) => [clave, por100g?.[clave] ?? null]))

function main() {
  const catalogo = JSON.parse(readFileSync(ORIGEN, 'utf8'))

  const indice = catalogo.map((a) => ({
    id: a.id,
    nombre: a.nombre,
    // Los sinónimos son la mitad de la búsqueda en Colombia: nadie escribe
    // "Musa paradisiaca" ni siempre "plátano", pero sí "banano".
    ...(a.sinonimos ? { sinonimos: a.sinonimos } : {}),
    grupo: a.grupo,
    estado: a.estado,
    confianza: a.confianza,
    fuente: a.origen,
    por100g: recortarComposicion(a.por_100g),
    // Las medidas caseras son las "porciones" de la hoja de cantidad: sin ellas
    // el asesorado solo puede mover el stepper gramo a gramo.
    ...(a.medidas?.length
      ? { medidas: a.medidas.map((m) => ({ nombre: m.nombre, gramos: m.gramos })) }
      : {}),
  }))

  mkdirSync(dirname(DESTINO), { recursive: true })
  writeFileSync(DESTINO, JSON.stringify(indice), 'utf8')

  const kb = (n) => `${(n / 1024).toFixed(1)} KB`
  const conMedidas = indice.filter((a) => a.medidas).length
  const sinKcal = indice.filter((a) => a.por100g.kcal === null).length

  console.log(`  ${indice.length} alimentos -> ${DESTINO}`)
  console.log(`  peso: ${kb(readFileSync(DESTINO).byteLength)} (origen ${kb(readFileSync(ORIGEN).byteLength)})`)
  console.log(`  con medidas caseras: ${conMedidas}`)
  console.log(`  sin kcal (nulo conservado): ${sinKcal}`)
}

main()
