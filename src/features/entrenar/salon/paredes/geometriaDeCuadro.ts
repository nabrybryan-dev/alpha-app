import { CAMPO_VISUAL } from '../../../../domain/patrones/escena'
import { ENCUADRE_SALA, SALA } from '../../escena/sala'

/**
 * DÓNDE CAE UN CUADRO COLGADO EN LA PARED, visto desde la cámara del salón.
 *
 * ## Qué es un cuadro
 *
 * Bryan lo pidió con un símil el 2026-09-02: «como si fuera un cuadro puesto cuando uno lo
 * tiene en la sala». Los datos del ejercicio dejan de ser tarjetas pegadas a los bordes de
 * la pantalla y pasan a ser objetos DEL salón: cuelgan de un muro, a una altura y en un
 * ángulo, y cuando la cámara orbita se mueven, se escorzan y se van de cuadro como se iría
 * un cuadro de verdad. Es lo que convierte «un dashboard con un muñeco dentro» en una
 * habitación en la que hay información.
 *
 * ## Por qué esto es un cálculo y no una hoja de estilos
 *
 * Un panel colocado con porcentajes está pegado a la PANTALLA. Para que esté pegado a la
 * PARED hace falta pasarlo por la misma cámara que dibuja la escena: misma distancia
 * focal, mismo azimut, misma elevación. Si los dos no salen del mismo sitio, el cuadro
 * flota — y flotar medio grado ya se nota, porque el ojo compara el cuadro con el suelo
 * que tiene detrás.
 *
 * ## La medida que hace que esto sea viable
 *
 * El campo visual son 26° verticales, o sea 14,8° horizontales en un 414 × 736. Con esa
 * rendija, casi nada de una sala de catorce metros entra en el cuadro… salvo algo grande y
 * enfrente. Se midió: **un cuadro de 1,6 m colgado en la pared de 7 m ocupa 220 px, el
 * 53 % del ancho.** Cabe, se lee, y al estar a 7 m —por fuera del radio de órbita de
 * 4,6— no se cruza NUNCA por delante del sujeto. Por eso los cuadros van en la pared y no
 * flotando a media sala: ahí serían más grandes y taparían el cuerpo media vuelta.
 */

/** El estado de la cámara que hace falta para colocar un cuadro. */
export interface CamaraDelSalon {
  azimut: number
  elevacion: number
  distancia: number
}

/** Dónde y cómo se dibuja un cuadro, ya en unidades de pantalla. */
export interface CuadroEnPantalla {
  /** Centro del cuadro, en píxeles del lienzo. */
  x: number
  y: number
  /** Cuántos píxeles mide un metro a esa profundidad. */
  escala: number
  /** Grados que hay que girar el cuadro sobre el eje vertical para que quede en la pared. */
  giro: number
  /** Metros de la cámara al cuadro. Sirve para apilar: lo lejano, detrás. */
  z: number
  /** `false` cuando el cuadro queda detrás de la cámara o fuera del cuadro con holgura. */
  visible: boolean
}

/** Dónde cuelga un cuadro: su azimut en la pared y su altura sobre el suelo. */
export interface SitioDePared {
  /** Azimut en grados, en la MISMA convención que la órbita: 0 mira a +Z. */
  azimut: number
  /** Metros sobre el suelo del centro del cuadro. */
  altura: number
  /** Ancho del cuadro en metros. Decide cuánto ocupa y cuánto texto cabe. */
  ancho: number
  /**
   * Alto del cuadro en metros. **Es un tope declarado, no el alto real.**
   *
   * El alto de verdad lo pone el texto y solo se sabe después de maquetar, así que no
   * puede entrar en un cálculo que decide DÓNDE colgarlo —sería un bucle—. Este número
   * es lo que el marco promete no pasar, igual que `ancho` promete el ancho, y sirve
   * para una sola cosa: saber dónde cae el BORDE DE ARRIBA antes de dibujarlo.
   *
   * Que la promesa se cumpla se comprueba desde fuera, con
   * `testigo/cuadros-en-pantalla.mjs`, que mide el alto de verdad en la pantalla y lo
   * compara con éste. Un tope escrito y no medido se separa del contenido a la primera.
   */
  alto: number
}

