import { CAMPOS_DE_PARED, type ClaveDeCampo } from './contenidoPared'

/**
 * QUÉ MURO SE LLEVA CADA CAMPO DEL EJERCICIO.
 *
 * Los dos grupos se DERIVAN de `CAMPOS_DE_PARED` en vez de escribirse a mano como dos
 * listas. Escritos a mano, olvidar un campo o repetirlo no rompería nada: la pared
 * simplemente no saldría, y un panel que falta en una pantalla de ocho no se nota. Al
 * filtrar el array del contrato, los ocho salen siempre y salen una vez.
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

/** Lo que se mira ANTES de levantar: qué ejercicio, cómo, cuántas series y hasta dónde. */
const EN_LA_IZQUIERDA = new Set<ClaveDeCampo>(['nombre', 'tecnica', 'seriesReps', 'rir'])

/** Los cuatro campos de EJECUTAR, colgados del muro izquierdo. */
export const MURO_IZQUIERDO = CAMPOS_DE_PARED.filter((c) => EN_LA_IZQUIERDA.has(c))

/** Los cuatro campos de MEDIR: se los lleva el módulo de la cámara, que es donde se usan. */
export const MURO_DERECHO = CAMPOS_DE_PARED.filter((c) => !EN_LA_IZQUIERDA.has(c))
