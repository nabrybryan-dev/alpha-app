import { useId, useState, type MouseEvent } from 'react'
import { etiquetaFuente, fechaCorta, type FuenteDato, type PuntoSerie } from '../../../domain/consolaCoach/perfilCompleto'

/**
 * Las gráficas de la consola, en SVG a mano: sin librería (el paquete no trae ninguna y
 * estas dos formas no la justifican).
 *
 * MOVIMIENTO: la línea se DIBUJA (`.dibujar-linea`, `pathLength=1`), el área aparece
 * detrás (`.area-aparece`) y las barras crecen desde la base (`.barra-sube`). Las tres son
 * keyframes con solo `from`: el estado final es el propio del elemento, así que si la
 * animación no corre —jsdom, movimiento reducido, pestaña congelada— la gráfica está
 * entera y visible. Nada depende de JS para aparecer.
 *
 * COLOR: tokens del sistema (`text-rojo`, `text-azul`…) vía `currentColor`, así la misma
 * gráfica se lee en claro y en oscuro sin duplicar paletas.
 */

const TONOS = ['text-rojo', 'text-azul', 'text-ambar', 'text-texto'] as const

export interface SerieGrafica {
  nombre: string
  puntos: readonly PuntoSerie[]
}

function ms(fecha: string): number {
  return new Date(`${fecha}T00:00:00Z`).getTime()
}

function formatoValor(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

/** La marca de cada fuente: círculo (check-in), cuadrado (medida), rombo (formulario). */
function Marca({ x, y, fuente, activa }: { x: number; y: number; fuente: FuenteDato; activa: boolean }) {
  const r = activa ? 5.5 : 3.5
  if (fuente === 'medida') {
    return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} className="fill-current stroke-surface-1" strokeWidth={1.5} />
  }
  if (fuente === 'formulario') {
    return (
      <path
        d={`M${x} ${y - r - 1} L${x + r + 1} ${y} L${x} ${y + r + 1} L${x - r - 1} ${y} Z`}
        className="fill-current stroke-surface-1"
        strokeWidth={1.5}
      />
    )
  }
  return <circle cx={x} cy={y} r={r} className="fill-current stroke-surface-1" strokeWidth={1.5} />
}

const ANCHO = 640
const MARGEN = { izq: 40, der: 14, arr: 14, aba: 26 }

interface GraficaLineaProps {
  series: readonly SerieGrafica[]
  unidad: string
  alto?: number
  /** Texto accesible: qué dice la gráfica en una frase. */
  descripcion: string
}

/**
 * Curva(s) en el tiempo con eje de fechas real (no equiespaciado: dos check-ins seguidos y
 * una medida de hace un mes no están a la misma distancia). Al pasar el puntero, una guía
 * vertical y la lectura del punto más cercano.
 */
