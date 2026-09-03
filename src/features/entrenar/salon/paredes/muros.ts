import { CAMPOS_DE_PARED, type ClaveDeCampo } from './contenidoPared'

/**
 * QUÉ MURO SE LLEVA CADA CAMPO DEL EJERCICIO.
 *
 * Los dos grupos se DERIVAN de `CAMPOS_DE_PARED` en vez de escribirse a mano como dos
 * listas. Escritos a mano, olvidar un campo o repetirlo no rompería nada: la pared
 * simplemente no saldría, y un panel que falta en una pantalla de nueve no se nota. Al
 * filtrar el array del contrato, los nueve salen siempre y salen una vez.
 *
 * El reparto no es alfabético ni de tamaño: es por MOMENTO. Los de ejecutar se miran antes
 * de levantar y cuelgan del muro izquierdo, a la altura de la mirada. Los de medir se miran
 * al colocar el teléfono, y por eso viven dentro del módulo de la cámara, al pie del muro:
 * un ajuste de encuadre leído junto al trípode es un ajuste; leído en la esquina opuesta de
 * la pantalla es un dato suelto.
 *
 * Vive en su propio archivo, y no junto a los paneles que lo consumen, por una razón del
 * linter que aquí es regla: un archivo que exporta componentes **y** constantes se lleva un
 * aviso de `react-refresh/only-export-components`, y en este repo no se deja ni un aviso más
 * de los que había.
 */

/**
 * Lo que se mira ANTES de levantar: qué ejercicio, cómo, cuántas series, con cuánto y
 * hasta dónde.
 *
 * `carga` entró aquí el 2026-09-03. Estaba solo dentro del mando de registrar, que es un
 * botón plegado: para ver los kilos había que desplegar un control. Series, carga y RIR
 * son la prescripción de la serie y se leen juntos o no se leen.
 */
const EN_LA_IZQUIERDA = new Set<ClaveDeCampo>(['nombre', 'tecnica', 'seriesReps', 'carga', 'rir'])

/** Los cinco campos de EJECUTAR, colgados del muro izquierdo. */
export const MURO_IZQUIERDO = CAMPOS_DE_PARED.filter((c) => EN_LA_IZQUIERDA.has(c))

/** Los cuatro campos de MEDIR: se los lleva el módulo de la cámara, que es donde se usan. */
export const MURO_DERECHO = CAMPOS_DE_PARED.filter((c) => !EN_LA_IZQUIERDA.has(c))

/**
 * LOS TRES QUE SON CIFRAS, y que por eso caben en una sola fila.
 *
 * Series, carga y RIR son la prescripción de la serie: tres valores cortos que se leen de
 * un vistazo y que en columna ocupaban tres filas de rótulo + valor. Con los cinco campos
 * apilados, el cuadro del ejercicio medía **249 px de 844** —el 30 % de la pantalla— y
 * rozaba el borde de arriba; puestos en fila baja a una sola. No es maquetación: un cuadro
 * de pared que ocupa un tercio de la pantalla es el dashboard volviendo por la puerta de
 * atrás, que es justo de lo que el salón salió.
 *
 * Se declara aquí, junto al reparto de muros, porque es la misma decisión: qué se lee
 * junto. `MuroDeCampos` agrupa los que vengan seguidos, así que el orden lo sigue
 * mandando `CAMPOS_DE_PARED` y esto no reordena nada.
 */
export const CIFRAS_DEL_MURO: ReadonlySet<ClaveDeCampo> = new Set<ClaveDeCampo>([
  'seriesReps',
  'carga',
  'rir',
])
