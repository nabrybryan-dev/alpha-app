/**
 * Dónde plantar la cámara, y qué precisión sale de ahí — antes de grabar.
 *
 * Solo el cálculo. La carta por consola vive en `carta-encuadre.mjs`, que
 * importa de aquí: este archivo se copia VERBATIM al bundle de la app
 * (`nucleo/encuadre.js`) y allí no existe `node:url` ni `process.argv`.
 *
 * ## Para qué existe
 *
 * El corpus (CORPUS.md: 168 archivos, 162 útiles) dejó dos números que no son opinión: el
 * móvil en el suelo a un metro produce un **58 % de salto de escala** entre los
 * dos extremos de la barra, y una toma que parecía lateral tenía **29° de
 * desvío**. Los dos estropean el brazo de momento, y los dos se deciden ANTES
 * de grabar, colocando el trípode.
 *
 * Eso significa que se puede calcular. No hace falta gimnasio ni testeo: es
 * trigonometría con la distancia, la altura y el campo de visión de la lente.
 * Este módulo convierte el hallazgo del corpus en una regla previa —dónde
 * ponerse— en vez de un lamento posterior.
 *
 * ## El modelo, y lo que deja fuera
 *
 * Cámara estenopeica: un punto a distancia `d` del eje óptico se proyecta con
 * escala `f/d`. De ahí sale todo:
 *
 *   - **La escala** en el plano del atleta, en mm por píxel.
 *   - **El salto de escala** a lo largo de la barra, que es el error que se come
 *     el brazo de momento si se fija la escala con un solo disco.
 *   - **El desvío φ** respecto al eje de la barra, que comprime las distancias
 *     anteroposteriores por cos φ.
 *   - **El escorzo vertical**, que es lo que hace que un móvil en el suelo no
 *     mida igual la cadera que el tobillo.
 *
 * NO modela la distorsión de barril de la lente —que en un gran angular de
 * móvil a 1 m es real y empeora los bordes—, ni el recorte del sensor, ni la
 * compresión. Para eso está `camara-sintetica.py`, que sí los mete.
 *
 * Por eso los números de aquí son un **suelo optimista**: la realidad es peor,
 * nunca mejor. Sirven para descartar colocaciones, no para prometer precisión.
 */


const BARRA_M = 2.2 // longitud de una barra olímpica, para saber si cabe en el encuadre

/**
 * Separación entre las CARAS de los dos discos que se miden, en metros.
 *
 * **No es una constante de la barra: depende de cuánto peso hay cargado.** Un
 * disco es un disco de ancho, así que cada par que se añade separa las dos caras
 * exteriores unos 12 cm más.
 *
 * Esto no se supuso, se midió, y suspendió la primera versión de este módulo.
 * Ajustado sobre el vídeo 004 salía 1,05 m; comprobado fuera de muestra contra
 * el vídeo 104 —otro gimnasio, otro ángulo, menos peso— salían 0,54 m. La
 * primera versión daba por constante lo que varía al doble.
 *
 *     vídeo 004   pila cargada   ~1,05 m entre caras
 *     vídeo 104   pocas placas   ~0,54 m
 *
 * Por eso la carta de encuadre da una BANDA y no una línea: sin saber el peso no
 * se puede predecir el salto de escala exacto, solo acotarlo.
 *
 * Y por eso la MEDIDA no depende de esto: `escalaDeLaBarra()` mide los dos
 * discos y los interpola, sin suponer nunca a qué distancia están. La suposición
 * solo entra al predecir, que es lo que hace este módulo.
 */
export const SEPARACION_DISCOS_M = { min: 0.5, max: 1.3, tipico: 0.8 }

const DISCO_MM = 450

/**
 * La geometría de una colocación concreta.
 *
 * @param dist    metros del objetivo (el plano sagital del atleta) a la lente
 * @param altura  metros a los que está la lente sobre el suelo
 * @param fov     campo de visión horizontal de la lente, en grados
 * @param anchoPx píxeles de ancho del fotograma
 * @param desvio  grados que la cámara se sale del eje de la barra. 0 = lateral pura
 * @param ejeM    altura del eje que se está midiendo (cadera ≈ 0,95 m de pie)
 */
