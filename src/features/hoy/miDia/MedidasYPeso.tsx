import { Link } from 'react-router-dom'
import { Cifra3D } from '../../../components/ui/Cifra3D'
import { db } from '../../../data/dbInstance'
import { visibilidadDelAsesorado } from '../../../data/visibilidadDelAsesorado'
import { cambioDePeso, perimetrosRecientes, serieDePeso, type PuntoDePeso } from '../../../domain/miDia'

interface MedidasYPesoProps {
  usuarioId: string
  hoy: string
}

const SEMANAS = 8
const ANCHO = 320
const ALTO = 60
const MARGEN = 6

const kg = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 1 })

/** La curva pequeña del peso. Con un solo punto no hay curva: se pinta el punto. */
function Curva({ serie }: { serie: readonly PuntoDePeso[] }) {
  const valores = serie.map((p) => p.kg)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const rango = max - min || 1
  const puntos = serie.map((p, i) => {
    const x = serie.length === 1 ? ANCHO : (i / (serie.length - 1)) * ANCHO
    // Arriba es más peso: la curva baja cuando la persona baja.
    const y = MARGEN + (1 - (p.kg - min) / rango) * (ALTO - MARGEN * 2)
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as const
  })
  const ultimo = puntos[puntos.length - 1]
  const primera = serie[0]
  const ultima = serie[serie.length - 1]
  const descripcion =
    serie.length === 1
      ? `Una sola pesada en las últimas ${SEMANAS} semanas: ${kg(ultima.kg)} kg`
      : `Peso de las últimas ${SEMANAS} semanas, de ${kg(primera.kg)} a ${kg(ultima.kg)} kg en ${serie.length} pesadas`

  return (
    <svg viewBox={`-${MARGEN} 0 ${ANCHO + MARGEN * 2} ${ALTO}`} width="100%" height={ALTO} role="img" aria-label={descripcion}>
      {puntos.length > 1 && (
        <polyline
          points={puntos.map(([x, y]) => `${x},${y}`).join(' ')}
          pathLength={1}
          fill="none"
          stroke="var(--rojo)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dibujar-linea"
        />
      )}
      <circle cx={ultimo[0]} cy={ultimo[1]} r="5" fill="var(--rojo)" />
    </svg>
  )
}

function Perimetro({ valor, etiqueta }: { valor: number | undefined; etiqueta: string }) {
  if (valor === undefined) return null
  return (
    <div className="flex flex-col gap-0.5 text-xs text-tenue">
      <span className="cifras text-base font-bold text-texto">{kg(valor)}</span>
      {etiqueta}
    </div>
  )
}

/**
 * «Medidas y peso» en Mi día (maqueta «Espacios de Alpha»): el peso actual grande, cuánto
 * cambió en dos semanas y una curva de las últimas ocho; debajo, los perímetros.
 *
 * El peso sale de las DOS fuentes donde vive (check-in y tarjeta de medidas) y los
 * perímetros de las dos tablas donde viven (tarjeta y encuesta): ver `domain/miDia.ts`.
 *
 * Quien tiene la composición corporal apagada (0018, `verComposicion`) no ve ni el peso ni
 * la curva — la regla de Bienestar llega hasta aquí —, pero sí sus perímetros.
 */
export function MedidasYPeso({ usuarioId, hoy }: MedidasYPesoProps) {
  const verPeso = visibilidadDelAsesorado(usuarioId).verComposicion
  const medidas = db.perfiles.byUsuario(usuarioId)?.medidas ?? []
  const serie = verPeso ? serieDePeso(db.bienestar.byUsuario(usuarioId), medidas, hoy, SEMANAS) : []
  const actual = serie.at(-1)
  const cambio = cambioDePeso(serie)
  const perimetros = perimetrosRecientes(medidas, db.perfilNutricion.byUsuario(usuarioId)?.respuestas)

  return (
    <section
      aria-label="Medidas y peso"
      className="entrada entrada-6 flex flex-col gap-3 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-tenue">Medidas y peso</p>
        <Link
          to="/bienestar"
          className="press inline-flex min-h-[44px] items-center text-xs font-semibold text-texto underline underline-offset-2"
        >
          Registrar
        </Link>
      </div>

      {actual && (
        <>
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <Cifra3D valor={actual.kg} decimales={1} tamano={44} etiqueta={`${kg(actual.kg)} kilos`} />
            <span className="pb-1.5 text-[13px] text-tenue">
              kg
              {cambio
                ? ` · ${cambio.kg > 0 ? '+' : cambio.kg < 0 ? '−' : ''}${kg(Math.abs(cambio.kg))} en ${
                    cambio.dias <= 17 ? '2 semanas' : `${cambio.dias} días`
                  }`
                : ` · ${actual.fecha}`}
            </span>
          </div>
          <Curva serie={serie} />
        </>
      )}

      {perimetros && (
        <div className="grid grid-cols-3 gap-2">
          <Perimetro valor={perimetros.cinturaCm} etiqueta="cintura cm" />
          <Perimetro valor={perimetros.caderasCm} etiqueta="caderas cm" />
          <Perimetro valor={perimetros.cuelloCm} etiqueta="cuello cm" />
        </div>
      )}
      {perimetros?.fuente === 'encuesta' && (
        <p className="text-xs text-tenue">Perímetros de tu encuesta de nutrición: aún no hay una toma en tu tarjeta de medidas.</p>
      )}

      {!actual && !perimetros && (
        <p className="text-sm text-tenue">
          {verPeso
            ? 'Todavía no hay peso ni medidas en las últimas semanas. Tu check-in y tu tarjeta de medidas los irán llenando.'
            : 'Todavía no hay medidas registradas.'}
        </p>
      )}
    </section>
  )
}
