/**
 * Un valor y su barra de error, como una sola unidad tipográfica.
 *
 * Es la doctrina d1 del encoder: **un número sin su barra de error no es una
 * medida**. El ± no es letra pequeña opcional ni una nota al pie — es parte del
 * número, y por eso el par vive en un único `span` que no rompe de línea.
 *
 * «177 ± 15 mm» es una conversación y «178 ± 44 mm» es otra muy distinta. Hay que
 * poder tener las dos, y para eso el error tiene que ocupar visiblemente más
 * cuando es mayor: si el ±44 se pintara del mismo tamaño que el ±15, el diseño
 * estaría escondiendo justo el dato que cambia la decisión.
 *
 * Si no cabe, se reduce el cuerpo. **Nunca se rompe el par.**
 */

interface Props {
  valor: number
  /** La sigma. `undefined` cuando la medida no la trae; entonces no se pinta ±. */
  sigma?: number
  unidad?: string
  decimales?: number
  /** El prefijo ≈ de un eje estimado. Va pegado al número y en peso 400: es una
   *  de las tres señales que distinguen un eje derivado de uno visto. */
  aproximado?: boolean
  tamano?: 'principal' | 'diagnostico'
  /** `escala_dudosa` es el único caso de todo el sistema en que un valor medido
   *  NO va en color de texto pleno. No se usa en ningún otro sitio. */
  atenuado?: boolean
  className?: string
}

const fmt = (n: number, d: number) =>
  n.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d })

export function NumeroConError({
  valor,
  sigma,
  unidad,
  decimales = 0,
  aproximado = false,
  tamano = 'principal',
  atenuado = false,
  className = '',
}: Props) {
  const principal = tamano === 'principal'
  const cuerpo = principal ? 'text-[34px]' : 'text-[15px]'
  const color = atenuado ? 'text-tenue' : 'text-texto'

  return (
    // `whitespace-nowrap` es la regla, no un detalle: el par no se parte nunca.
    <span className={`inline-flex items-baseline whitespace-nowrap font-mono tabular-nums ${cuerpo} ${color} ${className}`}>
      {aproximado && <span className="font-normal">≈</span>}
      <span className="font-bold">{fmt(valor, decimales)}</span>
      {Number.isFinite(sigma) && (
        <>
          {/* Espacio fino: separa sin abrir un hueco que invite a partir la línea. */}
          <span aria-hidden="true">{' '}</span>
          <span className="text-[0.62em] text-tenue">± {fmt(sigma as number, decimales)}</span>
        </>
      )}
      {unidad && <span className="ml-[0.18em] text-[0.44em] text-tenue">{unidad}</span>}
    </span>
  )
}

/**
 * La duda dibujada a escala, que es la pieza central del estado `escala_dudosa`.
 *
 * Un ± es un signo: se lee, se entiende y no se siente. Aquí el intervalo se pinta
 * **como superficie sobre un eje real**, y debajo, a la misma escala, la anchura
 * que tendría esa misma medida con la escala sana. Puestas una encima de otra, la
 * comparación deja de ser un número y pasa a ser un tamaño: **casi tres veces**.
 *
 * La regla que lo hace honesto: si el copy dice que una banda es un intervalo,
 * la banda tiene que estar a escala. Un realce decorativo detrás del número sería
 * exactamente el «velo que el copy presenta como si midiera algo» que el encargo
 * prohíbe.
 */
export function IntervaloAEscala({
  valor,
  sigma,
  sigmaSana,
  max,
  unidad = 'mm',
}: {
  valor: number
  sigma: number
  /** La sigma que tendría la misma toma con la escala bien anclada. */
  sigmaSana: number
  /** El fondo de escala del eje. */
  max: number
  unidad?: string
}) {
  const pct = (x: number) => `${Math.max(0, Math.min(100, (x / max) * 100))}%`
  const ancho = (2 * sigma) / max
  const anchoSano = (2 * sigmaSana) / max
  const veces = sigmaSana > 0 ? sigma / sigmaSana : 0

  return (
    <div className="mt-3">
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--linea)]" />
        <div
          className="absolute top-1/2 h-4 -translate-y-1/2 bg-[var(--placa)]/25"
          style={{ left: pct(valor - sigma), width: pct(2 * sigma) }}
        />
        {/* El valor central es una marca de 2 px, no un punto gordo: el centro
            importa menos que la anchura, y el dibujo tiene que decirlo. */}
        <div
          className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-[var(--placa)]"
          style={{ left: pct(valor) }}
        />
      </div>
      <p className="mt-1 font-mono text-[11.5px] tabular-nums text-tenue">
        {Math.round(valor - sigma)} – {Math.round(valor + sigma)} {unidad}
      </p>

      <div className="relative mt-2 h-3">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--linea)]" />
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 bg-[var(--placa-muerta)]"
          style={{ left: pct(valor - sigmaSana), width: pct(2 * sigmaSana) }}
        />
      </div>
      <p className="mt-1 text-[11.5px] leading-snug text-tenue">
        Arriba, la duda de esta toma. Abajo y a la misma escala, la de una toma con la escala
        sana: <span className="font-mono tabular-nums">{veces.toFixed(1)}</span> veces más
        estrecha.
      </p>
      <span className="sr-only">
        El intervalo ocupa el {Math.round(ancho * 100)} % del eje; con la escala sana ocuparía
        el {Math.round(anchoSano * 100)} %.
      </span>
    </div>
  )
}