const grados = (g: number) => (g * Math.PI) / 180

/**
 * Proyecta un cuadro de la pared a la pantalla.
 *
 * `ancho`/`alto` son los del lienzo en píxeles CSS. La distancia focal sale del campo
 * visual, que es el mismo que usa el motor: `alto / 2 / tan(campo / 2)`.
 */
export function proyectarCuadro(
  sitio: SitioDePared,
  camara: CamaraDelSalon,
  ancho: number,
  alto: number,
  radio = SALA.radio - 0.2,
): CuadroEnPantalla {
  const foco = alto / 2 / Math.tan(CAMPO_VISUAL / 2)
  const az = grados(camara.azimut)
  const el = grados(camara.elevacion)
  const centro = ENCUADRE_SALA.centro

  // El ojo, exactamente donde lo pone la órbita del motor.
  const ojo: [number, number, number] = [
    centro[0] + Math.sin(az) * Math.cos(el) * camara.distancia,
    centro[1] + Math.sin(el) * camara.distancia,
    centro[2] + Math.cos(az) * Math.cos(el) * camara.distancia,
  ]
  const haciaCentro: [number, number, number] = [
    centro[0] - ojo[0],
    centro[1] - ojo[1],
    centro[2] - ojo[2],
  ]
  const largo = Math.hypot(...haciaCentro) || 1
  const f: [number, number, number] = [
    haciaCentro[0] / largo,
    haciaCentro[1] / largo,
    haciaCentro[2] / largo,
  ]
  // Derecha y arriba de la cámara. La derecha se saca del producto vectorial con el eje
  // vertical del mundo, así que el horizonte nunca se inclina — que es lo que se quiere
  // en una sala: un cuadro torcido se lee como un error, no como estilo.
  //
  // EL SIGNO IMPORTA Y COSTÓ UNA VUELTA. La derecha de una cámara es
  // `normalizar(f x arriba)`, y con `arriba = (0,1,0)` eso da **(-f.z, 0, f.x)**. Escrito
  // al revés, la derecha apunta a la izquierda y el «arriba» que sale de ella apunta
  // abajo: el primer cuadro, colgado a 3,5 m, salía en y=798 de una pantalla de 736 —por
  // debajo del borde— y desde fuera eso se ve igual que no haberlo dibujado.
  const dn = Math.hypot(-f[2], f[0]) || 1
  const r: [number, number, number] = [-f[2] / dn, 0, f[0] / dn]
  const u: [number, number, number] = [
    r[1] * f[2] - r[2] * f[1],
    r[2] * f[0] - r[0] * f[2],
    r[0] * f[1] - r[1] * f[0],
  ]

  const a = grados(sitio.azimut)
  const p: [number, number, number] = [Math.sin(a) * radio, sitio.altura, Math.cos(a) * radio]
  const d: [number, number, number] = [p[0] - ojo[0], p[1] - ojo[1], p[2] - ojo[2]]
  const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2]
  const x = d[0] * r[0] + d[1] * r[1] + d[2] * r[2]
  const y = d[0] * u[0] + d[1] * u[1] + d[2] * u[2]

  if (z <= 0.4) return { x: 0, y: 0, escala: 0, giro: 0, z, visible: false }

  const px = ancho / 2 + (foco * x) / z
  const py = alto / 2 - (foco * y) / z
  const escala = foco / z
  // El giro que deja el cuadro plano contra su muro. Un muro visto de frente no gira; el
  // mismo muro visto desde un lado se escorza, y ese escorzo es la mitad de lo que dice
  // «esto está en la pared y no encima del cristal».
  //
  // MENOS 180, y no es un ajuste: es la definición. Un cuadro colgado en el muro mira
  // hacia el centro de la sala, y la cámara mira al centro desde el lado contrario. Los
  // dos se miran de frente cuando el azimut del cuadro es el de la cámara MÁS media
  // vuelta, y de frente el giro tiene que ser cero. Sin restar los 180, el cuadro que
  // está justo enfrente salía con 180° de escorzo —de espaldas— y la prueba de
  // visibilidad lo descartaba: los cuadros existían y no se dibujaba ni uno.
  const giro = sitio.azimut - camara.azimut - 180

  // Se declara fuera de cuadro con holgura: un cuadro a medio salir SÍ se dibuja —irse
  // por el borde es parte de que exista en el espacio—, pero uno que ya no toca la
  // pantalla no se monta, para no pagar su render ni su texto.
  const medio = (sitio.ancho / 2) * escala
  const visible = px + medio > -40 && px - medio < ancho + 40 && Math.abs(giro % 360) < 110

  return { x: px, y: py, escala, giro, z, visible }
}