export function GraficaLinea({ series, unidad, alto = 200, descripcion }: GraficaLineaProps) {
  const idGradiente = useId().replace(/:/g, '')
  const [cursor, setCursor] = useState<{ serie: number; punto: number } | null>(null)

  const todos = series.flatMap((s) => s.puntos)
  if (todos.length === 0) return null

  const xs = todos.map((p) => ms(p.fecha))
  const ys = todos.map((p) => p.valor)
  let xMin = Math.min(...xs)
  let xMax = Math.max(...xs)
  if (xMin === xMax) {
    xMin -= 86_400_000 * 3
    xMax += 86_400_000 * 3
  }
  const yMinDato = Math.min(...ys)
  const yMaxDato = Math.max(...ys)
  const holgura = Math.max((yMaxDato - yMinDato) * 0.15, yMaxDato * 0.01, 0.5)
  const yMin = yMinDato - holgura
  const yMax = yMaxDato + holgura

  const anchoUtil = ANCHO - MARGEN.izq - MARGEN.der
  const altoUtil = alto - MARGEN.arr - MARGEN.aba
  const x = (fecha: string) => MARGEN.izq + ((ms(fecha) - xMin) / (xMax - xMin)) * anchoUtil
  const y = (v: number) => MARGEN.arr + (1 - (v - yMin) / (yMax - yMin)) * altoUtil

  const lineas = [0, 0.5, 1].map((t) => yMin + holgura + t * (yMaxDato - yMinDato))

  const moverCursor = (e: MouseEvent<SVGSVGElement>) => {
    const caja = e.currentTarget.getBoundingClientRect()
    if (caja.width === 0) return
    const px = ((e.clientX - caja.left) / caja.width) * ANCHO
    let mejor = { serie: -1, punto: -1, d: Infinity }
    for (let i = 0; i < series.length; i++) {
      for (let j = 0; j < series[i].puntos.length; j++) {
        const d = Math.abs(x(series[i].puntos[j].fecha) - px)
        if (d < mejor.d) mejor = { serie: i, punto: j, d }
      }
    }
    if (mejor.serie >= 0) setCursor({ serie: mejor.serie, punto: mejor.punto })
  }

  const puntoCursor = cursor ? series[cursor.serie]?.puntos[cursor.punto] : undefined

  return (
    <figure className="grafica-consola relative m-0">
      <svg
        viewBox={`0 0 ${ANCHO} ${alto}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label={descripcion}
        onMouseMove={moverCursor}
        onMouseLeave={() => setCursor(null)}
      >
        <defs>
          <linearGradient id={`area-${idGradiente}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>

        {lineas.map((v, i) => (
          <g key={i}>
            <line
              x1={MARGEN.izq}
              x2={ANCHO - MARGEN.der}
              y1={y(v)}
              y2={y(v)}
              className="stroke-linea"
              strokeDasharray={i === 0 ? undefined : '3 5'}
            />
            <text x={MARGEN.izq - 6} y={y(v) + 3.5} textAnchor="end" className="fill-tenue cifras text-[10px]">
              {formatoValor(Math.round(v * 10) / 10)}
            </text>
          </g>
        ))}

        <text x={MARGEN.izq} y={alto - 6} className="fill-tenue cifras text-[10px]">
          {fechaCorta(new Date(xMin).toISOString().slice(0, 10))}
        </text>
        <text x={ANCHO - MARGEN.der} y={alto - 6} textAnchor="end" className="fill-tenue cifras text-[10px]">
          {fechaCorta(new Date(xMax).toISOString().slice(0, 10))}
        </text>

        {series.map((s, i) => {
          const tono = TONOS[i % TONOS.length]
          if (s.puntos.length === 0) return null
          const d = s.puntos.map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.fecha).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(' ')
          const base = MARGEN.arr + altoUtil
          const area =
            s.puntos.length > 1
              ? `${d} L${x(s.puntos[s.puntos.length - 1].fecha).toFixed(1)} ${base} L${x(s.puntos[0].fecha).toFixed(1)} ${base} Z`
              : undefined
          return (
            <g key={s.nombre} className={tono}>
              {area && series.length === 1 && (
                <path d={area} fill={`url(#area-${idGradiente})`} className="area-aparece" />
              )}
              {s.puntos.length > 1 && (
                <path
                  d={d}
                  pathLength={1}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.25}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className="dibujar-linea"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              )}
              {s.puntos.map((p, j) => (
                <g key={`${p.fecha}-${p.fuente}-${j}`} className="grafica-punto" style={{ animationDelay: `${300 + j * 25}ms` }}>
                  <Marca
                    x={x(p.fecha)}
                    y={y(p.valor)}
                    fuente={p.fuente}
                    activa={cursor?.serie === i && cursor.punto === j}
                  />
                  <title>{`${s.nombre}: ${formatoValor(p.valor)} ${unidad} · ${p.fecha} · ${etiquetaFuente(p.fuente)}`}</title>
                </g>
              ))}
            </g>
          )
        })}

        {puntoCursor && (
          <line
            x1={x(puntoCursor.fecha)}
            x2={x(puntoCursor.fecha)}
            y1={MARGEN.arr}
            y2={MARGEN.arr + altoUtil}
            className="stroke-tenue"
            strokeDasharray="2 3"
            pointerEvents="none"
          />
        )}
      </svg>

      <figcaption className="mt-1.5 flex min-h-[20px] flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-tenue">
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {series.length > 1 &&
            series.map((s, i) => (
              <span key={s.nombre} className={`inline-flex items-center gap-1 ${TONOS[i % TONOS.length]}`}>
                <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                <span className="text-tenue">{s.nombre}</span>
              </span>
            ))}
          <LeyendaFuentes fuentes={new Set(todos.map((p) => p.fuente))} />
        </span>
        {puntoCursor && cursor ? (
          <span className="cifras font-bold text-texto" aria-live="polite">
            {series.length > 1 ? `${series[cursor.serie].nombre} · ` : ''}
            {formatoValor(puntoCursor.valor)} {unidad} · {fechaCorta(puntoCursor.fecha)}
          </span>
        ) : null}
      </figcaption>
    </figure>
  )
}

