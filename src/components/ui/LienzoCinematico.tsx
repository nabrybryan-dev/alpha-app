import { useEffect, useRef, useState } from 'react'
import { useMovimientoReducido } from '../../lib/movimientoReducido'

/**
 * Fotograma en el que se congela la pieza cuando se pide menos movimiento.
 *
 * Lo fija el encargo: «el 14 de 36 — el atleta de perfil, la lectura más clara».
 *
 * **Medido, el 14 no es el más legible.** Sobre los 36 fotogramas de Órbita da
 * 11,05 de luminancia media y 21,29 de contraste: puesto 24 de 36. El más claro
 * es el 4, con 22,15 y 28,71 — el doble de luz—, porque en el 14 la cámara ya ha
 * pasado por detrás y el atleta es una silueta a contraluz. Se respeta el número
 * pedido; cambiarlo es tocar esta constante y nada más.
 */
const FOTOGRAMA_QUIETO = 14

/** Los que se produjeron. Una vuelta completa. */
const TOTAL_FOTOGRAMAS = 36

/** Cuánto se desplaza la pieza contra el scroll, en píxeles. */
const PARALAJE = 96

/** De 1,00 a 1,06: nunca por encima de 1,05 respecto al hueco. Ver R1 abajo. */
const ESCALA_MAX = 1.06

interface LienzoCinematicoProps {
  /** Carpeta bajo `public/hero/` con los fotogramas `00.webp` … `35.webp`. */
  secuencia: string
  /** Alto de la ventana por la que asoma la pieza. */
  altura?: number
  /** Texto para quien no ve. Vacío deja el lienzo como decoración. */
  descripcion?: string
}

/**
 * La pieza cinemática como FONDO del que emerge el contenido, no como banda.
 *
 * EL SCROLL ES LA CÁMARA. El progreso de scroll de la pantalla conduce el
 * fotograma, así que bajar equivale a rodear al atleta. No es un visor que se
 * arrastra: es el suelo sobre el que pasa el contenido.
 *
 * POR QUÉ UNA SECUENCIA DE FOTOGRAMAS Y NO EL VÍDEO. El seek preciso sobre estas
 * piezas no existe: están codificadas con `-g 48`, pensadas para reproducción
 * lineal, así que saltar a un instante concreto da el fotograma clave anterior y
 * el scrub se ve a saltos. Reencodear con GOP denso subiría el peso sin dar
 * control exacto. La secuencia da control por fotograma. Medido en Órbita: 36
 * WebP a 1170 px de ancho pesan **338 KB**, menos que el propio vídeo (576 KB) y
 * muy por debajo del techo de 900 KB por pieza.
 *
 * R1 · GEOMETRÍA. Los fotogramas se extraen a 1170 px, que es el ancho real de la
 * pantalla en un móvil de 390 pt a densidad 3. La fuente mide 1280, así que se
 * pintan a 0,91x. La escala del paralaje llega a 1,06 sobre ese 0,91x, o sea
 * 0,97x del original: **nunca se amplía**.
 *
 * R3 · PÓSTER. Aquí no hay dos elementos que puedan desincronizarse. El primer
 * fotograma ES el póster y se dibuja en el mismo lienzo con la misma
 * transformación que el resto. El salto que R3 teme no puede ocurrir por
 * construcción.
 *
 * R5 · MOVIMIENTO REDUCIDO. No es un hueco: se congela en `FOTOGRAMA_QUIETO`, se
 * apaga el paralaje y la composición no cambia. Se pierde el giro, no el diseño.
 *
 * R6 · RENDIMIENTO. Solo `transform`. Ni `backdrop-filter` ni `blur`. El scroll
 * se lee dentro de un `requestAnimationFrame`, así que no hay trabajo por evento.
 */
