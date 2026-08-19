import logoAguilaAlfa from '../../assets/brand/logo-aguila-alfa.png'
import monogramaAAlfa from '../../assets/brand/monograma-a-alfa.png'
import wordmarkAlfa from '../../assets/brand/wordmark-alfa.png'

/**
 * Las marcas de Alpha que solo existen en ráster, pintadas con el color del tema.
 *
 * EL PROBLEMA. Los cuatro logotipos oficiales eran JPEG blanco sobre negro, con
 * el fondo cocido dentro del archivo. Un JPEG no tiene transparencia, así que
 * cada sitio que los usaba llevaba encima el mismo apaño —borde redondeado y
 * línea— para que el recuadro negro pareciera intencionado.
 *
 * POR QUÉ NO BASTA CON HACERLOS TRANSPARENTES. Se probó, y destapó el motivo
 * real de la caja: la marca es BLANCA. Sobre el fondo hueso del tema claro, un
 * PNG transparente desaparece. El recuadro negro no era solo un artefacto:
 * estaba dando el contraste que la marca necesita.
 *
 * LA SALIDA. El canal alfa se saca de la luminancia del propio archivo, así que
 * la silueta es EXACTAMENTE la del logotipo —no una reinterpretación— y se usa
 * como MÁSCARA. El color lo pone `currentColor`. La marca toma el color del
 * texto que la rodea y el tema la invierte sola, igual que el vector de
 * `MarcaAguila`. Adiós a la caja.
 *
 * La cabeza de halcón NO está aquí: de esa sí existe el vector, y va en
 * `MarcaAguila.tsx`.
 */

const MASCARAS = {
  /** Logotipo principal: águila musculada con la «A» y el texto debajo. */
  aguila: { src: logoAguilaAlfa, ratio: '544 / 693' },
  /** Monograma «A» rasgado. */
  monograma: { src: monogramaAAlfa, ratio: '442 / 394' },
  /** Wordmark ALPHA ATHLETICS. */
  wordmark: { src: wordmarkAlfa, ratio: '523 / 133' },
} as const

export type NombreDeMarca = keyof typeof MASCARAS

interface MarcaRasterProps {
  marca: NombreDeMarca
  /** Clase de tamaño y color. La marca se pinta con `currentColor`. */
  className?: string
  /**
   * Texto para quien no ve. Vacío por defecto: en casi todos los sitios la
   * marca acompaña a un título que ya dice dónde está.
   */
  alt?: string
}

export function MarcaRaster({ marca, className = '', alt = '' }: MarcaRasterProps) {
  const { src, ratio } = MASCARAS[marca]
  const mascara = {
    // `block` explícito: un `span` es inline, y en un elemento inline el alto y
    // el ancho no aplican. Sin esto la marca se queda sin caja y no se ve —
    // salvo donde el padre es una rejilla, que convierte al hijo en bloque y
    // disimula el fallo justo donde más fácil es no notarlo.
    display: 'block',
    aspectRatio: ratio,
    backgroundColor: 'currentColor',
    // `-webkit-` primero: Safari todavía lo necesita, y sin el prefijo la marca
    // se pintaria como un bloque de color macizo.
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  } as const

  return (
    <span
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={className}
      style={mascara}
    />
  )
}