function LeyendaFuentes({ fuentes }: { fuentes: Set<FuenteDato> }) {
  if (fuentes.size <= 1 && !fuentes.has('formulario') && !fuentes.has('medida')) return null
  const simbolo: Record<FuenteDato, string> = { checkin: '●', medida: '■', formulario: '◆' }
  return (
    <>
      {[...fuentes].map((f) => (
        <span key={f}>
          <span aria-hidden="true">{simbolo[f]}</span> {etiquetaFuente(f)}
        </span>
      ))}
    </>
  )
}

// ── Barras ────────────────────────────────────────────────────────────────────────────

export interface SegmentoBarra {
  valor: number
  /** Clase de color de fondo (`bg-verde`, `bg-ambar`…). */
  tono: string
  etiqueta: string
}

export interface BarraGrafica {
  clave: string
  etiqueta: string
  /** Para barras simples; se ignora si hay `segmentos`. */
  valor?: number
  segmentos?: SegmentoBarra[]
  destacada?: boolean
  titulo: string
}

interface GraficaBarrasProps {
  barras: readonly BarraGrafica[]
  /** Valor que llena la barra entera (100 para porcentajes). */
  maximo: number
  alto?: number
  descripcion: string
  sufijo?: string
}

/** Barras verticales que crecen desde la base, escalonadas. Simples o apiladas. */
export function GraficaBarras({ barras, maximo, alto = 132, descripcion, sufijo = '' }: GraficaBarrasProps) {
  if (barras.length === 0 || maximo <= 0) return null
  return (
    <figure className="m-0" role="img" aria-label={descripcion}>
      <div className="flex items-end gap-1.5" style={{ height: alto }}>
        {barras.map((b, i) => {
          const total = b.segmentos ? b.segmentos.reduce((s, x) => s + x.valor, 0) : (b.valor ?? 0)
          const pct = Math.max(0, Math.min(1, total / maximo))
          return (
            <div key={b.clave} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={b.titulo}>
              <span
                className={`cifras text-[10px] font-bold ${b.destacada ? 'text-texto' : 'text-tenue'} opacity-80 transition-opacity duration-base group-hover:opacity-100`}
              >
                {b.valor !== undefined && !b.segmentos ? `${Math.round(b.valor)}${sufijo}` : total}
              </span>
              <div
                className={`barra-sube relative flex w-full max-w-[42px] flex-col-reverse overflow-hidden rounded-t-md ${
                  b.destacada ? 'ring-2 ring-rojo/60 ring-offset-1 ring-offset-surface-1' : ''
                } ${total === 0 ? 'bg-linea' : ''}`}
                style={{ height: `${Math.max(pct * 100, total === 0 ? 3 : 4)}%`, animationDelay: `${i * 45}ms` }}
              >
                {b.segmentos
                  ? b.segmentos.map((s) =>
                      s.valor > 0 ? (
                        <div key={s.etiqueta} className={s.tono} style={{ height: `${(s.valor / total) * 100}%` }} />
                      ) : null,
                    )
                  : total > 0 && <div className={`h-full ${b.destacada ? 'bg-rojo' : 'bg-texto/70'}`} />}
              </div>
              <span className={`cifras truncate text-[10px] ${b.destacada ? 'font-bold text-texto' : 'text-tenue'}`}>
                {b.etiqueta}
              </span>
            </div>
          )
        })}
      </div>
    </figure>
  )
}