/**
 * EL MARGEN QUE UN CUADRO GUARDA CON EL BORDE DE ARRIBA, en píxeles.
 *
 * Veintiocho y no cero: un cuadro que acaba justo en el filo se lee como cortado aunque
 * esté entero, porque el ojo no ve el marco de arriba. Empezó en doce y se subió el
 * 2026-09-03 mirando la pantalla: con doce, el tablón de enfrente quedaba a 11 px del
 * borde y la composición se leía apretada contra el techo — un rótulo de pared necesita
 * aire por arriba o parece que se le acabó el sitio.
 *
 * Cuesta elevación: cada píxel de margen es muro que ya no se puede usar. Con 28 el techo
 * del salón baja de 10° a lo que diga `geometriaDeCuadro.test.ts`, que lo tiene clavado.
 */
export const MARGEN_ARRIBA = 28

/**
 * HASTA DÓNDE SE PUEDE BAJAR UN CUADRO SIN QUE LO TAPE EL CUERPO, en metros.
 *
 * La cabeza del sujeto llega a 1,75 m y el cuerpo ocupa el tercio central del cuadro. Un
 * cuadro colgado por debajo de 1,9 m queda medio tapado por él — que es exactamente el
 * número que `sitiosDeLaPared.ts` tenía escrito como banda útil, y aquí es el suelo del
 * asentado. Un cuadro que ya se declara más bajo (el mando de registrar, a 1,5 m) es
 * suyo ese suelo: el asentado solo BAJA cuadros, nunca los sube.
 */
export const SUELO_DE_CUADRO = 1.9

/**
 * BAJA UN CUADRO POR SU MURO HASTA QUE ENTRA ENTERO EN EL CUADRO DE LA PANTALLA.
 *
 * ## Por qué hace falta, y no es un retoque
 *
 * Las alturas de `sitiosDeLaPared.ts` se midieron con la cámara del salón a **6°**, que
 * es la elevación de los patrones DE PIE. Pero la elevación no es una constante del
 * salón: la pone cada patrón (`patron.camara.elevacion`) y en el catálogo va de 2° a
 * 56°, porque un ejercicio tumbado se estudia desde arriba. Cuanto más se inclina la
 * cámara hacia el suelo, más sube el muro en la pantalla — y a partir de unos 12° un
 * cuadro colgado a 2,24 m sale POR ENCIMA del borde de arriba. Medido el 2026-09-03 con
 * un press inclinado: los tres cuadros del salón caían entre 629 y 861 px por encima de
 * la pantalla, o sea que el salón se abría sin una sola letra dentro.
 *
 * Esto lo arregla en el único sitio donde se puede arreglar sin mentir: la altura a la
 * que cuelga. **Solo baja, nunca sube**, y no baja de `SUELO_DE_CUADRO`, que es donde el
 * cuerpo del sujeto empieza a taparlo.
 *
 * ## Por qué el cuadro no se despega de la pared al hacerlo
 *
 * Porque la altura NO puede depender de hacia dónde mira el dedo. Si se calculara con el
 * azimut de cada fotograma, el cuadro subiría y bajaría por el muro mientras la cámara
 * orbita — que es exactamente el «flotar» que este archivo existe para evitar.
 *
 * Así que se resuelve con una cámara CANÓNICA: la que mira ese cuadro de frente
 * (`azimut = sitio.azimut - 180`), con la elevación y la distancia reales. Dos
 * propiedades, y las dos hacen falta:
 *
 * - **es estable**: no depende del azimut de la órbita, así que el cuadro se queda
 *   clavado en su punto del muro toda la sesión (la elevación no cambia: el dedo en
 *   horizontal orbita el azimut y el vertical es el eje W);
 * - **es el caso peor**: de frente el cuadro está en su punto más LEJANO —el muro de
 *   enfrente— y ahí es donde más alto sale en la pantalla. Si cabe de frente, cabe
 *   visto de lado.
 *
 * ## Lo que NO puede arreglar
 *
 * A partir de unos 32° de elevación **no hay ninguna altura del muro que se vea**: el
 * cono de la cámara cae entero sobre el suelo y la pared de enfrente queda fuera por
 * arriba, incluso su zócalo. Ahí esto devuelve el cuadro en su suelo y `cabe` en falso,
 * y lo que hay que decidir no es una altura: es dónde va la información cuando lo que
 * se ve es el suelo. Está anotado como decisión abierta.
 */
