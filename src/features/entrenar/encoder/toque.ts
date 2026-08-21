/**
 * ¿A qué píxel de la imagen corresponde un toque sobre el visor?
 *
 * El vídeo se dibuja con `object-contain` dentro de una caja de proporción fija,
 * así que casi nunca la llena: una imagen vertical en una caja apaisada deja
 * bandas negras a los lados, y una apaisada en una caja alta las deja arriba y
 * abajo. El lienzo que recoge el toque cubre la caja ENTERA, bandas incluidas.
 *
 * Traducir el toque con una regla de tres sobre la caja completa es el fallo que
 * esto arregla: con un teléfono en vertical (9:16) dentro de la caja 4:3, el eje
 * horizontal salía comprimido 2,4 veces. Solo acertaba quien tocaba justo en el
 * centro; a un cuarto del ancho, el punto real caía fuera de la imagen. Y el
 * síntoma no señalaba a la causa — la herramienta respondía «ahí no veo un
 * disco», que suena a problema de encuadre o de luz.
 *
 * Devuelve `null` para los toques que caen en la banda: ahí no hay imagen que
 * mirar, y fijar la referencia con esas coordenadas sería inventarse un punto.
 */
export function puntoDeLaImagen(
  xEnCaja: number,
  yEnCaja: number,
  anchoCaja: number,
  altoCaja: number,
  anchoImagen: number,
  altoImagen: number,
): { x: number; y: number } | null {
  if (anchoCaja <= 0 || altoCaja <= 0 || anchoImagen <= 0 || altoImagen <= 0) return null

  // `contain` escoge la escala que hace que quepan LOS DOS lados: la menor.
  const escala = Math.min(anchoCaja / anchoImagen, altoCaja / altoImagen)
  const margenIzq = (anchoCaja - anchoImagen * escala) / 2
  const margenArr = (altoCaja - altoImagen * escala) / 2

  // `Math.round` de un negativo diminuto devuelve -0, que no es 0 para
  // `Object.is`. Justo en el borde de la imagen, que es donde más se toca.
  const x = sinCeroNegativo(Math.round((xEnCaja - margenIzq) / escala))
  const y = sinCeroNegativo(Math.round((yEnCaja - margenArr) / escala))

  if (x < 0 || y < 0 || x >= anchoImagen || y >= altoImagen) return null
  return { x, y }
}

function sinCeroNegativo(n: number): number {
  return n === 0 ? 0 : n
}
