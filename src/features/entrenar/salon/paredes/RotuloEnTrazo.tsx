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

import { cuerpoDelRotulo, lineasDelRotulo } from './rotuloDelMuro'

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