export function asentarEnLaBanda(
  sitio: SitioDePared,
  camara: CamaraDelSalon,
  ancho: number,
  alto: number,
): { sitio: SitioDePared; cabe: boolean } {
  const suelo = Math.min(sitio.altura, SUELO_DE_CUADRO)
  // La cámara canónica: este cuadro de frente, con la elevación y la distancia de verdad.
  const deFrente: CamaraDelSalon = { ...camara, azimut: sitio.azimut - 180 }
  let altura = sitio.altura
  // Doce vueltas: la corrección usa `escala` como píxeles por metro, que se queda corta
  // cuando la cámara está muy inclinada (el muro se acorta con el coseno), así que
  // converge por abajo en vez de pasarse. Con doce sobra para cualquier elevación real.
  for (let i = 0; i < 12; i++) {
    const c = proyectarCuadro({ ...sitio, altura }, deFrente, ancho, alto)
    if (!(c.escala > 0)) break
    const bordeDeArriba = c.y - (sitio.alto / 2) * c.escala
    if (bordeDeArriba >= MARGEN_ARRIBA) return { sitio: { ...sitio, altura }, cabe: true }
    // Bajarlo por el muro lo baja en la pantalla: `py` decrece con la altura.
    altura -= (MARGEN_ARRIBA - bordeDeArriba) / c.escala
    if (altura <= suelo) return { sitio: { ...sitio, altura: suelo }, cabe: false }
  }
  return { sitio: { ...sitio, altura: Math.max(altura, suelo) }, cabe: false }
}

/**
 * El estilo CSS que pone un cuadro en su sitio.
 *
 * `perspective` va DENTRO del `transform` y no como propiedad del padre: la propiedad solo
 * alcanza a los hijos directos, así que puesta un nivel más arriba se paga y no se ve. Es
 * la misma lección que ya está escrita en `huecos.ts` para el escorzo de los muros.
 */
export function estiloDeCuadro(c: CuadroEnPantalla, sitio: SitioDePared): React.CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    width: `${sitio.ancho * c.escala}px`,
    transformOrigin: 'center center',
    transform:
      `translate3d(${c.x}px, ${c.y}px, 0) translate(-50%, -50%) ` +
      `perspective(var(--fuga)) rotateY(${c.giro}deg)`,
    // Lo lejano, detrás. Sin esto un cuadro del muro de enfrente se pintaría encima de
    // uno del muro de al lado, y el orden delataría que no están en el espacio.
    zIndex: Math.max(0, Math.round(1000 - c.z * 20)),
    opacity: c.visible ? 1 : 0,
    pointerEvents: c.visible ? 'auto' : 'none',
  }
}
