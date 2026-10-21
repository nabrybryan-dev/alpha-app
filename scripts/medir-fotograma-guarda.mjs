/**
 * Piezas puras de la medida del fotograma, separadas para poder probarlas sin navegador.
 *
 * `capa-momentos-medida.mjs` y `medir-fotograma-salon.mjs` solo las enchufan.
 */

/**
 * La guarda de la medida: con la capa encendida tiene que haber aportado vertices en ALGUN
 * fotograma de la tanda. Se cuentan los de toda la tanda, no los del ultimo: la capa solo dibuja
 * en la pose del calculo y el ultimo fotograma puede caer fuera de ella.
 */
export function comprobarQueLaCapaAporto(capa, verticesDeLaCapaEnLaTanda) {
  if (capa && !(verticesDeLaCapaEnLaTanda > 0)) {
    throw new Error('capa encendida pero no aporto ni un vertice: la medida no la incluye')
  }
}

/** Vertices que aporta la capa por fotograma en el peor caso (sujeto de ejemplo, 3 articulaciones con banda). */
export const VERTICES_POR_FOTOGRAMA_PEOR_CASO = 912

/**
 * Cuadre de la tanda: con la capa encendida, los vertices acumulados tienen que ser EXACTAMENTE
 * fotogramas × 912. Una capa que dibuja solo en algunos fotogramas (como el salon real tras C-3), o una
 * geometria que cambia, hace que la medida ya no sea la del peor caso y se rechaza en vez de promediarse.
 */
export function comprobarElCuadreDeLaTanda(capa, verticesDeLaCapaEnLaTanda, fotogramas, porFotograma = VERTICES_POR_FOTOGRAMA_PEOR_CASO) {
  if (!capa) return
  if (!Number.isInteger(fotogramas) || fotogramas <= 0) throw new Error(`numero de fotogramas invalido: ${fotogramas}`)
  const esperado = fotogramas * porFotograma
  if (verticesDeLaCapaEnLaTanda !== esperado) {
    throw new Error(`la capa no cuadra: ${verticesDeLaCapaEnLaTanda} vertices en ${fotogramas} fotogramas, se esperaban ${esperado} (${porFotograma} por fotograma)`)
  }
}

/**
 * Las mallas de la capa para medir el PEOR CASO: la pose del calculo se pone en la del fotograma,
 * asi que los arcos se construyen en todos los fotogramas (en el salon real solo salen cerca de la
 * pose del ejemplo). `dibujar` es `mallasDeMomentos` y `poseDe` es `poseDelEsqueleto`.
 */
export function mallasDelPeorCaso(capa, dibujar, poseDe, esq) {
  const pose = poseDe(esq)
  if (!pose) return []
  return dibujar({ ...capa, poseDelCalculo: pose }, esq)
}
