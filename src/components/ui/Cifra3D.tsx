import { useContadorAnimado } from './useContadorAnimado'

interface Cifra3DProps {
  /** El número. Sin él (`undefined`) se pinta una raya: no medido no es cero. */
  valor: number | undefined
  /** Decimales que se enseñan. Con 0 la cifra cuenta hasta su valor al entrar. */
  decimales?: number
  /** Lo que va pegado detrás de la cifra, dentro del relieve («%», «/4»). */
  sufijo?: string
  /** Solo para lo que pide atención: la maqueta reserva el rojo para eso. */
  rojo?: boolean
  /** Tamaño en px. La maqueta usa 30–48; 34 por defecto cabe «100%» en un tercio de 358 px. */
  tamano?: number
  /** Cómo lo dice un lector de pantalla, entero: «3 de 4 sesiones». */
  etiqueta: string
}

const FORMATO = new Map<number, Intl.NumberFormat>()

function formato(decimales: number): Intl.NumberFormat {
  let f = FORMATO.get(decimales)
  if (!f) {
    f = new Intl.NumberFormat('es-CO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
    FORMATO.set(decimales, f)
  }
  return f
}

/**
 * La cifra grande de los espacios del staff (maqueta «Espacios de Alpha», 28-sep): en
 * relieve, con un leve movimiento (`.cifra-3d` en `tokens.css`, que se queda quieta con
 * `prefers-reduced-motion`).
 *
 * El número que se VE va con `aria-hidden` y el lector de pantalla lee `etiqueta`: una
 * cifra que cuenta de 0 a 86 cambia de texto veinte veces en un segundo, y leída así es
 * ruido. La etiqueta dice el dato una vez y con sus palabras.
 */
export function Cifra3D({ valor, decimales = 0, sufijo = '', rojo = false, tamano = 34, etiqueta }: Cifra3DProps) {
  const animado = useContadorAnimado(valor ?? 0)
  // Solo se anima el entero: una cifra con decimales que cuenta enseña 7,1 · 7,1 · 7,2 y
  // parece que el dato duda. Esa sale ya quieta.
  const mostrado =
    valor === undefined ? '—' : decimales === 0 ? String(Math.round(animado)) : formato(decimales).format(valor)

  return (
    <span className="inline-flex">
      <span
        aria-hidden="true"
        className={`cifra-3d ${rojo ? 'cifra-3d-rojo' : ''}`}
        style={{ fontSize: `${tamano}px` }}
      >
        {mostrado}
        {valor !== undefined && sufijo}
      </span>
      <span className="sr-only">{etiqueta}</span>
    </span>
  )
}
