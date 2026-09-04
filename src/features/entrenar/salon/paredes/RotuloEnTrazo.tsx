/**
 * EL NOMBRE DEL EJERCICIO, ESCRITO EN EL MURO Y NO SOBRE ÉL.
 *
 * ## Qué cambia respecto a lo que había
 *
 * El nombre vivía dentro del ANUNCIO: se leía cinco segundos y medio y se retiraba con él.
 * Funcionaba para «qué toca ahora» y fallaba en lo otro que hace un nombre en una sala —
 * decir DÓNDE estás—: pasados seis segundos, el salón no decía de qué ejercicio era. Es la
 * diferencia entre un aviso y un rótulo, y un rótulo no se pliega.
 *
 * ## Por qué en TRAZO y no en letra llena
 *
 * Una letra rellena es tinta encima del muro. Una letra en trazo con dos ecos detrás es
 * una letra que TIENE canto: el contorno se lee como el filo de un cuerpo, y los dos ecos
 * a distinta profundidad son el grosor. Escrita así deja ver el muro por dentro —el
 * degradado de luz, el grano— en vez de taparlo con una mancha, que es exactamente la
 * queja de «recortes de la app pegados a la pared»: un titular relleno es de una página,
 * un rótulo hueco con canto es de una nave.
 *
 * Y hay una razón de sitio: en trazo puede ser GRANDE sin pesar. Relleno, un nombre a este
 * cuerpo de letra se comería el muro y habría que bajarlo; hueco ocupa el mismo espacio y
 * deja pasar la pared.
 *
 * ## Las medidas van en `em`, y no es estilo: es que el cuadro se acerca
 *
 * `CuadroDePared` fija el cuerpo del cuadro con `ancho x escala x 0,052` acotado entre 7 y
 * 15 px, o sea que el texto ENCOGE cuando la cámara se aleja. Cualquier medida escrita en
 * píxeles —el grosor del trazo, la profundidad de los ecos— se quedaría clavada mientras
 * todo lo demás se mueve, y a dos metros el trazo de un rótulo pequeño sería tan grueso
 * como la letra. En `em` el rótulo entero es una sola cosa que se acerca.
 *
 * ## El cuerpo se calcula del nombre más largo, y por qué
 *
 * Un rótulo de ancho fijo con un nombre de 18 letras se sale, y con uno de 6 deja el muro
 * vacío. La regla es la de un rotulista: el cuerpo sale de la línea más larga, acotado por
 * los dos lados —por abajo para que «Peso muerto rumano» siga siendo legible, por arriba
 * para que «Remo» no se coma el muro entero—.
 */

/** Cuánto tarda cada letra en salir detrás de la anterior, en milisegundos. */
const RETARDO_POR_LETRA = 26

/**
 * El espacio del rótulo es DURO, y hace falta.
 *
 * Cada letra va en su propio `inline-block` para poder levantarse sola, y un espacio
 * normal entre dos `inline-block` lo colapsa la maquetación: «PESO MUERTO» se leía
 * «PESOMUERTO». Se escribe por código y no como carácter suelto para que nadie lo
 * «limpie» al formatear.
 */
const ESPACIO_DURO = String.fromCharCode(160)

/**
 * EL CUERPO DE LETRA, EN `em` DEL CUADRO.
 *
 * Sale de la proporción de la maqueta —cuerpo = 470 px sobre un muro de 560— traducida a
 * este cuadro: allí el cuerpo era el 84 % del ancho del muro dividido por las letras de la
 * línea más larga, y aquí 1 em son el 5,2 % del ancho del cuadro. De ahí el 16,1, y de ahí
 * los dos topes: los 40 y 110 px de la maqueta son 1,37 y 3,77 em de este cuadro.
 */
