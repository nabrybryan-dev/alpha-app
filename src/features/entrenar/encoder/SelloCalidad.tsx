import type { NivelCalidad } from './nucleo/analisis'
import { COPY } from './copys'

/**
 * El veredicto de una toma, como una placa troquelada.
 *
 * ## Por qué una placa y no un color
 *
 * La marca quitó el verde a propósito —`--verde` es un plata neutro— y el rojo es
 * el color de marca, no el de error: un número en rojo NO significa que algo vaya
 * mal. Con eso, el semáforo está prohibido por partida doble.
 *
 * La silueta es **idéntica en los tres estados** y lo que cambia es de qué está
 * hecha: llena, hueca, hundida. El eje es la **cantidad de materia**, no el matiz,
 * y por eso se lee a tres metros con luz de gimnasio, sobrevive al contraluz y
 * funciona en escala de grises.
 *
 * ## Lo que se descartó, y por qué importa
 *
 * **La opacidad.** Es la salida fácil y está descartada: a tres metros un elemento
 * al 50 % desaparece, y `descartada` es justo el estado que MÁS tiene que verse.
 * Los tres van a opacidad 1.
 *
 * **El cambio de tipografía.** Los tres usan el mismo peso, cuerpo y caja. Si el
 * estado se leyera en la letra, dejaría de leerse en la forma.
 */

type Nivel = NivelCalidad

const TROQUEL =
  'polygon(var(--troquel) 0, 100% 0, 100% calc(100% - var(--troquel)), calc(100% - var(--troquel)) 100%, 0 100%, 0 var(--troquel))'

const TITULO: Record<Nivel, string> = {
  buena: COPY.calidad_buena,
  dudosa: COPY.calidad_dudosa,
  descartada: COPY.calidad_descartada,
}

const SUBTITULO: Record<Nivel, string> = {
  buena: COPY.calidad_buena_sub,
  dudosa: COPY.calidad_dudosa_sub,
  descartada: COPY.calidad_descartada_sub,
}

interface SelloProps {
  nivel: Nivel
  /** El sello grande de una pantalla de resultado, o el de una fila de lista. */
  tamano?: 'grande' | 'inline'
  /** Se pinta pegado a la placa, no flotando aparte: un sello dudoso sin su
   *  motivo no es un sello. Se ignora en `buena`, que por definición no tiene. */
  children?: React.ReactNode
  /** Sustituye la lectura genérica del nivel por la de esta pantalla.
   *
   *  El mismo veredicto se lee distinto según lo que se esté juzgando: en un
   *  resultado, `buena` significa «este número decide carga»; en el encuadre, que
   *  todavía no hay número, significa «desde aquí sale una medida en la que se
   *  puede confiar». El sello es el mismo objeto y la frase no. */
  subtitulo?: string
  className?: string
}

export function SelloCalidad({
  nivel,
  tamano = 'grande',
  children,
  subtitulo,
  className = '',
}: SelloProps) {
  const grande = tamano === 'grande'

  // Los tres estados comparten silueta, cuerpo y peso. Solo cambia la materia.
  const materia: Record<Nivel, string> = {
    // Llena: el objeto más brillante de la pantalla. Se identifica antes de leer
    // la palabra, que es exactamente lo que hace falta a tres metros.
    buena: 'bg-[var(--placa)] text-[#0a0a0a]',
    // Hueca: el mismo metal, pero solo el filete.
    dudosa: 'bg-transparent text-[var(--placa)] ring-2 ring-inset ring-[var(--placa)]',
    // Hundida: más oscura que el fondo de página, con la única sombra interior
    // del sistema. Se lee como un hueco en la superficie, no como una tarjeta.
    descartada:
      'bg-[var(--hundido)] text-[var(--gris-marca)] ring-1 ring-inset ring-[var(--placa-muerta)] shadow-[var(--sombra-hundido)]',
  }

  return (
    <div className={className}>
      <div
        className={`${materia[nivel]} ${grande ? 'px-4 py-3' : 'px-2.5 py-1.5'}`}
        style={{ clipPath: TROQUEL }}
      >
        <p
          className={`font-display font-extrabold uppercase leading-none tracking-[0.08em] ${
            grande ? 'text-[25px]' : 'text-[9.5px]'
          }`}
        >
          {TITULO[nivel]}
        </p>
        {grande && (
          <p className="mt-1.5 text-[13px] leading-snug opacity-80">
            {subtitulo ?? SUBTITULO[nivel]}
          </p>
        )}
      </div>
      {/* Soldado a la placa: en contacto con ella y del mismo ancho. */}
      {children && nivel !== 'buena' && <div className="mt-0">{children}</div>}
    </div>
  )
}

/**
 * La misma placa hundida, para cuando no hay veredicto sino ausencia de medida.
 *
 * `sin_medicion`, `no_medible` y el «no lo sé» de palancas la usan con **la misma
 * superficie y el mismo cuerpo que un resultado bueno**. Esa es la respuesta de
 * diseño a la doctrina d2: el estado «no sé» no es un hueco, es un resultado con
 * otro contenido, y tiene que ocupar el mismo sitio en la pantalla.
 */
export function PlacaHundida({
  titulo,
  children,
  className = '',
}: {
  titulo: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`bg-[var(--hundido)] px-4 py-3 text-[var(--gris-marca)] ring-1 ring-inset ring-[var(--placa-muerta)] shadow-[var(--sombra-hundido)] ${className}`}
      style={{ clipPath: TROQUEL }}
    >
      <p className="font-display text-[24px] font-extrabold uppercase leading-none tracking-[0.08em]">
        {titulo}
      </p>
      {children && <div className="mt-2 text-[13px] leading-snug">{children}</div>}
    </div>
  )
}