export function encuadre({
  dist = 2.5,
  altura = 1.0,
  fov = 70,
  anchoPx = 1080,
  desvio = 0,
  ejeM = 0.95,
  separacionDiscos,
} = {}) {
  // Distancia focal en píxeles. Es la constante que relaciona todo lo demás.
  const f = anchoPx / (2 * Math.tan((fov * Math.PI) / 360))

  // Escala en el plano del atleta: cuántos mm mide un píxel allí.
  const mmPorPx = (1000 * dist) / f

  // El salto de escala a lo largo de la barra. La barra se sale del plano de
  // imagen `desvio` grados, así que sus extremos quedan a distinta profundidad.
  const saltoCon = (sep) => {
    const medio = (sep / 2) * Math.sin((desvio * Math.PI) / 180)
    return (dist + medio) / Math.max(0.15, dist - medio) - 1
  }
  const saltoEscala = saltoCon(separacionDiscos ?? SEPARACION_DISCOS_M.tipico)
  const saltoMin = saltoCon(SEPARACION_DISCOS_M.min)
  const saltoMax = saltoCon(SEPARACION_DISCOS_M.max)

  // Compresión anteroposterior: un brazo de momento es una distancia AP, y sale
  // multiplicada por cos φ. Se corrige dividiendo, pero solo si se conoce φ.
  const cosFi = Math.cos((desvio * Math.PI) / 180)

  // Escorzo vertical: con la lente por debajo del eje, la cadera y el tobillo no
  // están a la misma distancia del eje óptico y no comparten escala. Es la razón
  // de que un móvil en el suelo mida peor la cadera que el tobillo.
  const alturaSobreEje = ejeM - altura
  const inclinacionGrados = (Math.atan2(alturaSobreEje, dist) * 180) / Math.PI

  // Cuánto se ve de alto y de ancho a esa distancia.
  const anchoEscenaM = 2 * dist * Math.tan((fov * Math.PI) / 360)

  // El disco de 450 mm, en píxeles: es la marca de si el detector tiene con qué.
  const discoPx = DISCO_MM / mmPorPx

  return {
    dist, altura, fov, anchoPx, desvio, ejeM,
    mmPorPx,
    discoPx,
    anchoEscenaM,
    saltoEscala,
    saltoMin,
    saltoMax,
    cosFi,
    inclinacionGrados,
    // El error que queda en el brazo de momento si NO se corrige nada: se usa
    // un disco cualquiera para la escala y se ignora φ.
    errorSinCorregir: (1 + saltoEscala / 2) / cosFi - 1,
    // Y el que queda haciéndolo bien: interpolando los dos discos y dividiendo
    // por cos φ. Lo que sobrevive es el ruido de localizar el borde del disco,
    // que a ±1 px sobre el diámetro es esto.
    errorCorregido: 1 / discoPx,
  }
}

/** Un veredicto legible, con el mismo vocabulario de puertas del motor. */
export function calificarEncuadre(e) {
  const fallos = []
  // Por encima de 30° el reparto entre ejes deja de ser fiable y no hay
  // corrección que lo salve: la profundidad se come la geometría (CORPUS.md §5).
  if (e.desvio > 30) fallos.push('no_es_lateral')
  // Un disco por debajo de 80 px no da un contorno del que fiarse: es el mismo
  // límite que la puerta `contorno_parcial` de `calificar()`.
  if (e.discoPx < 80) fallos.push('disco_pequeño')
  // Con la lente muy por debajo del eje, cadera y tobillo dejan de compartir
  // escala. 20° es el mismo tope que INCLINACION_CALIDAD_GRADOS.
  if (Math.abs(e.inclinacionGrados) > 20) fallos.push('camara_baja')
  // Si no cabe el atleta con la barra, faltan marcas y no hay plan que ejecutar.
  if (e.anchoEscenaM < 2.4) fallos.push('no_cabe')
  if (fallos.length === 0) return { nivel: 'buena', motivos: [] }
  if (fallos.length === 1) return { nivel: 'dudosa', motivos: fallos }
  return { nivel: 'descartada', motivos: fallos }
}