export function cuerpoDelRotulo(lineas: readonly string[]): number {
  const masLarga = Math.max(1, ...lineas.map((l) => l.length))
  // El techo por ANCHO: que la línea más larga quepa de lado a lado.
  const porAncho = 16.1 / masLarga
  // Y el techo por ALTO, que es el que faltaba y se vio midiendo.
  //
  // El cuadro del muro promete 0,85 m de alto y de esa promesa sale a qué altura se
  // cuelga. Con el rótulo dentro, el bloque en reposo mide 132 px de 138: cabe. Pero el
  // cuerpo lo decide la línea MÁS LARGA, así que un nombre de dos palabras CORTAS —«PESO
  // MUERTO», seis letras la mayor— sale a 2,68 em y en dos líneas suma 72 px donde
  // «SENTADILLA GOBLET» suma 43. Ese sí se salía, y el cálculo habría seguido diciendo
  // que cabe: el tope declarado no lo mide nadie más que el testigo, y solo con el
  // ejercicio que tenga delante ese día.
  //
  // El presupuesto son 3,9 em de alto para el rótulo entero, repartidos entre sus líneas.
  // Es lo que un rotulista hace con una pared: el cartel tiene un alto, y el número de
  // renglones decide el cuerpo, no al revés.
  const porAlto = 3.9 / Math.max(1, lineas.length)
  return Math.max(1.37, Math.min(3.77, porAncho, porAlto))
}

/**
 * CÓMO SE PARTE UN NOMBRE EN LÍNEAS.
 *
 * Dos palabras van en dos líneas, y de tres en adelante las dos primeras se juntan arriba.
 * No es arbitrario: el nombre de un ejercicio empieza por el gesto —«Press», «Peso
 * muerto», «Remo»— y sigue con el matiz —«con barra», «rumano», «inclinado»—. Partiendo
 * así, la línea de arriba es el ejercicio y la de abajo el detalle, que es como se nombran
 * en una pizarra de gimnasio.
 */
export function lineasDelRotulo(nombre: string): string[] {
  const palabras = nombre.trim().toUpperCase().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return []
  if (palabras.length === 1) return [palabras[0]]
  if (palabras.length === 2) return palabras
  return [palabras.slice(0, 2).join(' '), palabras.slice(2).join(' ')]
}

export interface RotuloEnTrazoProps {
  nombre: string
}

export function RotuloEnTrazo({ nombre }: RotuloEnTrazoProps) {
  const lineas = lineasDelRotulo(nombre)
  if (lineas.length === 0) return null
  const cuerpo = cuerpoDelRotulo(lineas)

  // El retardo corre a lo largo de TODO el rótulo y no se reinicia en cada línea: las
  // letras se levantan una detrás de otra como una sola frase, no como dos bloques.
  let orden = 0

  return (
    <p
      className="muro-trazo"
      style={{ fontSize: `${cuerpo.toFixed(2)}em` }}
      // El nombre entero, en un solo nodo, para el lector de pantalla: partido en letras
      // se leería deletreado.
      aria-label={nombre}
    >
      {lineas.map((linea) => (
        <span key={linea} className="muro-trazo-linea" aria-hidden="true">
          {Array.from(linea).map((letra, i) => (
            <span
              key={`${linea}-${i}`}
              className="muro-trazo-letra"
              style={{ animationDelay: `${orden++ * RETARDO_POR_LETRA}ms` }}
            >
              {letra === ' ' ? ESPACIO_DURO : letra}
              {/* LOS DOS ECOS, y van DENTRO de la letra que se anima.
                  La animación de entrada termina en `transform: none` con `fill-mode:
                  both`: puesta en el mismo nodo que lleva el `translateZ` del eco, se lo
                  borraría al acabar y el canto desaparecería sin que nada se pusiera en
                  rojo. Anidados, el de fuera se levanta y los de dentro conservan su
                  profundidad. */}
              <span className="muro-trazo-eco muro-trazo-eco-1">{letra === ' ' ? ESPACIO_DURO : letra}</span>
              <span className="muro-trazo-eco muro-trazo-eco-2">{letra === ' ' ? ESPACIO_DURO : letra}</span>
            </span>
          ))}
        </span>
      ))}
    </p>
  )
}
