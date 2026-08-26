import { Card } from '../../../components/ui/Card'
import { COPY } from './copys'
import { PlacaHundida } from './SelloCalidad'
import {
  hayTendencia,
  puntosDelHistorial,
  tomasDeLaTendencia,
  tramoQueSeñalar,
  type TomaDelHistorial,
  type TramoDelHistorial,
} from './historial'

/**
 * La velocidad de la primera repetición a lo largo de las semanas.
 *
 * ## El aviso de hora no es un error
 *
 * Ni rojo, ni icono de alerta, ni la palabra «error». El título habla de la
 * **comparación**, no de la medida: «Estas dos no se comparan». Las dos tomas
 * pueden ser impecables y aun así no sostenerse una al lado de la otra, porque la
 * fuerza sube de la mañana a la tarde por sí sola. Llamarlo error mandaría a
 * repetir una medición que está bien.
 *
 * Son dos pesos y no uno: romper la comparación —mañana contra tarde— lleva
 * tarjeta con título y el texto íntegro; unas horas de diferencia llevan una
 * línea y nada más. Y cuando no hay nada que decir **no se pinta nada**: sin
 * marco vacío y sin hueco reservado.
 *
 * ## Las dudosas se ven y no cuentan
 *
 * Punto hueco, valor en gris, fuera de la línea. Una toma con la escala en duda
 * mueve la tendencia igual que una buena, y la tendencia es lo que la gente lee.
 * Las descartadas no aparecen: su número es falso.
 */

interface Props {
  tomas: TomaDelHistorial[]
  ejercicio?: string
}

function Aviso({ tramo }: { tramo: TramoDelHistorial }) {
  const horas = Math.round(tramo.aviso.horasDeDiferencia)

  if (!tramo.aviso.comparables) {
    return (
      <Card>
        <div className="border-l-[3px] border-l-[var(--placa)] pl-3">
          <p className="font-display text-[15px] font-bold text-texto">
            {COPY.historial_no_comparable_titulo}
          </p>
          <p className="mt-1.5 text-[13px] leading-snug text-tenue">
            {COPY.historial_no_comparable}
          </p>
          <p className="mt-2 font-mono text-[11.5px] text-tenue">
            {tramo.aviso.franjaA} → {tramo.aviso.franjaB} · {horas} h
          </p>
          <p className="mt-2 text-[13px] leading-snug text-texto">
            {COPY.historial_no_comparable_cierre}
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <p className="border-l-[3px] border-l-[var(--placa-muerta)] pl-3 text-[12.5px] leading-snug text-tenue">
        {tramo.aviso.aviso ?? COPY.historial_aviso_suave}
      </p>
    </Card>
  )
}

function Grafica({ tomas }: { tomas: TomaDelHistorial[] }) {
  const puntos = puntosDelHistorial(tomas)
  const buenas = tomasDeLaTendencia(tomas)
  const W = 320
  const H = 132
  const pad = 14

  const ts = puntos.map((p) => Date.parse(p.fecha))
  const vs = puntos.map((p) => p.vPrimera)
  const t0 = Math.min(...ts)
  const t1 = Math.max(...ts)
  const vMin = Math.min(...vs)
  const vMax = Math.max(...vs)
  const x = (f: string) => pad + ((Date.parse(f) - t0) / (t1 - t0 || 1)) * (W - 2 * pad)
  const y = (v: number) => pad + ((vMax - v) / (vMax - vMin || 1)) * (H - 2 * pad)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} role="img"
      aria-label={`Velocidad de la primera repetición en ${puntos.length} tomas`}>
      {/* La línea une SOLO las buenas. Si una dudosa la moviera, la tendencia
          diría algo que sus propios puntos no sostienen. */}
      {buenas.length > 1 && (
        <path
          d={buenas.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.fecha).toFixed(1)} ${y(p.vPrimera).toFixed(1)}`).join(' ')}
          fill="none"
          stroke="var(--placa)"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      )}
      {puntos.map((p) =>
        p.calidad === 'buena' ? (
          <circle key={p.fecha} cx={x(p.fecha)} cy={y(p.vPrimera)} r={4.5} fill="var(--placa)" />
        ) : (
          // Hueca: mismo sitio, otra materia. Se ve que está y que no cuenta.
          <circle
            key={p.fecha}
            cx={x(p.fecha)}
            cy={y(p.vPrimera)}
            r={4}
            fill="none"
            stroke="var(--gris-marca)"
            strokeWidth={2}
          />
        ),
      )}
    </svg>
  )
}

export function HistorialEncoder({ tomas, ejercicio }: Props) {
  if (!hayTendencia(tomas)) {
    return (
      <PlacaHundida titulo="Sin tendencia">
        <p className="text-[13px] leading-snug">{COPY.historial_vacio}</p>
      </PlacaHundida>
    )
  }

  const tramo = tramoQueSeñalar(tomas)

  return (
    <div className="space-y-3">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-wide text-tenue">
          Velocidad de la primera repetición
        </p>
        {ejercicio && (
          <h2 className="mt-1 font-display text-[19px] font-bold leading-tight text-texto">
            {ejercicio}
          </h2>
        )}
      </header>

      <Card>
        <Grafica tomas={tomas} />
      </Card>

      {/* Sin nada que decir no se pinta nada: ni marco vacío ni placeholder. */}
      {tramo && <Aviso tramo={tramo} />}

      <Card>
        <p className="text-[12.5px] leading-snug text-tenue">{COPY.historial_que_entra}</p>
      </Card>
    </div>
  )
}
