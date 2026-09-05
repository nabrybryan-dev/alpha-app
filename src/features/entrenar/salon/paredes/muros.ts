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

/**
 * EL REPARTO, DESPUÉS DE VACIAR EL MURO.
 *
 * De los cinco campos que colgaban del muro izquierdo, en el muro se quedan DOS. Los otros
 * tres no se han perdido: se han ido al sitio que les da el diseño de la sala, y ese sitio
 * es mejor que una banda de texto en la pared.
 *
 * - **nombre** → escrito en trazo, permanente. Es rotulación: dice dónde estás.
 * - **carga** → el hueco que comparte con el cronómetro, mientras el muro anuncia.
 * - **seriesReps** y **rir** → las CUATRO ESTACIONES alrededor del cuerpo, que además las
 *   retiran a los 3,7 s. Ahí es donde se leen sin apartar la vista del centro.
 * - **tecnica** → la lectura larga de abajo, bajo «cómo se hace». Es un párrafo entero, y
 *   en el muro salía recortado a 42 caracteres: la pared enseñaba un trozo y obligaba a
 *   bajar igual.
 *
 * Todos siguen contándose. La auditoría de «no se perdió nada» cuenta `data-campo`, y los
 * tres que se fueron siguen montados en el muro con `soloParaLector`: invisibles, audibles
 * y contables. Es el mismo mecanismo con el que las cifras se mudaron a la geometría del
 * muro el 2026-09-03 — se ven donde toca, se oyen igual, y se pueden contar desde fuera.
 */
const EN_EL_ROTULO_SET = new Set<ClaveDeCampo>(['nombre'])

/** Lo que está SIEMPRE escrito en el muro, en trazo. */
export const EN_EL_ROTULO = MURO_IZQUIERDO.filter((c) => EN_EL_ROTULO_SET.has(c))

/**
 * LA CARGA COMPARTE HUECO CON EL RELOJ.
 *
 * Hay un momento en que manda, y es uno solo: al llegar a la barra, antes de la primera
 * serie. Ocupa el hueco de la derecha mientras el muro anuncia —con los kilos de hoy y los
 * de la semana pasada debajo, que es la comparación que convierte la cifra en decisión— y
 * después le devuelve el sitio al cronómetro, que es lo único que corre.
 */
const EN_EL_HUECO_SET = new Set<ClaveDeCampo>(['carga'])

/** Lo que ocupa el hueco de la derecha mientras el muro anuncia. */
export const EN_EL_HUECO = MURO_IZQUIERDO.filter((c) => EN_EL_HUECO_SET.has(c))

/**
 * LOS QUE SE DICEN FUERA DEL MURO, y por eso aquí van montados y sin ver.
 *
 * Una malla no la lee un lector de pantalla y un cartel que se retira a los 3,7 s tampoco
 * está siempre. Estos nodos existen para las dos cosas que no son mirar: oír y contar.
 * Volver a hacerlos visibles sería escribir en la pared lo que ya dicen las estaciones y
 * la lectura de abajo, que es de lo que se salió.
 */
export const EN_OTRO_SITIO = MURO_IZQUIERDO.filter(
  (c) => !EN_EL_ROTULO_SET.has(c) && !EN_EL_HUECO_SET.has(c),
)

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

/**
 * LOS QUE VAN EN UNA LÍNEA, con el rótulo al lado y no encima.
 *
 * `tecnica` es el único campo del tablón que es PROSA, y apilado se llevaba dos líneas de
 * muro —el rótulo y el texto— de las siete que caben. Con el rótulo al lado ocupa una.
 *
 * No es sitio para el cue entero y nunca lo fue: la versión larga vive en el panel de
 * abajo, íntegra, y eso lo garantiza la invariante de `contenidoPared()`. Aquí va la
 * primera indicación, que es la que ordena el resto.
 */
export const EN_UNA_LINEA: ReadonlySet<ClaveDeCampo> = new Set<ClaveDeCampo>([
  'tecnica',
  // LAS TRES CIFRAS ENTRARON EL 2026-09-03, y por la misma cuenta que la técnica.
  //
  // Con el rótulo ENCIMA, cada cifra gasta dos líneas de muro: seis para tres datos que
  // se leen de un vistazo. Es lo que quedaba de la pantalla que Bryan describió como «la
  // jerarquía visual está muy cargada» — el muro tenía siete bandas y cuatro eran
  // rótulos. Al lado, las tres caben en dos líneas y siguen diciendo lo mismo: «3 ×
  // (8-10)» necesita la palabra SERIES delante, y la sigue teniendo.
  'seriesReps',
  'carga',
  'rir',
])
