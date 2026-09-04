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
 * EL REPARTO POR TIEMPO: qué se anuncia y qué se queda vivo.
 *
 * Los cinco campos del muro izquierdo no cambian —siguen siendo cinco y siguen colgando
 * del mismo muro—; lo que se decidió el 2026-09-03 es CUÁNDO se ve cada uno. El nombre y
 * la técnica son lo que hay que leer UNA vez, al llegar al ejercicio: se anuncian y se
 * retiran. Las tres cifras son la prescripción de la serie que estás a punto de hacer: se
 * quedan.
 *
 * Se derivan del mismo array del contrato que `MURO_IZQUIERDO`, y por lo mismo: escritas a
 * mano, olvidar un campo no rompería nada —simplemente dejaría de verse en los dos
 * estados, que es la forma más silenciosa de perder un dato—. Filtrando, cada campo del
 * muro cae en una capa y en una sola.
 */
const EN_EL_ANUNCIO_SET = new Set<ClaveDeCampo>(['nombre', 'tecnica'])

/** Lo que el muro ANUNCIA al llegar al ejercicio, y luego retira. */
export const EN_EL_ANUNCIO = MURO_IZQUIERDO.filter((c) => EN_EL_ANUNCIO_SET.has(c))

/**
 * LO QUE ESCRIBE LA SALA, en geometría, y por eso ya no se escribe encima.
 *
 * `construirSala()` cuelga marcadores de SIETE SEGMENTOS en los muros —geometría de
 * verdad, no tipografía— y uno de ellos justo enfrente de quien entra, con las series, las
 * repeticiones y el RIR. Llevaba ahí desde el #183.
 *
 * El 2026-09-03, apagando la capa de letras con `testigo/cuadros-en-pantalla.mjs
 * --sin-letras`, se vio lo que nadie había mirado: **el muro ya decía `03 09 2` en cifras
 * de 62 px, y el tablón del DOM se pintaba justo encima**. La interfaz no estaba añadiendo
 * información: estaba tapando la que la sala ya daba, y encima la repetía en tipografía de
 * app. Es exactamente lo que Bryan lleva señalando tres veces —«se ven como recortes de la
 * aplicación»—, y la salida no era rediseñar el recorte otra vez: era quitarlo.
 *
 * **No desaparecen del DOM**: se quedan invisibles. Una malla no la lee un lector de
 * pantalla, y la auditoría de «no se perdió nada» cuenta `data-campo`. Se ven en el muro,
 * se oyen igual que antes, y se siguen pudiendo contar desde fuera.
 */
const EN_GEOMETRIA = new Set<ClaveDeCampo>(['seriesReps', 'rir'])

/** Los campos que dice la SALA en siete segmentos. En el DOM van, pero no se ven. */
export const EN_GEOMETRIA_DEL_MURO = MURO_IZQUIERDO.filter((c) => EN_GEOMETRIA.has(c))

/** Lo que el muro deja ENCENDIDO en letra: lo que la geometría no puede escribir. */
export const EN_LO_VIVO = MURO_IZQUIERDO.filter(
  (c) => !EN_EL_ANUNCIO_SET.has(c) && !EN_GEOMETRIA.has(c),
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
