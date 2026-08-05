/**
 * Acceso al catálogo de alimentos que va empaquetado con la app.
 *
 * A diferencia del resto de repositorios, este no lee de `localStorage` ni se
 * sincroniza: el catálogo es la misma referencia para todo el mundo, no cambia
 * salvo que se regenere el índice, y no contiene ningún dato personal. Por eso
 * tampoco recibe un `usuarioId`.
 *
 * El índice lo genera `scripts/generar-indice-alimentos.mjs`. No editarlo a
 * mano: se regenera desde el catálogo del Cerebro cada vez que este crece.
 *
 * Datos de composición nutricional tomados de la Tabla de Composición de
 * Alimentos Colombianos (TCAC 2018), Instituto Colombiano de Bienestar
 * Familiar - ICBF.
 */

import type { AlimentoIndice, FiltroBusqueda } from '../../domain/nutricion/busqueda'
import { buscar } from '../../domain/nutricion/busqueda'
import { sinDatosEnDuda } from '../../domain/nutricion/datosSospechosos'
import { ESTADOS_PESABLES, familia } from '../../domain/nutricion/estado'
import bruto from './alimentos.json'

/**
 * Los datos que no se sostienen se apartan AQUÍ, al entrar, y no en cada
 * pantalla que los use.
 *
 * Es el único punto por el que un id del catálogo se convierte en composición:
 * el día del asesorado, las cifras que ve la nutricionista, el detalle de una
 * comida y la hoja de cantidad salen todos de aquí. Filtrar más adelante -en el
 * resumen del día, por ejemplo- dejaría fuera a los demás y sería una costura
 * más que alguien tiene que acordarse de llamar, que es justo el patrón que ya
 * falló en este repo con el aviso de alergia.
 *
 * Cuesta un recorrido de 1.195 filas al cargar el módulo, una sola vez.
 */
const ALIMENTOS = (bruto as AlimentoIndice[]).map(sinDatosEnDuda)

/** Índice por id: la hoja de cantidad lo consulta en cada pulsación del
 *  stepper, y recorrer 1.195 alimentos en cada una se nota en un móvil. */
const POR_ID = new Map(ALIMENTOS.map((a) => [a.id, a]))

/**
 * Alimentos agrupados por familia: el arroz crudo y el cocido caen en la misma.
 *
 * Se construye una vez al cargar el módulo. La hoja de búsqueda necesita saber,
 * por CADA fila que pinta, si ese alimento existe en más de un estado -es lo que
 * decide el chip azul y la pregunta de crudo/cocido-. Resolverlo recorriendo los
 * 1.195 por fila serían 60.000 comparaciones en cada tecla escrita.
 */
const POR_FAMILIA = new Map<string, AlimentoIndice[]>()
for (const alimento of ALIMENTOS) {
  const clave = familia(alimento.nombre)
  const grupo = POR_FAMILIA.get(clave)
  if (grupo) grupo.push(alimento)
  else POR_FAMILIA.set(clave, [alimento])
}

export interface CatalogoRepo {
  buscar(consulta: string, filtro?: FiltroBusqueda, tope?: number): AlimentoIndice[]
  porId(id: string): AlimentoIndice | undefined
  /** Cuántos alimentos hay en total. La hoja de búsqueda lo enseña ("N de …"). */
  total(): number
  /** Los grupos que existen, para los chips de filtro. */
  grupos(): string[]
  /**
   * Las variantes pesables del mismo alimento: crudo, cocido, seco.
   *
   * Vacío cuando solo existe en un estado, que es el caso de la mayoría. La
   * hoja de búsqueda lo usa para el chip, y la de cantidad para saber si toca
   * preguntar.
   */
  variantesDe(alimento: AlimentoIndice): AlimentoIndice[]
}

export const catalogoRepo: CatalogoRepo = {
  buscar: (consulta, filtro, tope) => buscar(ALIMENTOS, consulta, filtro, tope),
  porId: (id) => POR_ID.get(id),
  total: () => ALIMENTOS.length,
  grupos: () => [...new Set(ALIMENTOS.map((a) => a.grupo))].sort((a, b) => a.localeCompare(b, 'es')),
  variantesDe: (alimento) => {
    const hermanos = (POR_FAMILIA.get(familia(alimento.nombre)) ?? []).filter((a) =>
      ESTADOS_PESABLES.includes(a.estado),
    )
    // Uno solo no es una elección: el pan tajado existe únicamente como
    // `listo` y no hay nada que preguntar sobre él.
    return hermanos.length > 1 ? hermanos : []
  },
}
