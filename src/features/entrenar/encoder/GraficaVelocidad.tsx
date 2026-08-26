import type { Repeticion } from './nucleo/analisis'

/**
 * La serie entera: velocidad contra tiempo, con el cero siempre visible.
 *
 * ## Por qué el cero no se puede recortar
 *
 * La curva cruza el cero en cada repetición: por encima está la concéntrica —el
 * atleta sube la barra— y por debajo la excéntrica. Si el eje se ajustara solo al
 * rango de los datos, esa frontera se perdería y la gráfica pasaría a ser una
 * línea ondulada bonita sin significado.
 *
 * ## Por qué concéntrica y excéntrica no se distinguen por color
 *
 * Se distinguen por **el lado del cero y el grosor**. El color está ocupado: la
 * marca usa el rojo para acción y el sistema de calidad usa la materia de la
 * placa. Meter un tercer código cromático aquí obligaría a leer una leyenda, y
 * esta pantalla se mira a dos metros.
 *
 * ## Los huecos no se interpolan
 *
 * Un fotograma sin dato corta el trazado y empieza un subpath nuevo. Unir los dos
 * extremos con una recta dibujaría una velocidad que nadie midió — y sería
 * indistinguible de una medida real, que es la peor clase de error que puede
 * cometer este producto.
 */

interface Props {
  t: number[]
  v: number[]
  reps: Repeticion[]
  unidad: string
  alto?: number
  className?: string
}

/** Un fotograma se considera perdido si su hueco temporal dobla la cadencia. */
function troceaEnHuecos(t: number[], v: number[]): Array<Array<[number, number]>> {
  const tramos: Array<Array<[number, number]>> = []
  let actual: Array<[number, number]> = []
  const dts: number[] = []
  for (let i = 1; i < t.length; i++) dts.push(t[i] - t[i - 1])
  const dtTipico = dts.length ? dts.slice().sort((a, b) => a - b)[Math.floor(dts.length / 2)] : 0

  for (let i = 0; i < t.length; i++) {
    if (i > 0 && dtTipico > 0 && t[i] - t[i - 1] > dtTipico * 2.5) {
      if (actual.length) tramos.push(actual)
      actual = []
    }
    if (Number.isFinite(v[i])) actual.push([t[i], v[i]])
    else if (actual.length) {
      tramos.push(actual)
      actual = []
    }
  }
  if (actual.length) tramos.push(actual)
  return tramos
}

export function GraficaVelocidad({ t, v, reps, unidad, alto = 168, className = '' }: Props) {
  if (t.length < 2) return null

  const W = 1000
  const H = alto
  const PAD = { arriba: 14, abajo: 14, izq: 4, der: 4 }

  const t0 = t[0]
  const t1 = t[t.length - 1]
  const finitos = v.filter(Number.isFinite)
  const vMax = Math.max(0.05, ...finitos)
  const vMin = Math.min(-0.05, ...finitos)

  const x = (tt: number) => PAD.izq + ((tt - t0) / (t1 - t0 || 1)) * (W - PAD.izq - PAD.der)
  const y = (vv: number) =>
    PAD.arriba + ((vMax - vv) / (vMax - vMin || 1)) * (H - PAD.arriba - PAD.abajo)

  const yCero = y(0)
  const tramos = troceaEnHuecos(t, v)

  // Cada tramo se parte además por el signo, para poder pintar la concéntrica y
  // la excéntrica con grosores distintos sin que salte de una a otra.
  const camino = (puntos: Array<[number, number]>) =>
    puntos.map(([tt, vv], i) => `${i === 0 ? 'M' : 'L'} ${x(tt).toFixed(1)} ${y(vv).toFixed(1)}`).join(' ')

  const arriba = tramos.map((p) => p.filter(([, vv]) => vv >= 0)).filter((p) => p.length > 1)
  const abajo = tramos.map((p) => p.filter(([, vv]) => vv < 0)).filter((p) => p.length > 1)

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: alto }}
        role="img"
        aria-label={`Velocidad de ${reps.length} repeticiones a lo largo de la serie, en ${unidad}`}
      >
        {/* El cero, siempre. Es la frontera entre subir y bajar la barra. */}
        <line
          x1={0}
          x2={W}
          y1={yCero}
          y2={yCero}
          stroke="var(--placa-muerta)"
          strokeWidth={1.2}
        />

        {abajo.map((p, i) => (
          <path
            key={`e${i}`}
            d={camino(p)}
            fill="none"
            stroke="var(--placa-muerta)"
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        ))}
        {arriba.map((p, i) => (
          <path
            key={`c${i}`}
            d={camino(p)}
            fill="none"
            stroke="var(--placa)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* El pico de cada repetición, con su velocidad media propulsiva encima:
            es la que se compara con las tablas de %1RM. */}
        {reps.map((r, i) => {
          const desde = Math.max(0, r.iInicio ?? 0)
          const hasta = Math.min(v.length - 1, r.iFin ?? v.length - 1)
          let iPico = desde
          for (let k = desde; k <= hasta; k++) if (v[k] > v[iPico]) iPico = k
          if (!Number.isFinite(v[iPico])) return null
          const vmp = r.vMediaPropulsiva
          return (
            <g key={`p${i}`}>
              <circle cx={x(t[iPico])} cy={y(v[iPico])} r={3} fill="var(--placa)" />
              {Number.isFinite(vmp) && (
                <text
                  x={x(t[iPico])}
                  y={y(v[iPico]) - 8}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={9}
                  fill="var(--tenue)"
                >
                  {(vmp as number).toFixed(2)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between font-mono text-[10.5px] tabular-nums text-tenue">
        <span>0 s</span>
        <span>
          arriba concéntrica · abajo excéntrica · {unidad}
        </span>
        <span>{(t1 - t0).toFixed(1)} s</span>
      </figcaption>
    </figure>
  )
}