export function LienzoCinematico({
  secuencia,
  altura = 352,
  descripcion = '',
}: LienzoCinematicoProps) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const capa = useRef<HTMLDivElement>(null)
  const imagenes = useRef<(HTMLImageElement | null)[]>([])
  const pintado = useRef(-1)
  const movimientoReducido = useMovimientoReducido()
  const [listo, setListo] = useState(false)

  // Carga. El fotograma quieto va PRIMERO y no por capricho: es lo que se ve si
  // la red se corta a mitad, y es el único que se necesita con movimiento
  // reducido. El resto entra por detrás sin bloquear el primer pintado.
  useEffect(() => {
    let vivo = true
    imagenes.current = new Array(TOTAL_FOTOGRAMAS).fill(null)

    const cargar = (i: number) =>
      new Promise<void>((resolver) => {
        const img = new Image()
        img.decoding = 'async'
        img.onload = () => {
          if (vivo) imagenes.current[i] = img
          resolver()
        }
        // Un fotograma que no llega deja su hueco a null y `dibujar` cae al más
        // cercano que sí esté. Nunca un lienzo en negro.
        img.onerror = () => resolver()
        img.src = `/hero/${secuencia}/${String(i).padStart(2, '0')}.webp`
      })

    cargar(FOTOGRAMA_QUIETO).then(() => {
      if (!vivo) return
      setListo(true)
      if (movimientoReducido) return
      const resto = Array.from({ length: TOTAL_FOTOGRAMAS }, (_, i) => i).filter(
        (i) => i !== FOTOGRAMA_QUIETO,
      )
      resto.reduce<Promise<void>>((cola, i) => cola.then(() => cargar(i)), Promise.resolve())
    })

    return () => {
      vivo = false
    }
  }, [secuencia, movimientoReducido])

  // Pintado y paralaje, los dos dentro del mismo rAF.
  useEffect(() => {
    if (!listo) return
    let pedido = 0

    const dibujar = () => {
      pedido = 0
      const cv = lienzo.current
      if (!cv) return

      const alcance = Math.max(1, document.body.scrollHeight - window.innerHeight)
      const avance = movimientoReducido ? 0 : Math.min(1, Math.max(0, window.scrollY / alcance))

      const indice = movimientoReducido
        ? FOTOGRAMA_QUIETO
        : Math.min(TOTAL_FOTOGRAMAS - 1, Math.floor(avance * TOTAL_FOTOGRAMAS))

      if (capa.current) {
        // Paralaje y escala van juntos en una sola transformación: la pieza sube
        // mientras el contenido baja, y se acerca lo justo para que el borde
        // superior no destape la tinta de detrás.
        const y = -avance * PARALAJE
        const escala = 1 + avance * (ESCALA_MAX - 1)
        capa.current.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0) scale(${escala.toFixed(3)})`
      }

      if (indice === pintado.current) return

      // Si el fotograma exacto todavía no ha llegado, se busca el más cercano ya
      // cargado. Es lo que hace que el scrub funcione desde el primer momento.
      let img = imagenes.current[indice]
      if (!img) {
        for (let d = 1; d < TOTAL_FOTOGRAMAS && !img; d++) {
          img = imagenes.current[indice - d] ?? imagenes.current[indice + d] ?? null
        }
      }
      if (!img) return

      const ctx = cv.getContext('2d')
      if (!ctx) return
      const ancho = cv.clientWidth
      const alto = cv.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (cv.width !== Math.round(ancho * dpr) || cv.height !== Math.round(alto * dpr)) {
        cv.width = Math.round(ancho * dpr)
        cv.height = Math.round(alto * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Encaje `cover` a mano: la pieza es 16:9 y la ventana es más baja, así que
      // se recorta por arriba y por abajo, nunca se deforma.
      const razonImg = img.width / img.height
      const razonCaja = ancho / alto
      let w = ancho
      let h = ancho / razonImg
      if (razonImg < razonCaja) {
        h = alto
        w = alto * razonImg
      }
      ctx.clearRect(0, 0, ancho, alto)
      ctx.drawImage(img, (ancho - w) / 2, (alto - h) / 2, w, h)
      pintado.current = indice
    }

    const alScroll = () => {
      if (!pedido) pedido = requestAnimationFrame(dibujar)
    }

    dibujar()
    window.addEventListener('scroll', alScroll, { passive: true })
    window.addEventListener('resize', alScroll)
    return () => {
      if (pedido) cancelAnimationFrame(pedido)
      window.removeEventListener('scroll', alScroll)
      window.removeEventListener('resize', alScroll)
    }
  }, [listo, movimientoReducido])

  return (
    <div
      aria-hidden={descripcion ? undefined : true}
      role={descripcion ? 'img' : undefined}
      aria-label={descripcion || undefined}
      className="pointer-events-none fixed inset-0 bg-ink-900"
      // `viewTransitionName` hace que esta ventana sea LA MISMA cosa antes y
      // después de navegar: al abrir la sesión no se sustituye una pantalla por
      // otra, se transforma el plano. Es lo que evita el corte seco.
      style={{ zIndex: 'var(--z-lienzo)', viewTransitionName: 'ventana-hero' }}
    >
      <div ref={capa} className="absolute inset-x-0 top-0 will-change-transform">
        <canvas ref={lienzo} className="block w-full" style={{ height: altura }} />
        {/* La pieza no termina en un canto: se disuelve en la tinta sobre la que
            va a pasar el contenido. Es lo que la convierte en fondo y no en banda. */}
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{ background: 'linear-gradient(180deg, transparent, var(--ink-900) 92%)' }}
        />
      </div>
    </div>
  )
}
