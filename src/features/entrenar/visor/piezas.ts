/**
 * LAS PIEZAS DEL SALÓN: qué hay y dónde va cada una.
 *
 * Es la lista de piezas hechas en Blender que se plantan en la sala, con su sitio. Cómo
 * llegan —pedirlas, comprobarlas, colocarlas y avisar— vive desde el 2026-09-08 en
 * `cargaDelAtlas.ts`: esto es un catálogo, y un catálogo no toca la red. Hasta que una
 * pieza llega, la sala está como estaba: el salón se abre igual y el rack aparece cuando
 * aparece.
 *
 * ## Dónde se plantan
 *
 * Las posiciones son ÁNGULOS DE LA SALA, como los marcadores: la pared es un cilindro y
 * todo lo que se apoya en ella se dice en grados y radio. Se dejan por dentro del muro
 * (7 m) y por fuera de la órbita (4,6 m), que es la franja donde el mobiliario ya vive.
 * El giro pone la pieza tangente a la pared: su eje largo —la barra del rack— sigue la
 * curva en vez de clavarse en ella.
 */

export interface PiezaDelSalon {
  ruta: string
  /** Ángulo de la sala en grados, desde +X, y radio en metros. */
  anguloGrados: number
  radio: number
}

/**
 * LA SALA ENTERA HECHA EN BLENDER: 16 × 11 m con el sujeto en el centro. Cuando esta
 * pieza está cargada, la sala de cajas no se construye y los marcadores se cuelgan de
 * sus paredes. Las medidas son las del exportador; si cambian allí, cambian aquí.
 */
export const SALA_GIMNASIO = { nombre: 'sala-gimnasio', medioAncho: 8, medioFondo: 5.5, alto: 3.8 } as const

export const PIEZAS_DEL_SALON: Record<string, PiezaDelSalon> = {
  // Radio 0: la sala ya viene centrada en el sujeto y con sus paredes en su sitio. El rack
  // y la máquina de poleas vienen DENTRO, con la misma luz horneada que la sala: el rack
  // fue una pieza aparte durante una tarde, sin luz y a 150°, hasta que el exportador
  // aprendió a llevarse los conjuntos de Sketchfab enteros.
  [SALA_GIMNASIO.nombre]: { ruta: '/piezas/sala-gimnasio.pieza', anguloGrados: 0, radio: 0 },
}


/**
 * EL ATLAS ANATÓMICO: el cuerpo de verdad, para estudiarlo.
 *
 * Son 698 estructuras de BodyParts3D 4.0 —296 huesos y 402 músculos, con su nombre
 * anatómico real— recortadas a 150.066 triángulos entre las dos. Vienen aparte de la sala
 * y **no se cargan con el salón**: solo cuando alguien abre el estudio del cuerpo. Quien
 * entra a entrenar no paga este megabyte.
 *
 * Van en dos piezas y no en una porque se miran por separado: el esqueleto solo, la
 * musculatura sola, o las dos superpuestas. Una pieza única obligaría a bajar las dos para
 * ver una.
 *
 * **No se mueve.** Es una postura fija de un varón adulto de referencia. El sujeto que sí
 * se contrae —el vientre engorda al acortarse— es el de `domain/patrones/`, y son cosas
 * distintas: esto es la anatomía cierta, aquello es el movimiento. Conviven.
 *
 * Licencia CC BY 4.0: obliga a nombrar la fuente, y está en `creditos.ts`.
 */
/**
 * ENCIMA DEL SUJETO, A SU MISMA ESCALA. Y esa igualdad hay que hornearla.
 *
 * El atlas viene en metros de persona (1,709 m) y el sujeto de `domain/patrones/` NO está
 * en metros: mide 0,555 de alto. Puestos tal cual, el atlas es tres veces mayor y a otra
 * altura, y del cuerpo real solo entra el tórax en el cuadro. El convertidor ya lo deja a
 * la escala y la altura del sujeto, así que aquí basta con plantarlo en el mismo sitio.
 *
 * Se superponen y no se ponen al lado porque a esta escala **la carne envuelve al hueso**:
 * el muñeco es delgado y esquemático, y la musculatura real, que ocupa más, se dibuja por
 * fuera. Eso es lo que se quería —ver el cuerpo de verdad— y no dos figuras compitiendo.
 * Apartarlo se probó primero, con la cámara mirando de perfil, y el atlas quedaba
 * exactamente detrás del sujeto: invisible.
 */
export const PIEZAS_DEL_ATLAS: Record<string, PiezaDelSalon> = {
  'atlas-esqueleto': { ruta: '/piezas/atlas-esqueleto.pieza', anguloGrados: 0, radio: 0 },
  'atlas-musculos': { ruta: '/piezas/atlas-musculos.pieza', anguloGrados: 0, radio: 0 },
  // La piel es del atlas FEMENINO (Human Reference Atlas). Es lo único que ese atlas trae
  // de cuerpo: sus músculos son 16 y del ojo, y su esqueleto la columna y dos rodillas.
  'atlas-piel': { ruta: '/piezas/atlas-piel.pieza', anguloGrados: 0, radio: 0 },
}

/**
 * SI LA SALA DEL GIMNASIO YA ESTÁ EN PANTALLA, para que la interfaz deje de dibujar la
 * suya encima.
 *
 * `ArquitecturaSala` pinta una habitación en SVG —paredes, suelo, retícula— y una viñeta
 * que hunde los bordes a negro. Con la sala de cajas eso era lo que la hacía legible.
 * Encima de la sala de Blender es una SEGUNDA sala, con otra perspectiva y otra luz, y es
 * lo que Bryan veía como «no se ve igual»: medido el 2026-09-05, esa capa por sí sola
 * apagaba el gimnasio entero.
 *
 * Es un almacén de tres líneas y no un contexto de React porque quien lo escribe está
 * dentro de un efecto que crea el contexto WebGL —no hay estado de React ahí— y quien lo
 * lee es un componente muy lejano en el árbol.
 */
let salaCargada = false
const oyentesDeLaSala = new Set<() => void>()

export function salaDeBlenderCargada(): boolean {
  return salaCargada
}

export function anunciarSalaDeBlender(): void {
  if (salaCargada) return
  salaCargada = true
  for (const f of oyentesDeLaSala) f()
}

export function suscribirseALaSalaDeBlender(f: () => void): () => void {
  oyentesDeLaSala.add(f)
  return () => {
    oyentesDeLaSala.delete(f)
  }
}

/** Dónde queda una pieza de la sala, en coordenadas del motor. */
export function sitioDe(p: PiezaDelSalon): { x: number; z: number; giroY: number } {
  const a = (p.anguloGrados * Math.PI) / 180
  // Tangente a la pared: girar el eje local Z hasta la dirección (−sen a, cos a).
  return { x: Math.cos(a) * p.radio, z: Math.sin(a) * p.radio, giroY: -a }
}
